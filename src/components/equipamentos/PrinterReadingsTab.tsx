import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus, Printer, Package, ClipboardList, Clock, User, Sparkles, AlertTriangle, ChevronRight, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ─── Constantes de módulo (não recriar a cada render) ───────────────────────
const OUTLIER_THRESHOLD = 2000;

const TONER_COLORS: Record<string, string> = {
  ciano: "bg-cyan-500", cyan: "bg-cyan-500",
  magenta: "bg-fuchsia-500",
  amarelo: "bg-yellow-500", yellow: "bg-yellow-500",
  preto: "bg-zinc-800", black: "bg-zinc-800", "black k": "bg-zinc-800",
};

const fmtNum = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR") : "—";

const fmtDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("pt-BR");
const fmtTime = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const isTonerName = (name: string) => {
  const n = name.toLowerCase();
  if (!n.includes("toner")) return false;
  if (n.includes("revelador") || n.includes("cilindro") || n.includes("belt") || n.includes("fusor") || n.includes("drum")) return false;
  return true;
};

const detectTonerColor = (name: string): string => {
  const n = name.toLowerCase();
  for (const key of Object.keys(TONER_COLORS)) {
    if (n.includes(key)) return TONER_COLORS[key];
  }
  return "bg-muted-foreground";
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case "daily":
      return <Badge variant="outline" className="gap-1 text-xs"><ClipboardList className="h-3 w-3" />Leitura Diária</Badge>;
    case "toner_change":
      return <Badge className="gap-1 text-xs bg-blue-500 hover:bg-blue-600"><Package className="h-3 w-3" />Troca Toner/Peça</Badge>;
    default:
      return <Badge>{type}</Badge>;
  }
};

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface PrinterReadingsTabProps {
  equipmentId: string;
  equipmentName: string;
  printerType: string; // 'pb' | 'color' | 'other'
}

interface Reading {
  id: string;
  equipment_id: string;
  date: string;
  reading_time: string;
  type: string;
  operator_name: string | null;
  copies_bw: number | null;
  color_prints: number | null;
  bw_prints: number | null;
  total_prints: number | null;
  counter: number;
  notes: string | null;
  consumable_id: string | null;
}

interface Consumable {
  id: string;
  name: string;
}

// ─── Sub-componente: Linha de delta com alerta de outlier ───────────────────
function DeltaLine({ delta, label = "hoje" }: { delta: number; label?: string }) {
  const isOutlier = delta > OUTLIER_THRESHOLD;
  const isNegative = delta < 0;
  const isZero = delta === 0;

  return (
    <div className={cn(
      "text-xs flex items-center gap-1 mt-1 font-medium",
      isNegative ? "text-destructive" : isZero ? "text-muted-foreground" : "text-green-600 dark:text-green-500"
    )}>
      {!isZero && (delta >= 0 ? "↑ +" : "↓ ")}
      {Math.abs(delta).toLocaleString("pt-BR")} {label}
      {isOutlier && (
        <AlertTriangle className="h-3 w-3 text-yellow-500 ml-0.5" aria-label="Volume alto — confira se digitou um zero a mais" />
      )}
      {isNegative && (
        <AlertTriangle className="h-3 w-3 text-destructive ml-0.5" aria-label="Menor que a última leitura" />
      )}
    </div>
  );
}

// ─── Sub-componente: Bloco de referência da última leitura ──────────────────
function LastReadingReference({
  lastReading, printerType,
}: { lastReading: Reading | null; printerType: string }) {
  if (!lastReading) {
    return (
      <div className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2 border border-dashed">
        Primeira leitura deste equipamento — sem referência anterior.
      </div>
    );
  }

  return (
    <div className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2 flex items-center gap-2 flex-wrap">
      <Clock className="h-3 w-3" />
      <span>Última leitura ({fmtDate(lastReading.reading_time)} {fmtTime(lastReading.reading_time)}):</span>
      {printerType === "color" ? (
        <>
          <span>Cores: <span className="font-mono font-medium text-foreground">{fmtNum(lastReading.color_prints)}</span></span>
          <span>·</span>
          <span>Preto: <span className="font-mono font-medium text-foreground">{fmtNum(lastReading.bw_prints)}</span></span>
        </>
      ) : printerType === "pb" ? (
        <>
          <span>Cópias: <span className="font-mono font-medium text-foreground">{fmtNum(lastReading.copies_bw)}</span></span>
          <span>·</span>
          <span>Impressões: <span className="font-mono font-medium text-foreground">{fmtNum(lastReading.bw_prints)}</span></span>
        </>
      ) : (
        <span>Total: <span className="font-mono font-medium text-foreground">{fmtNum(lastReading.total_prints)}</span></span>
      )}
    </div>
  );
}

