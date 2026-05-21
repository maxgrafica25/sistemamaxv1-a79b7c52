import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import PageLoader from "@/components/PageLoader";

interface Step {
  id: string;
  description: string;
  time_minutes: number;
}

export default function Etapas() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [description, setDescription] = useState("");
  const [timeMinutes, setTimeMinutes] = useState("");
  const { requireAdmin } = usePermissionGuard();

  const fetchSteps = async () => {
    setLoading(true);
    const { data } = await supabase.from("production_steps").select("*").order("created_at");
    if (data) setSteps(data);
    setLoading(false);
  };

  useEffect(() => { fetchSteps(); }, []);

  const openCreateDialog = () => {
    setEditingStep(null); setDescription(""); setTimeMinutes("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (step: Step) => {
    setEditingStep(step); setDescription(step.description);
    setTimeMinutes(step.time_minutes.toString());
    setIsDialogOpen(true);
  };

  const saveStep = async () => {
    if (!description.trim()) { toast.error("Preencha a descrição da etapa"); return; }
    const time = parseFloat(timeMinutes);
    if (!time || time <= 0) { toast.error("Informe um tempo válido"); return; }
    if (!requireAdmin(editingStep ? "atualizar etapa" : "criar etapa")) return;

    if (editingStep) {
      const { error } = await supabase.from("production_steps").update({ description, time_minutes: time }).eq("id", editingStep.id);
      if (error) return handleError(error, "atualizar etapa");
      toast.success("Etapa atualizada!");
    } else {
      const { error } = await supabase.from("production_steps").insert({ description, time_minutes: time });
      if (error) return handleError(error, "criar etapa");
      toast.success("Etapa criada!");
    }
    setIsDialogOpen(false);
    fetchSteps();
  };

  const deleteStep = async (id: string) => {
    if (!requireAdmin("excluir etapa")) return;
    const { error } = await supabase.from("production_steps").delete().eq("id", id);
    if (error) return handleError(error, "excluir etapa");
    toast.success("Etapa excluída!");
    fetchSteps();
  };

  if (loading) { return <PageLoader />; }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Etapas de Produção</h1>
          <p className="mt-1 text-muted-foreground">Cadastre as etapas individuais para usar nos orçamentos</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <span>
              <AdminOnly mode="disable" action="criar etapa">
                <Button onClick={openCreateDialog} className="gap-2"><Plus className="h-4 w-4" /> Nova Etapa</Button>
              </AdminOnly>
            </span>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingStep ? "Editar Etapa" : "Nova Etapa"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Descrição da Etapa</Label>
                <Input placeholder="Ex: Preparação de arquivo" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tempo Estimado (minutos)</Label>
                <Input type="number" placeholder="Ex: 15" value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)} />
              </div>
              <Button onClick={saveStep} className="w-full">{editingStep ? "Salvar Alterações" : "Criar Etapa"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {steps.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">Nenhuma etapa cadastrada ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.id} className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{step.description}</CardTitle>
                  <div className="flex gap-1">
                    <AdminOnly mode="disable" action="editar etapa">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(step)} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                    </AdminOnly>
                    <AdminOnly mode="disable" action="excluir etapa">
                      <Button variant="ghost" size="icon" onClick={() => deleteStep(step.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </AdminOnly>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">{step.time_minutes} minutos</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
