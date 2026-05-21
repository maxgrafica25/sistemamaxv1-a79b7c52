import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Printer, Wrench, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { handleError } from "@/lib/handleError";
import PageLoader from "@/components/PageLoader";

interface PrinterReading {
  id: string;
  printer_model: string;
  date: string;
  counter: number;
  color_prints: number | null;
  bw_prints: number | null;
  total_prints: number | null;
  type: string;
  notes: string | null;
}

const getTypeBadge = (type: string) => {
  switch (type) {
    case "daily": return <Badge variant="outline" className="gap-1"><Printer className="h-3 w-3" />Diário</Badge>;
    case "toner_change": return <Badge className="gap-1 bg-blue-500 hover:bg-blue-600"><Package className="h-3 w-3" />Troca Toner</Badge>;
    case "maintenance": return <Badge className="gap-1 bg-orange-500 hover:bg-orange-600"><Wrench className="h-3 w-3" />Manutenção</Badge>;
    default: return <Badge>{type}</Badge>;
  }
};

export default function LeituraImpressoras() {
  const [readings, setReadings] = useState<PrinterReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [readingType, setReadingType] = useState("daily");
  const [counter, setCounter] = useState("");
  const [colorPrints, setColorPrints] = useState("");
  const [bwPrints, setBwPrints] = useState("");
  const [totalPrints, setTotalPrints] = useState("");
  const [notes, setNotes] = useState("");
  const [filterPrinter, setFilterPrinter] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const fetchReadings = async () => {
    setLoading(true);
    const { data } = await supabase.from("printer_readings").select("*").order("date", { ascending: false });
    if (data) setReadings(data);
    setLoading(false);
  };

  useEffect(() => { fetchReadings(); }, []);

  const printerModels = useMemo(() => {
    const models = new Set(readings.map(r => r.printer_model));
    return Array.from(models).sort();
  }, [readings]);

  const handleAddReading = async () => {
    if (!selectedPrinter || !counter) { toast.error("Preencha todos os campos obrigatórios"); return; }
    const { error } = await supabase.from("printer_readings").insert({
      printer_model: selectedPrinter,
      date: new Date().toISOString().split("T")[0],
      counter: parseInt(counter),
      color_prints: colorPrints ? parseInt(colorPrints) : null,
      bw_prints: bwPrints ? parseInt(bwPrints) : null,
      total_prints: totalPrints ? parseInt(totalPrints) : null,
      type: readingType,
      notes: notes || null,
    });
    if (error) return handleError(error, "registrar leitura");
    toast.success("Leitura registrada!");
    setSelectedPrinter(""); setCounter(""); setColorPrints(""); setBwPrints("");
    setTotalPrints(""); setNotes(""); setReadingType("daily");
    setShowDialog(false);
    fetchReadings();
  };

  const filteredReadings = readings.filter((r) => {
    const matchesPrinter = filterPrinter === "all" || r.printer_model === filterPrinter;
    const matchesType = filterType === "all" || r.type === filterType;
    return matchesPrinter && matchesType;
  });

  const printerStats = useMemo(() => {
    return printerModels.map(model => {
      const modelReadings = readings.filter(r => r.printer_model === model);
      const sorted = [...modelReadings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastReading = sorted[0];
      const lastTonerChange = sorted.find(r => r.type === "toner_change");
      const counterSinceLastToner = lastTonerChange && lastReading ? lastReading.counter - lastTonerChange.counter : lastReading?.counter || 0;
      return { model, lastCounter: lastReading?.counter || 0, lastDate: lastReading?.date, counterSinceLastToner };
    });
  }, [readings, printerModels]);

  if (loading) { return <PageLoader />; }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leitura de Impressoras</h1>
          <p className="mt-1 text-muted-foreground">Registre e acompanhe os contadores das impressoras</p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => setShowDialog(true)}>
          <Plus className="h-5 w-5" /> Nova Leitura
        </Button>
      </div>

      {printerStats.length > 0 && (
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {printerStats.map((stat) => (
            <Card key={stat.model} className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-3"><Printer className="h-6 w-6 text-primary" /></div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{stat.model}</h3>
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="text-muted-foreground">Último contador: <span className="font-medium text-foreground">{stat.lastCounter.toLocaleString()}</span></p>
                      {stat.lastDate && <p className="text-muted-foreground">Última leitura: {new Date(stat.lastDate).toLocaleDateString("pt-BR")}</p>}
                      <p className="text-muted-foreground">Desde último toner: <span className="font-medium text-foreground">{stat.counterSinceLastToner.toLocaleString()}</span></p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-6 flex gap-4">
        <Select value={filterPrinter} onValueChange={setFilterPrinter}>
          <SelectTrigger className="w-[250px]"><SelectValue placeholder="Filtrar por impressora" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Impressoras</SelectItem>
            {printerModels.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrar por tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            <SelectItem value="daily">Leitura Diária</SelectItem>
            <SelectItem value="toner_change">Troca de Toner/Peça</SelectItem>
            <SelectItem value="maintenance">Manutenção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card">
        <CardHeader><CardTitle>Histórico de Leituras</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm font-medium text-muted-foreground">
                  <th className="pb-3 pl-4">Data</th><th className="pb-3">Impressora</th><th className="pb-3">Tipo</th><th className="pb-3">Contador</th><th className="pb-3 pr-4">Observações</th>
                </tr>
              </thead>
              <tbody>
                {filteredReadings.map((reading) => (
                  <tr key={reading.id} className="border-b border-border last:border-0 transition-colors hover:bg-muted/50">
                    <td className="py-4 pl-4 text-sm text-foreground">{new Date(reading.date).toLocaleDateString("pt-BR")}</td>
                    <td className="py-4 text-sm text-foreground">{reading.printer_model}</td>
                    <td className="py-4">{getTypeBadge(reading.type)}</td>
                    <td className="py-4 text-sm font-medium text-foreground">{reading.counter.toLocaleString()}</td>
                    <td className="py-4 pr-4 text-sm text-muted-foreground">{reading.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Registrar Nova Leitura</DialogTitle>
            <DialogDescription>Registre o contador da impressora no momento atual</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Modelo da Impressora *</Label>
              <Input placeholder="Ex: HP LaserJet Pro M404" value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Registro *</Label>
              <Select value={readingType} onValueChange={setReadingType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Leitura Diária</SelectItem>
                  <SelectItem value="toner_change">Troca de Toner/Peça</SelectItem>
                  <SelectItem value="maintenance">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Numerador/Contador *</Label>
              <Input type="number" placeholder="Ex: 12450" value={counter} onChange={(e) => setCounter(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Impressões Coloridas</Label><Input type="number" placeholder="Ex: 150" value={colorPrints} onChange={(e) => setColorPrints(e.target.value)} /></div>
              <div className="space-y-2"><Label>Impressões PB</Label><Input type="number" placeholder="Ex: 300" value={bwPrints} onChange={(e) => setBwPrints(e.target.value)} /></div>
              <div className="space-y-2"><Label>Total</Label><Input type="number" placeholder="Ex: 450" value={totalPrints} onChange={(e) => setTotalPrints(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Observações</Label><Input placeholder="Ex: Troca de toner preto..." value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddReading}>Registrar Leitura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
