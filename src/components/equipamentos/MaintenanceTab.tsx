import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Wrench, Paperclip, X, Image, FileVideo, Loader2, AlertTriangle, RotateCcw, Undo2 } from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { useAuth } from "@/hooks/useAuth";
import { useMaintenanceHotkeys } from "@/hooks/useMaintenanceHotkeys";
import PartsMultiSelect from "./PartsMultiSelect";
import MaintenanceTimeline, { type TimelineRecord } from "./MaintenanceTimeline";

interface Maintenance extends TimelineRecord {
  equipment_id: string;
  created_at: string;
}

interface CriticalAlert {
  id: string;
  message: string | null;
  severity: string | null;
}

interface Props {
  equipmentId: string;
  equipmentName: string;
  printerType: string;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);

function buildClipboardText(r: Maintenance, equipmentName: string) {
  const lines = [
    `🔧 RELATO DE MANUTENÇÃO — ${equipmentName}`,
    `📅 Data: ${new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR")}`,
    `🏷️ Tipo: ${r.maintenance_type === "preventiva" ? "Preventiva" : "Corretiva"}`,
    `👤 Técnico: ${r.technician}`,
    r.total_counter != null ? `📊 Contador: ${r.total_counter.toLocaleString("pt-BR")}` : null,
    `⏱️ Horas: ${Number(r.hours_spent).toFixed(1)}h`,
    `💰 Valor: ${fmt(Number(r.cost))}`,
    r.replaced_parts ? `🔩 Peças: ${r.replaced_parts}` : null,
    `\n📝 Descrição:\n${r.service_description}`,
    r.notes ? `\n📌 Observações:\n${r.notes}` : null,
    r.attachments && r.attachments.length > 0 ? `\n📎 Anexos (${r.attachments.length}):\n${r.attachments.join("\n")}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function partsToArray(s: string | null): string[] {
  if (!s) return [];
  return s.split(",").map(p => p.trim()).filter(Boolean);
}

function celebrate() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.7 },
    colors: ["hsl(270, 70%, 60%)", "hsl(150, 60%, 50%)", "hsl(45, 90%, 60%)"],
  });
}

export default function MaintenanceTab({ equipmentId, equipmentName, printerType }: Props) {
  const { user } = useAuth();
  const [records, setRecords] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const technicianRef = useRef<HTMLInputElement>(null);

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [maintenanceType, setMaintenanceType] = useState("preventiva");
  const [technician, setTechnician] = useState("");
  const [totalCounter, setTotalCounter] = useState("");
  const [hoursSpent, setHoursSpent] = useState("0");
  const [cost, setCost] = useState("0");
  const [parts, setParts] = useState<string[]>([]);
  const [serviceDescription, setServiceDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Inteligência preditiva
  const [suggestedCounter, setSuggestedCounter] = useState<number | null>(null);
  const [suggestedTechnician, setSuggestedTechnician] = useState<string | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);
  const [resolveAlerts, setResolveAlerts] = useState(true);

  const hasCounter = printerType === "pb" || printerType === "color";

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("equipment_maintenances")
      .select("*")
      .eq("equipment_id", equipmentId)
      .order("date", { ascending: false });
    if (error) handleError(error, "carregar manutenções");
    if (data) setRecords(data as unknown as Maintenance[]);
    setLoading(false);
  }, [equipmentId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setMaintenanceType("preventiva");
    setTechnician("");
    setTotalCounter("");
    setHoursSpent("0");
    setCost("0");
    setParts([]);
    setServiceDescription("");
    setNotes("");
    setAttachments([]);
    setSuggestedCounter(null);
    setSuggestedTechnician(null);
    setCriticalAlerts([]);
    setResolveAlerts(true);
  };

  const loadIntelligence = useCallback(async () => {
    const [readingRes, lastMaintRes, alertsRes] = await Promise.all([
      supabase
        .from("printer_readings")
        .select("counter")
        .eq("equipment_id", equipmentId)
        .order("reading_time", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("equipment_maintenances")
        .select("technician")
        .eq("equipment_id", equipmentId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("reading_alerts_sent" as any)
        .select("id, message, severity")
        .eq("equipment_id", equipmentId)
        .eq("severity", "critical")
        .is("resolved_at", null),
    ]);

    if (readingRes.data?.counter != null) setSuggestedCounter(Number(readingRes.data.counter));
    if (lastMaintRes.data?.technician) setSuggestedTechnician(lastMaintRes.data.technician);
    setCriticalAlerts((alertsRes.data as any[]) ?? []);
  }, [equipmentId]);

  const openDialog = useCallback((m?: Maintenance) => {
    if (m) {
      setEditing(m);
      setDate(m.date);
      setMaintenanceType(m.maintenance_type);
      setTechnician(m.technician);
      setTotalCounter(m.total_counter != null ? String(m.total_counter) : "");
      setHoursSpent(String(m.hours_spent));
      setCost(String(m.cost));
      setParts(partsToArray(m.replaced_parts));
      setServiceDescription(m.service_description);
      setNotes(m.notes || "");
      setAttachments(m.attachments || []);
      setSuggestedCounter(null);
      setSuggestedTechnician(null);
      setCriticalAlerts([]);
    } else {
      setEditing(null);
      resetForm();
      loadIntelligence();
    }
    setShowDialog(true);
    setTimeout(() => technicianRef.current?.focus(), 80);
  }, [loadIntelligence]);

  const repeatLast = () => {
    const last = records[0];
    if (!last) {
      toast.info("Nenhuma manutenção anterior para repetir");
      return;
    }
    setEditing(null);
    resetForm();
    setMaintenanceType(last.maintenance_type);
    setTechnician(last.technician);
    setParts(partsToArray(last.replaced_parts));
    loadIntelligence();
    setShowDialog(true);
    setTimeout(() => technicianRef.current?.focus(), 80);
    toast.success("Dados da última manutenção carregados");
  };

  useMaintenanceHotkeys({
    enabled: !showDialog,
    onOpenNew: () => openDialog(),
  });

  const applyTechnicianSuggestion = () => {
    if (suggestedTechnician) setTechnician(suggestedTechnician);
  };
  const applyCounterSuggestion = () => {
    if (suggestedCounter != null) setTotalCounter(String(suggestedCounter));
  };

  const handlePriceSuggestion = (price: number, partName: string) => {
    if (!cost || Number(cost) === 0) {
      setCost(price.toFixed(2));
      toast.success(`💡 Valor sugerido: ${fmt(price)}`, {
        description: `Baseado no catálogo: ${partName}`,
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} excede 50MB`);
        continue;
      }
      const ext = file.name.split(".").pop();
      const path = `${equipmentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("maintenance-attachments").upload(path, file);
      if (uploadError) { handleError(uploadError, `enviar ${file.name}`); continue; }
      const { data: signData, error: signError } = await supabase.storage.from("maintenance-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signError) { handleError(signError, `gerar link para ${file.name}`); continue; }
      newUrls.push(signData.signedUrl);
    }
    setAttachments((prev) => [...prev, ...newUrls]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (newUrls.length > 0) toast.success(`${newUrls.length} arquivo(s) anexado(s)`);
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a !== url));
  };

  const counterValue = totalCounter ? Number(totalCounter) : null;
  const counterBelowSuggested =
    hasCounter && counterValue != null && suggestedCounter != null && counterValue < suggestedCounter;

  const save = async () => {
    if (!technician.trim()) return toast.error("Técnico responsável é obrigatório");
    if (!serviceDescription.trim()) return toast.error("Descrição do serviço é obrigatória");

    const payload = {
      equipment_id: equipmentId,
      date,
      maintenance_type: maintenanceType,
      technician: technician.trim(),
      total_counter: totalCounter ? Number(totalCounter) : null,
      hours_spent: Number(hoursSpent) || 0,
      cost: Number(cost) || 0,
      replaced_parts: parts.length > 0 ? parts.join(", ") : null,
      service_description: serviceDescription.trim(),
      notes: notes.trim() || null,
      attachments,
    };

    setIsSaving(true);
    const { error } = editing
      ? await supabase.from("equipment_maintenances").update(payload).eq("id", editing.id)
      : await supabase.from("equipment_maintenances").insert({ ...payload, created_by: user?.id });

    if (error) {
      setIsSaving(false);
      return handleError(error, editing ? "atualizar manutenção" : "criar manutenção");
    }

    // Resolver alertas críticos
    let alertResolved = false;
    if (!editing && resolveAlerts && criticalAlerts.length > 0) {
      const ids = criticalAlerts.map(a => a.id);
      const { error: alertErr } = await supabase
        .from("reading_alerts_sent" as any)
        .update({ resolved_at: new Date().toISOString() })
        .in("id", ids);
      if (!alertErr) alertResolved = true;
    }

    setIsSaving(false);
    setShowDialog(false);

    if (alertResolved) {
      celebrate();
      toast.success("🎉 Equipamento de volta ao verde!", {
        description: "Manutenção registrada e alerta crítico resolvido.",
      });
    } else {
      toast.success("Manutenção salva!");
    }
    fetchRecords();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("equipment_maintenances").delete().eq("id", id);
    if (error) return handleError(error, "remover manutenção");
    toast.success("Registro removido!");
    fetchRecords();
  };

  const copyToClipboard = (r: TimelineRecord) => {
    const text = buildClipboardText(r as Maintenance, equipmentName);
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Relato copiado! Cole e envie ao técnico.");
    });
  };

  // Stats
  const totalCost = records.reduce((s, r) => s + Number(r.cost), 0);
  const preventivas = records.filter(r => r.maintenance_type === "preventiva").length;
  const corretivas = records.filter(r => r.maintenance_type === "corretiva").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
            <p className="text-xl font-bold text-foreground">{records.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Preventivas</p>
            <p className="text-xl font-bold text-foreground">{preventivas}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Corretivas</p>
            <p className="text-xl font-bold text-foreground">{corretivas}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-accent">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Custo Total</p>
            <p className="text-xl font-bold text-foreground">{fmt(totalCost)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Header + actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wrench className="h-4 w-4 text-primary" />
          <span>Manutenções — {equipmentName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {records.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={repeatLast}
              title="Repetir dados da última manutenção"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Repetir última
            </Button>
          )}
          <Button onClick={() => openDialog()} size="sm" className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nova
            <kbd className="ml-1 px-1 py-0 rounded bg-primary-foreground/20 text-[10px] font-mono">M</kbd>
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <MaintenanceTimeline
        records={records}
        hasCounter={hasCounter}
        onCopy={copyToClipboard}
        onEdit={(r) => openDialog(r as Maintenance)}
        onDelete={remove}
      />

      {/* Form Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent
          className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              if (!isSaving && !uploading) save();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? "Editar Manutenção" : "Nova Manutenção"}
              <kbd className="ml-auto px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border">
                Ctrl+↵ salvar
              </kbd>
            </DialogTitle>
          </DialogHeader>

          {/* Banner de alerta crítico */}
          {!editing && criticalAlerts.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {criticalAlerts.length === 1
                      ? "1 alerta crítico aberto"
                      : `${criticalAlerts.length} alertas críticos abertos`}
                  </p>
                  {criticalAlerts[0]?.message && (
                    <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5 line-clamp-2">
                      {criticalAlerts[0].message}
                    </p>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-800 dark:text-amber-200">
                <Checkbox
                  checked={resolveAlerts}
                  onCheckedChange={(c) => setResolveAlerts(c === true)}
                />
                Resolver com esta manutenção
              </label>
            </div>
          )}

          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input className="h-9" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={maintenanceType} onValueChange={setMaintenanceType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventiva">Preventiva</SelectItem>
                    <SelectItem value="corretiva">Corretiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Técnico Responsável</Label>
                {suggestedTechnician && technician !== suggestedTechnician && (
                  <button
                    type="button"
                    onClick={applyTechnicianSuggestion}
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <Undo2 className="h-2.5 w-2.5" />
                    sugerido: {suggestedTechnician}
                  </button>
                )}
              </div>
              <Input
                ref={technicianRef}
                className="h-9"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                placeholder="Nome do técnico"
              />
            </div>

            {/* Grid 3 colunas mesmo no mobile */}
            <div className="grid grid-cols-3 gap-2">
              {hasCounter && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <Label className="text-xs">Contador</Label>
                    {suggestedCounter != null && counterValue !== suggestedCounter && (
                      <button
                        type="button"
                        onClick={applyCounterSuggestion}
                        className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                        title={`Última leitura: ${suggestedCounter.toLocaleString("pt-BR")}`}
                      >
                        <Undo2 className="h-2.5 w-2.5" /> sugerido
                      </button>
                    )}
                  </div>
                  <Input
                    className="h-9 font-mono"
                    type="number"
                    value={totalCounter}
                    onChange={(e) => setTotalCounter(e.target.value)}
                    placeholder="0"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Horas</Label>
                <Input className="h-9 font-mono" type="number" step="0.5" value={hoursSpent} onChange={(e) => setHoursSpent(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$)</Label>
                <Input className="h-9 font-mono" type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
            </div>

            {counterBelowSuggested && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <p className="text-[11px] text-destructive">
                  Atenção: contador inferior à última leitura registrada
                  {" "}({suggestedCounter?.toLocaleString("pt-BR")}).
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Peças Substituídas</Label>
              <PartsMultiSelect
                equipmentId={equipmentId}
                value={parts}
                onChange={setParts}
                onPriceSuggestion={handlePriceSuggestion}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descrição do Serviço</Label>
              <Textarea
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                placeholder="Descreva o serviço realizado..."
                rows={3}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-xs">
                <Paperclip className="h-3 w-3" />
                Anexos (Fotos / Vídeos)
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 w-full border-dashed h-9"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary" />
                ) : (
                  <Image className="h-3.5 w-3.5" />
                )}
                {uploading ? "Enviando..." : "Adicionar Fotos/Vídeos"}
              </Button>

              {attachments.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {attachments.map((url, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden border bg-muted/30">
                      {isImage(url) ? (
                        <img src={url} alt={`Anexo ${i + 1}`} className="w-full h-20 object-cover" />
                      ) : (
                        <div className="w-full h-20 flex items-center justify-center bg-muted">
                          <FileVideo className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(url)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={save} disabled={isSaving || uploading}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
