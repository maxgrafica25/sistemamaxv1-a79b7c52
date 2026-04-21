import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit2, Wrench, Paperclip, X, Copy, Image, FileVideo, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";

interface Maintenance {
  id: string;
  equipment_id: string;
  date: string;
  maintenance_type: string;
  technician: string;
  total_counter: number | null;
  hours_spent: number;
  cost: number;
  replaced_parts: string | null;
  service_description: string;
  notes: string | null;
  attachments: string[] | null;
  created_at: string;
}

interface Props {
  equipmentId: string;
  equipmentName: string;
  printerType: string;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const typeBadge = (t: string) => {
  switch (t) {
    case "preventiva":
      return <Badge className="text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Preventiva</Badge>;
    case "corretiva":
      return <Badge className="text-xs bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30">Corretiva</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{t}</Badge>;
  }
};

const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
const isVideo = (url: string) => /\.(mp4|mov|avi|webm|mkv)$/i.test(url);

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

export default function MaintenanceTab({ equipmentId, equipmentName, printerType }: Props) {
  const [records, setRecords] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);
  const [detailRecord, setDetailRecord] = useState<Maintenance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [maintenanceType, setMaintenanceType] = useState("preventiva");
  const [technician, setTechnician] = useState("");
  const [totalCounter, setTotalCounter] = useState("");
  const [hoursSpent, setHoursSpent] = useState("0");
  const [cost, setCost] = useState("0");
  const [replacedParts, setReplacedParts] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasCounter = printerType === "pb" || printerType === "color";

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("equipment_maintenances")
      .select("*")
      .eq("equipment_id", equipmentId)
      .order("date", { ascending: false });
    if (error) handleError(error, "carregar manutenções");
    if (data) setRecords(data as unknown as Maintenance[]);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [equipmentId]);

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setMaintenanceType("preventiva");
    setTechnician("");
    setTotalCounter("");
    setHoursSpent("0");
    setCost("0");
    setReplacedParts("");
    setServiceDescription("");
    setNotes("");
    setAttachments([]);
  };

  const openDialog = (m?: Maintenance) => {
    if (m) {
      setEditing(m);
      setDate(m.date);
      setMaintenanceType(m.maintenance_type);
      setTechnician(m.technician);
      setTotalCounter(m.total_counter != null ? String(m.total_counter) : "");
      setHoursSpent(String(m.hours_spent));
      setCost(String(m.cost));
      setReplacedParts(m.replaced_parts || "");
      setServiceDescription(m.service_description);
      setNotes(m.notes || "");
      setAttachments(m.attachments || []);
    } else {
      setEditing(null);
      resetForm();
    }
    setShowDialog(true);
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
      const { error } = await supabase.storage
        .from("maintenance-attachments")
        .upload(path, file);
      if (error) {
        handleError(error, `enviar ${file.name}`);
        continue;
      }
      const { data: urlData } = supabase.storage
        .from("maintenance-attachments")
        .getPublicUrl(path);
      newUrls.push(urlData.publicUrl);
    }

    setAttachments((prev) => [...prev, ...newUrls]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (newUrls.length > 0) toast.success(`${newUrls.length} arquivo(s) anexado(s)`);
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a !== url));
  };

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
      replaced_parts: replacedParts.trim() || null,
      service_description: serviceDescription.trim(),
      notes: notes.trim() || null,
      attachments,
    };

    setIsSaving(true);
    const { error } = editing
      ? await supabase.from("equipment_maintenances").update(payload).eq("id", editing.id)
      : await supabase.from("equipment_maintenances").insert(payload);
    setIsSaving(false);

    if (error) return handleError(error, editing ? "atualizar manutenção" : "criar manutenção");
    setShowDialog(false);
    toast.success("Manutenção salva!");
    fetchRecords();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("equipment_maintenances").delete().eq("id", id);
    if (error) return handleError(error, "remover manutenção");
    toast.success("Registro removido!");
    fetchRecords();
  };

  const copyToClipboard = (r: Maintenance) => {
    const text = buildClipboardText(r, equipmentName);
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

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            Manutenções — {equipmentName}
          </CardTitle>
          <Button onClick={() => openDialog()} size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nova Manutenção
          </Button>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma manutenção registrada para este equipamento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Técnico</TableHead>
                    {hasCounter && <TableHead className="text-right">Contador</TableHead>}
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Anexos</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailRecord(r)}>
                      <TableCell className="font-mono text-sm whitespace-nowrap">
                        {new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>{typeBadge(r.maintenance_type)}</TableCell>
                      <TableCell className="text-sm">{r.technician}</TableCell>
                      {hasCounter && (
                        <TableCell className="text-right font-mono text-sm">
                          {r.total_counter != null ? r.total_counter.toLocaleString("pt-BR") : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono text-sm">{fmt(Number(r.cost))}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={r.service_description}>
                        {r.service_description}
                      </TableCell>
                      <TableCell className="text-center">
                        {(r.attachments?.length || 0) > 0 && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Paperclip className="h-3 w-3" />
                            {r.attachments!.length}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Copiar relato p/ técnico" onClick={() => copyToClipboard(r)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(r)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailRecord} onOpenChange={(open) => !open && setDetailRecord(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Detalhes da Manutenção
            </DialogTitle>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="text-sm font-medium">{new Date(detailRecord.date + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <div className="mt-0.5">{typeBadge(detailRecord.maintenance_type)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Técnico</p>
                  <p className="text-sm font-medium">{detailRecord.technician}</p>
                </div>
                {hasCounter && detailRecord.total_counter != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Contador</p>
                    <p className="text-sm font-mono font-medium">{detailRecord.total_counter.toLocaleString("pt-BR")}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Horas</p>
                  <p className="text-sm font-mono font-medium">{Number(detailRecord.hours_spent).toFixed(1)}h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="text-sm font-mono font-medium">{fmt(Number(detailRecord.cost))}</p>
                </div>
              </div>

              {detailRecord.replaced_parts && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Peças Substituídas</p>
                  <p className="text-sm bg-muted/50 p-2 rounded-md">{detailRecord.replaced_parts}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-1">Descrição do Serviço</p>
                <p className="text-sm bg-muted/50 p-2 rounded-md whitespace-pre-wrap">{detailRecord.service_description}</p>
              </div>

              {detailRecord.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm bg-muted/50 p-2 rounded-md whitespace-pre-wrap">{detailRecord.notes}</p>
                </div>
              )}

              {/* Attachments gallery */}
              {detailRecord.attachments && detailRecord.attachments.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Anexos ({detailRecord.attachments.length})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {detailRecord.attachments.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group relative block rounded-lg overflow-hidden border bg-muted/30 hover:border-primary transition-colors">
                        {isImage(url) ? (
                          <img src={url} alt={`Anexo ${i + 1}`} className="w-full h-28 object-cover" />
                        ) : isVideo(url) ? (
                          <div className="w-full h-28 flex items-center justify-center bg-muted">
                            <FileVideo className="h-8 w-8 text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="w-full h-28 flex items-center justify-center bg-muted">
                            <Paperclip className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="gap-2" onClick={() => detailRecord && copyToClipboard(detailRecord)}>
              <Copy className="h-4 w-4" />
              Copiar p/ Técnico
            </Button>
            <Button variant="outline" onClick={() => { setDetailRecord(null); if (detailRecord) openDialog(detailRecord); }}>
              <Edit2 className="h-4 w-4 mr-1" /> Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Manutenção" : "Nova Manutenção"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Manutenção</Label>
                <Select value={maintenanceType} onValueChange={setMaintenanceType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventiva">Preventiva</SelectItem>
                    <SelectItem value="corretiva">Corretiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Técnico Responsável</Label>
              <Input value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="Nome do técnico" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {hasCounter && (
                <div className="space-y-2">
                  <Label>Contador Total</Label>
                  <Input type="number" value={totalCounter} onChange={(e) => setTotalCounter(e.target.value)} placeholder="Ex: 150000" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Horas Gastas</Label>
                <Input type="number" step="0.5" value={hoursSpent} onChange={(e) => setHoursSpent(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Peças Substituídas</Label>
              <Input value={replacedParts} onChange={(e) => setReplacedParts(e.target.value)} placeholder="Ex: Cilindro, Belt de Transferência" />
            </div>

            <div className="space-y-2">
              <Label>Descrição do Serviço</Label>
              <Textarea value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder="Descreva o serviço realizado..." rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações adicionais..." rows={2} />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
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
                className="gap-1.5 w-full border-dashed"
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
