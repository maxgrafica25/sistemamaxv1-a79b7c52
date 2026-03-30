import { useState, useEffect } from "react";
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
import { Plus, Trash2, Edit2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  created_at: string;
}

interface Props {
  equipmentId: string;
  equipmentName: string;
  printerType: string;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const typeLabel = (t: string) => {
  switch (t) {
    case "preventiva": return "Preventiva";
    case "corretiva": return "Corretiva";
    default: return t;
  }
};

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

export default function MaintenanceTab({ equipmentId, equipmentName, printerType }: Props) {
  const [records, setRecords] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);

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

  const hasCounter = printerType === "pb" || printerType === "color";

  const fetchRecords = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("equipment_maintenances")
      .select("*")
      .eq("equipment_id", equipmentId)
      .order("date", { ascending: false });
    if (data) setRecords(data as Maintenance[]);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [equipmentId]);

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
    } else {
      setEditing(null);
      setDate(new Date().toISOString().split("T")[0]);
      setMaintenanceType("preventiva");
      setTechnician("");
      setTotalCounter("");
      setHoursSpent("0");
      setCost("0");
      setReplacedParts("");
      setServiceDescription("");
      setNotes("");
    }
    setShowDialog(true);
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
    };

    if (editing) {
      await supabase.from("equipment_maintenances").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("equipment_maintenances").insert(payload);
    }
    setShowDialog(false);
    toast.success("Manutenção salva!");
    fetchRecords();
  };

  const remove = async (id: string) => {
    await supabase.from("equipment_maintenances").delete().eq("id", id);
    toast.success("Registro removido!");
    fetchRecords();
  };

  // Stats
  const totalCost = records.reduce((s, r) => s + Number(r.cost), 0);
  const totalHours = records.reduce((s, r) => s + Number(r.hours_spent), 0);
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
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Peças Substituídas</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
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
                      <TableCell className="text-right font-mono text-sm">{Number(r.hours_spent).toFixed(1)}h</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(Number(r.cost))}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate" title={r.replaced_parts || ""}>
                        {r.replaced_parts || "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={r.service_description}>
                        {r.service_description}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
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

      {/* Dialog */}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