// ─── Sub-componente: Quick Reading Dialog ───────────────────────────────────
interface QuickReadingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentName: string;
  printerType: string;
  lastReading: Reading | null;
  operatorName: string;
  onSave: (data: {
    colorPrints: number | null;
    bwPrints: number | null;
    copiesBw: number | null;
    total: number;
    notes: string | null;
  }) => Promise<void>;
}

function QuickReadingDialog({
  open, onOpenChange, equipmentName, printerType, lastReading, operatorName, onSave,
}: QuickReadingDialogProps) {
  const [colorPrints, setColorPrints] = useState("");
  const [bwPrints, setBwPrints] = useState("");
  const [copiesBw, setCopiesBw] = useState("");
  const [otherTotal, setOtherTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [saving, setSaving] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const lastInputRef = useRef<HTMLInputElement>(null);

  // Pré-preenche com a última leitura ao abrir + auto-foco com requestAnimationFrame
  // para esperar a animação do Radix Dialog terminar antes do .select()
  useEffect(() => {
    if (!open) return;

    if (lastReading) {
      setColorPrints(String(lastReading.color_prints ?? ""));
      setBwPrints(String(lastReading.bw_prints ?? ""));
      setCopiesBw(String(lastReading.copies_bw ?? ""));
      setOtherTotal(String(lastReading.total_prints ?? ""));
    } else {
      setColorPrints("");
      setBwPrints("");
      setCopiesBw("");
      setOtherTotal("");
    }
    setNotes("");
    setShowNotes(false);

    // Radix Dialog tem animação de entrada (~150ms). Chamar .select() imediato
    // falha porque o input ainda não recebeu foco real do Radix.
    // requestAnimationFrame espera o próximo frame, garantindo que o DOM
    // esteja pronto e o foco persista. Não usar autoFocus do Radix porque
    // ele foca mas NÃO seleciona o texto.
    requestAnimationFrame(() => {
      firstInputRef.current?.select();
    });
  }, [open, lastReading]);

  // Cálculos memoizados — recalculam só quando inputs mudam, não a cada render do pai
  const colorNum = useMemo(() => parseInt(colorPrints) || 0, [colorPrints]);
  const bwNum = useMemo(() => parseInt(bwPrints) || 0, [bwPrints]);
  const copiesNum = useMemo(() => parseInt(copiesBw) || 0, [copiesBw]);
  const otherNum = useMemo(() => parseInt(otherTotal) || 0, [otherTotal]);

  const lastColor = lastReading?.color_prints ?? 0;
  const lastBw = lastReading?.bw_prints ?? 0;
  const lastCopies = lastReading?.copies_bw ?? 0;
  const lastTotal = lastReading?.total_prints ?? 0;

  const colorDelta = useMemo(() => colorNum - lastColor, [colorNum, lastColor]);
  const bwDelta = useMemo(() => bwNum - lastBw, [bwNum, lastBw]);
  const copiesDelta = useMemo(() => copiesNum - lastCopies, [copiesNum, lastCopies]);

  const computedTotal = useMemo(() => {
    if (printerType === "color") return colorNum + bwNum;
    if (printerType === "pb") return copiesNum + bwNum;
    return otherNum;
  }, [printerType, colorNum, bwNum, copiesNum, otherNum]);

  const totalDelta = useMemo(() => computedTotal - lastTotal, [computedTotal, lastTotal]);

  const canSubmit = useMemo(() => {
    if (saving) return false;
    if (computedTotal <= 0) return false;
    // Sem leitura anterior: qualquer valor positivo serve
    if (!lastReading) return true;
    return totalDelta > 0;
  }, [saving, computedTotal, lastReading, totalDelta]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    // Aviso de outlier (não bloqueia, só confirma)
    if (totalDelta > OUTLIER_THRESHOLD) {
      const ok = window.confirm(
        `Volume registrado é alto: ${totalDelta.toLocaleString("pt-BR")} impressões desde a última leitura.\n\nTem certeza que digitou o número correto? (Pode estar com um zero a mais.)`
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      await onSave({
        colorPrints: printerType === "color" ? colorNum : null,
        bwPrints: (printerType === "color" || printerType === "pb") ? bwNum : null,
        copiesBw: printerType === "pb" ? copiesNum : null,
        total: computedTotal,
        notes: notes || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, isLast: boolean) => {
    if (e.key === "Enter" && isLast && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Leitura Rápida — {equipmentName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <User className="h-3 w-3" />
            {operatorName} · {new Date().toLocaleString("pt-BR")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <LastReadingReference lastReading={lastReading} printerType={printerType} />

          {/* Inputs por tipo de impressora */}
          {printerType === "color" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Impr. Cores</Label>
                <Input
                  ref={firstInputRef}
                  type="number"
                  inputMode="numeric"
                  value={colorPrints}
                  onChange={(e) => setColorPrints(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, false)}
                  className="font-mono text-base h-11"
                />
                {lastReading && <DeltaLine delta={colorDelta} />}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Impr. Preto</Label>
                <Input
                  ref={lastInputRef}
                  type="number"
                  inputMode="numeric"
                  value={bwPrints}
                  onChange={(e) => setBwPrints(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, true)}
                  className="font-mono text-base h-11"
                />
                {lastReading && <DeltaLine delta={bwDelta} />}
              </div>
            </div>
          ) : printerType === "pb" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cópias PB</Label>
                <Input
                  ref={firstInputRef}
                  type="number"
                  inputMode="numeric"
                  value={copiesBw}
                  onChange={(e) => setCopiesBw(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, false)}
                  className="font-mono text-base h-11"
                />
                {lastReading && <DeltaLine delta={copiesDelta} />}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Impressões PB</Label>
                <Input
                  ref={lastInputRef}
                  type="number"
                  inputMode="numeric"
                  value={bwPrints}
                  onChange={(e) => setBwPrints(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, true)}
                  className="font-mono text-base h-11"
                />
                {lastReading && <DeltaLine delta={bwDelta} />}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Total de Impressões</Label>
              <Input
                ref={firstInputRef}
                type="number"
                inputMode="numeric"
                value={otherTotal}
                onChange={(e) => setOtherTotal(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, true)}
                className="font-mono text-base h-11"
              />
              {lastReading && <DeltaLine delta={totalDelta} />}
            </div>
          )}

          {/* Total computado (apenas color/pb, já que "other" só tem 1 input) */}
          {printerType !== "other" && (
            <div className="rounded-lg border border-border bg-card p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total calculado (auto)</p>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {computedTotal.toLocaleString("pt-BR")}
                </p>
              </div>
              {lastReading && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Desde a última</p>
                  <DeltaLine delta={totalDelta} label="" />
                </div>
              )}
            </div>
          )}

          {/* Observações colapsáveis */}
          <Collapsible open={showNotes} onOpenChange={setShowNotes}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground -ml-2">
                <ChevronRight className={cn("h-3 w-3 transition-transform", showNotes && "rotate-90")} />
                {showNotes ? "Ocultar observação" : "Adicionar observação"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Input
                placeholder="Observação opcional..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "transition-all gap-1.5",
              canSubmit && "ring-2 ring-primary/40 shadow-md shadow-primary/20"
            )}
          >
            <Sparkles className={cn("h-4 w-4 transition-opacity", !canSubmit && "opacity-0")} />
            {saving ? "Registrando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-componente: Toner Change Dialog ────────────────────────────────────
interface TonerChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentName: string;
  printerType: string;
  lastReading: Reading | null;
  consumables: Consumable[];
  operatorName: string;
  onSave: (data: {
    colorPrints: number | null;
    bwPrints: number | null;
    copiesBw: number | null;
    total: number;
    notes: string | null;
    consumableId: string | null;
  }) => Promise<void>;
}

function TonerChangeDialog({
  open, onOpenChange, equipmentName, printerType, lastReading, consumables, operatorName, onSave,
}: TonerChangeDialogProps) {
  const [selectedConsumableId, setSelectedConsumableId] = useState<string | null>(null);
  const [colorPrints, setColorPrints] = useState("");
  const [bwPrints, setBwPrints] = useState("");
  const [copiesBw, setCopiesBw] = useState("");
  const [otherTotal, setOtherTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (lastReading) {
      setColorPrints(String(lastReading.color_prints ?? ""));
      setBwPrints(String(lastReading.bw_prints ?? ""));
      setCopiesBw(String(lastReading.copies_bw ?? ""));
      setOtherTotal(String(lastReading.total_prints ?? ""));
    } else {
      setColorPrints(""); setBwPrints(""); setCopiesBw(""); setOtherTotal("");
    }
    setNotes("");
    // Se houver só 1 consumível, pré-seleciona
    setSelectedConsumableId(consumables.length === 1 ? consumables[0].id : null);
  }, [open, lastReading, consumables]);

  const colorNum = useMemo(() => parseInt(colorPrints) || 0, [colorPrints]);
  const bwNum = useMemo(() => parseInt(bwPrints) || 0, [bwPrints]);
  const copiesNum = useMemo(() => parseInt(copiesBw) || 0, [copiesBw]);
  const otherNum = useMemo(() => parseInt(otherTotal) || 0, [otherTotal]);

  const computedTotal = useMemo(() => {
    if (printerType === "color") return colorNum + bwNum;
    if (printerType === "pb") return copiesNum + bwNum;
    return otherNum;
  }, [printerType, colorNum, bwNum, copiesNum, otherNum]);

  const lastTotal = lastReading?.total_prints ?? 0;
  const totalDelta = useMemo(() => computedTotal - lastTotal, [computedTotal, lastTotal]);

  const canSubmit = useMemo(() => {
    if (saving) return false;
    if (computedTotal <= 0) return false;
    if (!selectedConsumableId) return false;
    if (lastReading && totalDelta < 0) return false;
    return true;
  }, [saving, computedTotal, selectedConsumableId, lastReading, totalDelta]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSave({
        colorPrints: printerType === "color" ? colorNum : null,
        bwPrints: (printerType === "color" || printerType === "pb") ? bwNum : null,
        copiesBw: printerType === "pb" ? copiesNum : null,
        total: computedTotal,
        notes: notes || null,
        consumableId: selectedConsumableId,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-500" />
            Troca de Toner/Peça — {equipmentName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <User className="h-3 w-3" />
            {operatorName} · {new Date().toLocaleString("pt-BR")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Chips de consumível */}
          {consumables.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs">Qual peça foi trocada? *</Label>
              <div className="flex flex-wrap gap-2">
                {consumables.map((c) => {
                  const isSelected = selectedConsumableId === c.id;
                  const colorClass = detectTonerColor(c.name);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedConsumableId(c.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      <span className={cn("h-3 w-3 rounded-full", colorClass)} />
                      {c.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSelectedConsumableId("__other__")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                    selectedConsumableId === "__other__"
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <Wrench className="h-3 w-3" />
                  Outra peça
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
              Sem consumíveis cadastrados. A troca será registrada como genérica.
            </div>
          )}

          <LastReadingReference lastReading={lastReading} printerType={printerType} />

          {/* Inputs de contadores no momento da troca */}
          <div className="space-y-2">
            <Label className="text-xs">Contadores no momento da troca:</Label>
            {printerType === "color" ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Cores"
                  value={colorPrints}
                  onChange={(e) => setColorPrints(e.target.value)}
                  className="font-mono"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Preto"
                  value={bwPrints}
                  onChange={(e) => setBwPrints(e.target.value)}
                  className="font-mono"
                />
              </div>
            ) : printerType === "pb" ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Cópias PB"
                  value={copiesBw}
                  onChange={(e) => setCopiesBw(e.target.value)}
                  className="font-mono"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Impressões PB"
                  value={bwPrints}
                  onChange={(e) => setBwPrints(e.target.value)}
                  className="font-mono"
                />
              </div>
            ) : (
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Total"
                value={otherTotal}
                onChange={(e) => setOtherTotal(e.target.value)}
                className="font-mono"
              />
            )}
            <p className="text-xs text-muted-foreground font-mono">
              Total: {computedTotal.toLocaleString("pt-BR")}
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Observações <span className="text-muted-foreground">(recomendado)</span>
            </Label>
            <Input
              placeholder="Ex: lote do toner, validade, motivo da troca..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? "Registrando..." : "Registrar Troca"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function PrinterReadingsTab({ equipmentId, equipmentName, printerType }: PrinterReadingsTabProps) {
  const { profile } = useAuth();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickDialog, setShowQuickDialog] = useState(false);
  const [showTonerDialog, setShowTonerDialog] = useState(false);

  const fetchReadings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("printer_readings")
      .select("*")
      .eq("equipment_id", equipmentId)
      .order("reading_time", { ascending: false });
    if (data) setReadings(data as Reading[]);
    setLoading(false);
  };

  const fetchConsumables = async () => {
    const { data } = await supabase
      .from("equipment_consumables")
      .select("id, name")
      .eq("equipment_id", equipmentId)
      .order("sort_order");
    if (data) {
      const toners = (data as Consumable[]).filter(c => isTonerName(c.name));
      setConsumables(toners);
    }
  };

  useEffect(() => { fetchReadings(); fetchConsumables(); }, [equipmentId]);

  // ─── Memos derivados (estáveis para os dialogs) ───────────────────────────
  const lastReading = useMemo(() => readings[0] ?? null, [readings]);

  const consumableMap = useMemo(() => {
    const m = new Map<string, string>();
    consumables.forEach(c => m.set(c.id, c.name));
    return m;
  }, [consumables]);

  const stats = useMemo(() => {
    if (readings.length === 0) return null;
    const last = readings[0];
    const lastTonerChange = readings.find(r => r.type === "toner_change");
    const totalSinceLastToner = lastTonerChange && last
      ? (last.total_prints || 0) - (lastTonerChange.total_prints || 0)
      : last?.total_prints || 0;
    return {
      lastDate: last.reading_time,
      lastTotal: last.total_prints || 0,
      lastOperator: last.operator_name || "—",
      totalSinceLastToner,
      readingsCount: readings.length,
    };
  }, [readings]);

  const checkTonerAlert = async (currentTotal: number) => {
    try {
      const { data: cons } = await supabase
        .from("equipment_consumables")
        .select("name, yield_pages")
        .eq("equipment_id", equipmentId);
      if (!cons?.length) return;
      const lastTonerChange = readings.find(r => r.type === "toner_change");
      const printsSinceToner = lastTonerChange
        ? currentTotal - (lastTonerChange.total_prints || 0)
        : currentTotal;
      for (const c of cons) {
        if (c.yield_pages <= 0) continue;
        const remaining = c.yield_pages - printsSinceToner;
        if (remaining <= 1000 && remaining > 0) {
          toast.warning(
            `⚠️ ${c.name} de "${equipmentName}" próximo do fim: ~${remaining.toLocaleString("pt-BR")} impressões restantes`,
            { duration: 8000 }
          );
        } else if (remaining <= 0) {
          toast.error(
            `🔴 ${c.name} de "${equipmentName}" ultrapassou o rendimento esperado!`,
            { duration: 10000 }
          );
        }
      }
    } catch { /* silently ignore */ }
  };

  // ─── Save handlers ────────────────────────────────────────────────────────
  const saveQuick = async (data: {
    colorPrints: number | null;
    bwPrints: number | null;
    copiesBw: number | null;
    total: number;
    notes: string | null;
  }) => {
    const { error } = await supabase.from("printer_readings").insert({
      equipment_id: equipmentId,
      printer_model: equipmentName,
      date: new Date().toISOString().split("T")[0],
      reading_time: new Date().toISOString(),
      counter: data.total,
      type: "daily",
      operator_name: profile?.display_name || null,
      copies_bw: data.copiesBw,
      color_prints: data.colorPrints,
      bw_prints: data.bwPrints,
      total_prints: data.total,
      notes: data.notes,
      consumable_id: null,
    });
    if (error) {
      toast.error("Erro ao salvar leitura");
      return;
    }
    await checkTonerAlert(data.total);
    toast.success("Leitura registrada!");
    fetchReadings();
  };

  const saveToner = async (data: {
    colorPrints: number | null;
    bwPrints: number | null;
    copiesBw: number | null;
    total: number;
    notes: string | null;
    consumableId: string | null;
  }) => {
    const consumableId = data.consumableId === "__other__" ? null : data.consumableId;
    const { error } = await supabase.from("printer_readings").insert({
      equipment_id: equipmentId,
      printer_model: equipmentName,
      date: new Date().toISOString().split("T")[0],
      reading_time: new Date().toISOString(),
      counter: data.total,
      type: "toner_change",
      operator_name: profile?.display_name || null,
      copies_bw: data.copiesBw,
      color_prints: data.colorPrints,
      bw_prints: data.bwPrints,
      total_prints: data.total,
      notes: data.notes,
      consumable_id: consumableId,
    });
    if (error) {
      toast.error("Erro ao salvar troca");
      return;
    }
    toast.success("Troca registrada!");
    fetchReadings();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total Atual</p>
              <p className="text-lg font-bold text-foreground">{stats.lastTotal.toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Desde Último Toner</p>
              <p className="text-lg font-bold text-foreground">{stats.totalSinceLastToner.toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-accent">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Última Leitura</p>
              <p className="text-lg font-bold text-foreground">{fmtDate(stats.lastDate)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-muted-foreground">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Nº de Leituras</p>
              <p className="text-lg font-bold text-foreground">{stats.readingsCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions: 2 botões distintos */}
      <div className="flex justify-end gap-2 flex-wrap">
        <Button
          onClick={() => setShowTonerDialog(true)}
          size="sm"
          variant="outline"
          className="gap-1.5"
        >
          <Wrench className="h-4 w-4" /> Troca de Toner/Peça
        </Button>
        <Button
          onClick={() => setShowQuickDialog(true)}
          size="sm"
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> Leitura Rápida
        </Button>
      </div>

      {/* Tabela de leituras */}
      {readings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma leitura registrada para este equipamento</p>
          <p className="text-xs mt-1">Clique em "Leitura Rápida" para começar o acompanhamento</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Operador</TableHead>
                {printerType === "pb" ? (
                  <>
                    <TableHead className="text-right">Cópias PB</TableHead>
                    <TableHead className="text-right">Impressões PB</TableHead>
                  </>
                ) : printerType === "color" ? (
                  <>
                    <TableHead className="text-right">Impr. Cores</TableHead>
                    <TableHead className="text-right">Impr. Preto</TableHead>
                  </>
                ) : null}
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readings.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {fmtDate(r.reading_time || r.date)} {r.reading_time && fmtTime(r.reading_time)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getTypeBadge(r.type)}
                      {r.type === "toner_change" && r.consumable_id && consumableMap.get(r.consumable_id) && (
                        <span className="text-xs text-muted-foreground">— {consumableMap.get(r.consumable_id)}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {r.operator_name || "—"}
                    </div>
                  </TableCell>
                  {printerType === "pb" ? (
                    <>
                      <TableCell className="text-right font-mono text-sm">{fmtNum(r.copies_bw)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmtNum(r.bw_prints)}</TableCell>
                    </>
                  ) : printerType === "color" ? (
                    <>
                      <TableCell className="text-right font-mono text-sm">{fmtNum(r.color_prints)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmtNum(r.bw_prints)}</TableCell>
                    </>
                  ) : null}
                  <TableCell className="text-right font-mono text-sm font-semibold">{fmtNum(r.total_prints)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      <QuickReadingDialog
        open={showQuickDialog}
        onOpenChange={setShowQuickDialog}
        equipmentName={equipmentName}
        printerType={printerType}
        lastReading={lastReading}
        operatorName={profile?.display_name || "—"}
        onSave={saveQuick}
      />
      <TonerChangeDialog
        open={showTonerDialog}
        onOpenChange={setShowTonerDialog}
        equipmentName={equipmentName}
        printerType={printerType}
        lastReading={lastReading}
        consumables={consumables}
        operatorName={profile?.display_name || "—"}
        onSave={saveToner}
      />
    </div>
  );
}
