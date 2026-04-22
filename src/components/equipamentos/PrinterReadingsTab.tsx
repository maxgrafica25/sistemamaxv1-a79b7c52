import { useState, useEffect, useMemo } from "react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Printer, Wrench, Package, ClipboardList, Clock, User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

const isTonerName = (name: string) => {
  const n = name.toLowerCase();
  if (!n.includes("toner")) return false;
  // Exclude non-toner items that might contain related words
  if (n.includes("revelador") || n.includes("cilindro") || n.includes("belt") || n.includes("fusor") || n.includes("drum")) return false;
  return true;
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

export default function PrinterReadingsTab({ equipmentId, equipmentName, printerType }: PrinterReadingsTabProps) {
  const { profile } = useAuth();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  // Form state
  const [readingType, setReadingType] = useState("daily");
  const [selectedConsumableId, setSelectedConsumableId] = useState<string>("__generic__");
  const [copiesBw, setCopiesBw] = useState("");
  const [colorPrints, setColorPrints] = useState("");
  const [bwPrints, setBwPrints] = useState("");
  const [totalPrints, setTotalPrints] = useState("");
  const [notes, setNotes] = useState("");

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

  useEffect(() => { fetchReadings(); }, [equipmentId]);

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

  const resetForm = () => {
    setReadingType("daily");
    setCopiesBw("");
    setColorPrints("");
    setBwPrints("");
    setTotalPrints("");
    setNotes("");
  };

  const handleSave = async () => {
    if (!totalPrints) {
      toast.error("Total de impressões é obrigatório");
      return;
    }

    const newTotal = parseInt(totalPrints) || 0;

    // Validation: block values less than previous reading
    if (readings.length > 0) {
      const lastTotal = readings[0].total_prints || 0;
      if (newTotal < lastTotal) {
        toast.error(`O valor (${newTotal.toLocaleString("pt-BR")}) é menor que a última leitura (${lastTotal.toLocaleString("pt-BR")}). Verifique o numerador.`);
        return;
      }

      // Warn if daily volume is unusually high (>500)
      const dailyDiff = newTotal - lastTotal;
      if (dailyDiff > 500 && !window.confirm(
        `Atenção: O volume registrado (${dailyDiff.toLocaleString("pt-BR")} impressões desde a última leitura) é muito alto. Deseja continuar?`
      )) {
        return;
      }
    }

    const { error } = await supabase.from("printer_readings").insert({
      equipment_id: equipmentId,
      printer_model: equipmentName,
      date: new Date().toISOString().split("T")[0],
      reading_time: new Date().toISOString(),
      counter: newTotal,
      type: readingType,
      operator_name: profile?.display_name || null,
      copies_bw: copiesBw ? parseInt(copiesBw) : null,
      color_prints: colorPrints ? parseInt(colorPrints) : null,
      bw_prints: bwPrints ? parseInt(bwPrints) : null,
      total_prints: newTotal,
      notes: notes || null,
    });

    if (error) {
      toast.error("Erro ao salvar leitura");
      return;
    }

    // Check toner life alert
    await checkTonerAlert(newTotal);

    toast.success("Leitura registrada!");
    resetForm();
    setShowDialog(false);
    fetchReadings();
  };

  const checkTonerAlert = async (currentTotal: number) => {
    try {
      // Get consumables for this equipment (toner items)
      const { data: consumables } = await supabase
        .from("equipment_consumables")
        .select("name, yield_pages")
        .eq("equipment_id", equipmentId);

      if (!consumables?.length) return;

      // Find last toner change reading
      const lastTonerChange = readings.find(r => r.type === "toner_change");
      const printsSinceToner = lastTonerChange
        ? currentTotal - (lastTonerChange.total_prints || 0)
        : currentTotal;

      for (const cons of consumables) {
        if (cons.yield_pages <= 0) continue;
        const remaining = cons.yield_pages - printsSinceToner;
        if (remaining <= 1000 && remaining > 0) {
          toast.warning(
            `⚠️ ${cons.name} de "${equipmentName}" está próximo do fim: ~${remaining.toLocaleString("pt-BR")} impressões restantes`,
            { duration: 8000 }
          );
        } else if (remaining <= 0) {
          toast.error(
            `🔴 ${cons.name} de "${equipmentName}" ultrapassou o rendimento esperado! Considere a troca.`,
            { duration: 10000 }
          );
        }
      }
    } catch {
      // silently ignore alert errors
    }
  };

  const fmtDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR");
  };

  const fmtTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const fmtNum = (v: number | null) => v != null ? v.toLocaleString("pt-BR") : "—";

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

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setShowDialog(true); }} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Nova Leitura
        </Button>
      </div>

      {/* Readings table */}
      {readings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma leitura registrada para este equipamento</p>
          <p className="text-xs mt-1">Clique em "Nova Leitura" para começar o acompanhamento</p>
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
                  <TableCell>{getTypeBadge(r.type)}</TableCell>
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

      {/* New Reading Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Nova Leitura — {equipmentName}
            </DialogTitle>
            <DialogDescription>
              Registre os contadores atuais da impressora
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de Registro *</Label>
                <Select value={readingType} onValueChange={setReadingType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Leitura Diária</SelectItem>
                    <SelectItem value="toner_change">Troca de Toner/Peça</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operador</Label>
                <Input
                  value={profile?.display_name || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            {/* Fields based on printer type */}
            {printerType === "pb" ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Cópias PB</Label>
                  <Input type="number" placeholder="0" value={copiesBw} onChange={(e) => setCopiesBw(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Impressões PB</Label>
                  <Input type="number" placeholder="0" value={bwPrints} onChange={(e) => setBwPrints(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Total *</Label>
                  <Input type="number" placeholder="0" value={totalPrints} onChange={(e) => setTotalPrints(e.target.value)} />
                </div>
              </div>
            ) : printerType === "color" ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Impr. Cores</Label>
                  <Input type="number" placeholder="0" value={colorPrints} onChange={(e) => setColorPrints(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Impr. Preto</Label>
                  <Input type="number" placeholder="0" value={bwPrints} onChange={(e) => setBwPrints(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Total *</Label>
                  <Input type="number" placeholder="0" value={totalPrints} onChange={(e) => setTotalPrints(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Total de Impressões *</Label>
                <Input type="number" placeholder="0" value={totalPrints} onChange={(e) => setTotalPrints(e.target.value)} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input
                placeholder={readingType === "toner_change" ? "Ex: Trocado toner preto — peça X" : "Observações opcionais..."}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Timestamp info */}
            <div className="rounded-lg bg-muted/50 p-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Data/Hora será registrada automaticamente: {new Date().toLocaleString("pt-BR")}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Registrar Leitura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
