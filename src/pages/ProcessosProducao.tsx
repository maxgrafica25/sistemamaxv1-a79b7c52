import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Clock, Loader2, Factory, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import { StepTypeBadge, STEP_TYPES, type StepType } from "@/components/orcamentos-v2/StepTypeBadge";

// ─── Types ───────────────────────────────────────────────────────────
interface Step {
  id: string;
  description: string;
  time_minutes: number;
  step_type: StepType;
}

interface GroupItem {
  id: string;
  description: string;
  time_minutes: number;
  sort_order: number;
  step_type: StepType;
}

interface StepGroup {
  id: string;
  name: string;
  items: GroupItem[];
}

// ─── Tab config ──────────────────────────────────────────────────────
const tabConfig = [
  { key: "etapas", label: "Etapas", icon: Clock, color: "text-blue-500" },
  { key: "grupos", label: "Grupos de Etapas", icon: Layers, color: "text-emerald-500" },
] as const;

type TabKey = typeof tabConfig[number]["key"];

export default function ProcessosProducao() {
  const [activeTab, setActiveTab] = useState<TabKey>("etapas");

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Factory className="h-6 w-6 text-primary" />
          Processos de Produção
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie etapas individuais e grupos de etapas reutilizáveis</p>
      </div>

      {/* Tabs styled like Equipamentos */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabConfig.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-[3px] -mb-px ${
              activeTab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${activeTab === t.key ? "bg-primary" : "bg-muted-foreground/40"}`} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "etapas" && <EtapasTab />}
      {activeTab === "grupos" && <GruposTab />}
    </div>
  );
}

// ─── Etapas Tab ──────────────────────────────────────────────────────
function EtapasTab() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [description, setDescription] = useState("");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [stepType, setStepType] = useState<StepType>("outro");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSteps = async () => {
    setLoading(true);
    const { data } = await supabase.from("production_steps").select("*").order("created_at");
    if (data) setSteps(data as Step[]);
    setLoading(false);
  };

  useEffect(() => { fetchSteps(); }, []);

  const openCreateDialog = () => {
    setEditingStep(null); setDescription(""); setTimeMinutes(""); setStepType("outro");
    setIsDialogOpen(true);
  };

  const openEditDialog = (step: Step) => {
    setEditingStep(step); setDescription(step.description);
    setTimeMinutes(step.time_minutes.toString());
    setStepType(step.step_type ?? "outro");
    setIsDialogOpen(true);
  };

  const saveStep = async () => {
    if (!description.trim()) { toast.error("Preencha a descrição da etapa"); return; }
    const time = parseFloat(timeMinutes);
    if (!time || time <= 0) { toast.error("Informe um tempo válido"); return; }

    if (editingStep) {
      await supabase.from("production_steps").update({ description, time_minutes: time, step_type: stepType }).eq("id", editingStep.id);
      toast.success("Etapa atualizada!");
    } else {
      await supabase.from("production_steps").insert({ description, time_minutes: time, step_type: stepType });
      toast.success("Etapa criada!");
    }
    setIsDialogOpen(false);
    fetchSteps();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    await supabase.from("production_steps").delete().eq("id", deletingId);
    toast.success("Etapa excluída!");
    setDeletingId(null);
    fetchSteps();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{steps.length} etapa(s) cadastrada(s)</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2"><Plus className="h-4 w-4" /> Nova Etapa</Button>
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
              <div className="space-y-2">
                <Label>Categoria do Processo</Label>
                <Select value={stepType} onValueChange={(v) => setStepType(v as StepType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STEP_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveStep} className="w-full">{editingStep ? "Salvar Alterações" : "Criar Etapa"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {steps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">Nenhuma etapa cadastrada ainda</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-32">Categoria</TableHead>
                <TableHead className="w-32 text-center">Tempo (min)</TableHead>
                <TableHead className="w-24 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map(step => (
                <TableRow key={step.id}>
                  <TableCell className="font-medium">{step.description}</TableCell>
                  <TableCell><StepTypeBadge type={step.step_type} /></TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {step.time_minutes}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(step)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeletingId(step.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Excluir Etapa"
        description="Tem certeza que deseja excluir esta etapa?"
        onConfirm={confirmDelete}
      />
    </>
  );
}

// ─── Grupos Tab ──────────────────────────────────────────────────────
function GruposTab() {
  const [groups, setGroups] = useState<StepGroup[]>([]);
  const [availableSteps, setAvailableSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StepGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupSteps, setGroupSteps] = useState<{ id: string; description: string; time_minutes: number; step_type: StepType }[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    const [gRes, iRes, sRes] = await Promise.all([
      supabase.from("step_groups").select("*").order("created_at"),
      supabase.from("step_group_items").select("*").order("sort_order"),
      supabase.from("production_steps").select("*").order("description"),
    ]);
    if (gRes.data && iRes.data) {
      setGroups(gRes.data.map(g => ({
        ...g,
        items: iRes.data.filter(i => i.step_group_id === g.id) as GroupItem[],
      })) as StepGroup[]);
    }
    if (sRes.data) setAvailableSteps(sRes.data as Step[]);
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const openNewGroupDialog = () => {
    setEditingGroup(null); setGroupName("");
    setGroupSteps([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (group: StepGroup) => {
    setEditingGroup(group); setGroupName(group.name);
    setGroupSteps(group.items.map(i => ({ id: i.id, description: i.description, time_minutes: i.time_minutes, step_type: (i.step_type ?? "outro") as StepType })));
    setIsDialogOpen(true);
  };

  const addExistingStep = (step: Step) => {
    setGroupSteps(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, description: step.description, time_minutes: step.time_minutes, step_type: step.step_type ?? "outro" }]);
  };

  const addBlankStep = () => setGroupSteps(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, description: "", time_minutes: 0, step_type: "outro" }]);
  const removeStep = (id: string) => setGroupSteps(groupSteps.filter(s => s.id !== id));
  const updateStep = (id: string, field: string, value: string | number) =>
    setGroupSteps(groupSteps.map(s => s.id === id ? { ...s, [field]: value } : s));

  const saveGroup = async () => {
    if (!groupName.trim()) { toast.error("Digite um nome para o grupo"); return; }
    if (groupSteps.length === 0 || groupSteps.some(s => !s.description.trim())) {
      toast.error("Adicione pelo menos uma etapa válida"); return;
    }

    if (editingGroup) {
      await supabase.from("step_groups").update({ name: groupName }).eq("id", editingGroup.id);
      await supabase.from("step_group_items").delete().eq("step_group_id", editingGroup.id);
      await supabase.from("step_group_items").insert(
        groupSteps.map((s, i) => ({ step_group_id: editingGroup.id, description: s.description, time_minutes: s.time_minutes, step_type: s.step_type, sort_order: i }))
      );
      toast.success("Grupo atualizado!");
    } else {
      const { data } = await supabase.from("step_groups").insert({ name: groupName }).select("id").single();
      if (data) {
        await supabase.from("step_group_items").insert(
          groupSteps.map((s, i) => ({ step_group_id: data.id, description: s.description, time_minutes: s.time_minutes, step_type: s.step_type, sort_order: i }))
        );
      }
      toast.success("Grupo criado!");
    }
    setIsDialogOpen(false);
    fetchGroups();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    await supabase.from("step_groups").delete().eq("id", deletingId);
    toast.success("Grupo excluído!");
    setDeletingId(null);
    fetchGroups();
  };

  const getTotalTime = (items: GroupItem[]) => items.reduce((sum, i) => sum + i.time_minutes, 0);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{groups.length} grupo(s) cadastrado(s)</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewGroupDialog} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Grupo
            </Button>
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
                  <Button variant="outline" size="sm" onClick={addBlankStep} className="gap-2"><Plus className="h-4 w-4" /> Nova Etapa Manual</Button>
                </div>

                {/* Picker for existing steps */}
                {availableSteps.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Selecionar etapa existente:</Label>
                    <div className="flex flex-wrap gap-2">
                      {availableSteps.map(s => (
                        <Button
                          key={s.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addExistingStep(s)}
                          className="gap-1.5 text-xs"
                        >
                          <Plus className="h-3 w-3" />
                          {s.description} ({s.time_minutes} min)
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {groupSteps.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Selecione etapas existentes acima ou crie uma nova etapa manual
                  </p>
                )}

                {groupSteps.map((step, idx) => (
                  <div key={step.id} className="flex gap-2 items-start">
                    <span className="flex h-10 w-7 items-center justify-center text-xs font-medium text-muted-foreground">{idx + 1}</span>
                    <div className="flex-1"><Input placeholder="Descrição da etapa" value={step.description} onChange={(e) => updateStep(step.id, "description", e.target.value)} /></div>
                    <div className="w-36">
                      <Select value={step.step_type} onValueChange={(v) => updateStep(step.id, "step_type", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STEP_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24"><Input type="number" placeholder="Min" value={step.time_minutes || ""} onChange={(e) => updateStep(step.id, "time_minutes", parseFloat(e.target.value) || 0)} /></div>
                    <Button variant="ghost" size="icon" onClick={() => removeStep(step.id)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={saveGroup} className="flex-1">{editingGroup ? "Atualizar Grupo" : "Criar Grupo"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">Nenhum grupo cadastrado ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.id}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h3 className="font-semibold text-foreground">{group.name}</h3>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                    <Clock className="h-3.5 w-3.5" /> {getTotalTime(group.items)} minutos totais · {group.items.length} etapa(s)
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(group)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary"><Edit2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeletingId(group.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-32">Categoria</TableHead>
                      <TableHead className="w-32 text-center">Tempo (min)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-center">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary mx-auto">{index + 1}</span>
                        </TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell><StepTypeBadge type={item.step_type} /></TableCell>
                        <TableCell className="text-center text-muted-foreground">{item.time_minutes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Excluir Grupo"
        description="Tem certeza que deseja excluir este grupo de etapas?"
        onConfirm={confirmDelete}
      />
    </>
  );
}
