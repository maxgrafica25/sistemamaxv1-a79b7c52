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
import { Plus, AlertTriangle, User, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Props {
  equipmentId: string;
  equipmentName: string;
}

interface Loss {
  id: string;
  equipment_id: string;
  operator_name: string;
  quantity: number;
  error_type: string;
  description: string;
  date: string;
  created_at: string;
}

export default function ProductionLossesTab({ equipmentId, equipmentName }: Props) {
  const { profile } = useAuth();
  const [losses, setLosses] = useState<Loss[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form
  const [quantity, setQuantity] = useState("1");
  const [errorType, setErrorType] = useState("operational");
  const [description, setDescription] = useState("");

  // Delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState("");

  const fetchLosses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("production_losses")
      .select("*")
      .eq("equipment_id", equipmentId)
      .order("created_at", { ascending: false });
    if (error) handleError(error, "carregar perdas");
    if (data) setLosses(data as Loss[]);
    setLoading(false);
  };

  useEffect(() => { fetchLosses(); }, [equipmentId]);

  const stats = useMemo(() => {
    if (!losses.length) return null;
    const totalQty = losses.reduce((s, l) => s + l.quantity, 0);
    const operational = losses.filter(l => l.error_type === "operational").reduce((s, l) => s + l.quantity, 0);
    const equipment = losses.filter(l => l.error_type === "equipment").reduce((s, l) => s + l.quantity, 0);
    return { totalQty, operational, equipment, count: losses.length };
  }, [losses]);

  const resetForm = () => {
    setQuantity("1");
    setErrorType("operational");
    setDescription("");
  };

  const handleSave = async () => {
    if (!description.trim()) return toast.error("Descreva o ocorrido");

    setIsSaving(true);
    const { error } = await supabase.from("production_losses").insert({
      equipment_id: equipmentId,
      operator_name: profile?.display_name || "Desconhecido",
      quantity: parseInt(quantity) || 1,
      error_type: errorType,
      description: description.trim(),
    });
    setIsSaving(false);

    if (error) return handleError(error, "registrar perda");
    toast.success("Perda registrada!");
    resetForm();
    setShowDialog(false);
    fetchLosses();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const { error } = await supabase.from("production_losses").delete().eq("id", deleteId);
    setIsDeleting(false);
    if (error) return handleError(error, "remover registro");
    toast.success("Registro removido");
    setConfirmOpen(false);
    fetchLosses();
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total de Perdas</p>
              <p className="text-lg font-bold text-foreground">{stats.totalQty}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Erro Operacional</p>
              <p className="text-lg font-bold text-foreground">{stats.operational}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Erro de Equipamento</p>
              <p className="text-lg font-bold text-foreground">{stats.equipment}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-muted-foreground">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Registros</p>
              <p className="text-lg font-bold text-foreground">{stats.count}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setShowDialog(true); }} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Registrar Perda
        </Button>
      </div>

      {/* Table */}
      {losses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma perda registrada para este equipamento</p>
          <p className="text-xs mt-1">Clique em "Registrar Perda" para documentar ocorrências</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {losses.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm whitespace-nowrap">{fmtDate(l.date)}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {l.operator_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {l.error_type === "operational" ? (
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">Operacional</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Equipamento</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">{l.quantity}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{l.description}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeleteId(l.id); setConfirmOpen(true); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Registrar Perda — {equipmentName}
            </DialogTitle>
            <DialogDescription>
              Documente a perda para análise e melhoria contínua
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Operador</Label>
                <Input value={profile?.display_name || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Quantidade *</Label>
                <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Erro *</Label>
              <Select value={errorType} onValueChange={setErrorType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Erro Operacional (do operador)</SelectItem>
                  <SelectItem value="equipment">Erro de Equipamento (da máquina)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição do Ocorrido *</Label>
              <Input placeholder="Descreva o que aconteceu..." value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSaving ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir registro de perda"
        description="Tem certeza que deseja excluir este registro?"
        onConfirm={handleDelete}
      />
    </div>
  );
}
