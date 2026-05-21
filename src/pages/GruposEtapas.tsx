import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Edit, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import PageLoader from "@/components/PageLoader";

interface GroupItem {
  id: string;
  description: string;
  time_minutes: number;
  sort_order: number;
}

interface StepGroup {
  id: string;
  name: string;
  items: GroupItem[];
}

export default function GruposEtapas() {
  const [groups, setGroups] = useState<StepGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StepGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupSteps, setGroupSteps] = useState<{ id: string; description: string; time_minutes: number }[]>([]);
  const { requireAdmin } = usePermissionGuard();

  const fetchGroups = async () => {
    setLoading(true);
    const [gRes, iRes] = await Promise.all([
      supabase.from("step_groups").select("*").order("created_at"),
      supabase.from("step_group_items").select("*").order("sort_order"),
    ]);
    if (gRes.data && iRes.data) {
      const mapped = gRes.data.map(g => ({
        ...g,
        items: iRes.data.filter(i => i.step_group_id === g.id),
      }));
      setGroups(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const openNewGroupDialog = () => {
    setEditingGroup(null); setGroupName("");
    setGroupSteps([{ id: Date.now().toString(), description: "", time_minutes: 0 }]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (group: StepGroup) => {
    setEditingGroup(group); setGroupName(group.name);
    setGroupSteps(group.items.map(i => ({ id: i.id, description: i.description, time_minutes: i.time_minutes })));
    setIsDialogOpen(true);
  };

  const addStep = () => setGroupSteps([...groupSteps, { id: Date.now().toString(), description: "", time_minutes: 0 }]);
  const removeStep = (id: string) => setGroupSteps(groupSteps.filter(s => s.id !== id));
  const updateStep = (id: string, field: string, value: string | number) =>
    setGroupSteps(groupSteps.map(s => s.id === id ? { ...s, [field]: value } : s));

  const saveGroup = async () => {
    if (!groupName.trim()) { toast.error("Digite um nome para o grupo"); return; }
    if (groupSteps.length === 0 || groupSteps.some(s => !s.description.trim())) {
      toast.error("Adicione pelo menos uma etapa válida"); return;
    }
    if (!requireAdmin(editingGroup ? "atualizar grupo de etapas" : "criar grupo de etapas")) return;

    if (editingGroup) {
      const { error: updErr } = await supabase.from("step_groups").update({ name: groupName }).eq("id", editingGroup.id);
      if (updErr) return handleError(updErr, "atualizar grupo de etapas");
      const { error: delErr } = await supabase.from("step_group_items").delete().eq("step_group_id", editingGroup.id);
      if (delErr) return handleError(delErr, "atualizar etapas do grupo");
      const { error: insErr } = await supabase.from("step_group_items").insert(
        groupSteps.map((s, i) => ({ step_group_id: editingGroup.id, description: s.description, time_minutes: s.time_minutes, sort_order: i }))
      );
      if (insErr) return handleError(insErr, "atualizar etapas do grupo");
      toast.success("Grupo atualizado!");
    } else {
      const { data, error } = await supabase.from("step_groups").insert({ name: groupName }).select("id").single();
      if (error) return handleError(error, "criar grupo de etapas");
      if (data) {
        const { error: insErr } = await supabase.from("step_group_items").insert(
          groupSteps.map((s, i) => ({ step_group_id: data.id, description: s.description, time_minutes: s.time_minutes, sort_order: i }))
        );
        if (insErr) return handleError(insErr, "salvar etapas do grupo");
      }
      toast.success("Grupo criado!");
    }
    setIsDialogOpen(false);
    fetchGroups();
  };

  const deleteGroup = async (id: string) => {
    if (!requireAdmin("excluir grupo de etapas")) return;
    const { error } = await supabase.from("step_groups").delete().eq("id", id);
    if (error) return handleError(error, "excluir grupo de etapas");
    toast.success("Grupo excluído!");
    fetchGroups();
  };

  const getTotalTime = (items: GroupItem[]) => items.reduce((sum, i) => sum + i.time_minutes, 0);

  if (loading) { return <PageLoader />; }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Grupos de Etapas</h1>
          <p className="mt-1 text-muted-foreground">Templates de mão de obra reutilizáveis</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <span>
              <AdminOnly mode="disable" action="criar grupo de etapas">
                <Button size="lg" className="gap-2 bg-accent hover:bg-accent-hover" onClick={openNewGroupDialog}>
                  <Plus className="h-5 w-5" /> Novo Grupo
                </Button>
              </AdminOnly>
            </span>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingGroup ? "Editar Grupo de Etapas" : "Novo Grupo de Etapas"}</DialogTitle></DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label>Nome do Grupo *</Label>
                <Input placeholder="Ex: Impressão Digital A3" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Etapas de Produção *</Label>
                  <Button variant="outline" size="sm" onClick={addStep} className="gap-2"><Plus className="h-4 w-4" /> Adicionar Etapa</Button>
                </div>
                {groupSteps.map((step) => (
                  <div key={step.id} className="flex gap-3 items-start">
                    <div className="flex-1"><Input placeholder="Descrição da etapa" value={step.description} onChange={(e) => updateStep(step.id, "description", e.target.value)} /></div>
                    <div className="w-40"><Input type="number" placeholder="Minutos" value={step.time_minutes || ""} onChange={(e) => updateStep(step.id, "time_minutes", parseFloat(e.target.value) || 0)} /></div>
                    <Button variant="ghost" size="icon" onClick={() => removeStep(step.id)} className="text-destructive hover:bg-destructive/10" disabled={groupSteps.length === 1}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={saveGroup} className="flex-1 bg-accent hover:bg-accent-hover">{editingGroup ? "Atualizar Grupo" : "Criar Grupo"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum grupo cadastrado. Clique em "Novo Grupo" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.id} className="shadow-card">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" /> {getTotalTime(group.items)} minutos totais
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <AdminOnly mode="disable" action="editar grupo">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(group)} className="hover:bg-primary/10 hover:text-primary"><Edit className="h-4 w-4" /></Button>
                    </AdminOnly>
                    <AdminOnly mode="disable" action="excluir grupo">
                      <Button variant="ghost" size="icon" onClick={() => deleteGroup(group.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </AdminOnly>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.items.map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">{index + 1}</span>
                        {item.description}
                      </span>
                      <span className="text-muted-foreground">{item.time_minutes} min</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
