import { PageHeader } from "@/components/PageHeader";
import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { stepSchema, stepGroupSchema, zodErrorsToMap } from "@/lib/schemas/cadastros";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Clock, Loader2, Factory, Layers, Sparkles, Settings, Scissors } from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import { StepTypeBadge, type StepType } from "@/components/orcamentos-v3/shared/StepTypeBadge";
import { useStepCategories } from "@/hooks/useStepCategories";
import { DotTabs } from "@/components/ui/dot-tabs";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import PageLoader from "@/components/PageLoader";
import CategoriasTab from "@/pages/processos-producao/CategoriasTab";
import GruposMateriais from "@/pages/GruposMateriais";
import KitsProduto, { type KitsProdutoHandle } from "@/pages/KitsProduto";
import Acabamentos from "@/pages/Acabamentos";

// ─── Types ───────────────────────────────────────────────────────────
interface Step {
  id: string;
  description: string;
  time_minutes: number;
  step_type: StepType;
  step_group_id: string | null;
}

interface GroupItem {
  id: string;
  production_step_id: string;
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
  { key: "acabamentos", label: "Acabamentos" },
  { key: "grupos", label: "Grupos de Etapas" },
  { key: "grupos-materiais", label: "Grupos de Materiais" },
  { key: "kits", label: "Kits de Produto" },
] as const;

type TabKey = typeof tabConfig[number]["key"];

const tabDescriptions: Record<TabKey, { icon: typeof Clock; text: ReactNode }> = {
  acabamentos: {
    icon: Scissors,
    text: (
      <>
        Tabela de <strong>preços por folha</strong> dos acabamentos (recorte, laminação, verniz…).
        Cada acabamento pode ter <strong>faixas por quantidade de folhas</strong> da tiragem —
        a calculadora escolhe automaticamente a faixa correspondente. Sem faixas, usa o preço base.
      </>
    ),
  },
  grupos: {
    icon: Layers,
    text: "Agrupe várias etapas em uma sequência reutilizável — útil para detalhar o passo-a-passo de uma etapa no orçamento.",
  },
  "grupos-materiais": {
    icon: Layers,
    text: "Conjuntos de materiais (papéis, insumos) que podem ser referenciados em conjunto nos orçamentos.",
  },
  kits: {
    icon: Sparkles,
    text: "Combinações pré-montadas de etapas + materiais que viram atalhos para criar orçamentos rapidamente.",
  },
};

export default function ProcessosProducao() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRaw = searchParams.get("tab");
  const initial = (tabConfig.some((t) => t.key === initialRaw) ? initialRaw : "acabamentos") as TabKey;
  const [activeTab, setActiveTab] = useState<TabKey>(initial);
  const [categoriasOpen, setCategoriasOpen] = useState(initialRaw === "categorias");
  const kitsRef = useRef<KitsProdutoHandle>(null);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (activeTab === "acabamentos") next.delete("tab");
    else next.set("tab", activeTab);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <PageHeader icon={Factory} title="Produção" description="Etapas, acabamentos, grupos e kits que compõem como cada produto é fabricado." />
        <div className="flex items-center gap-2">
          {activeTab === "kits" && (
            <AdminOnly>
              <Button onClick={() => kitsRef.current?.openNew()} className="gap-2">
                <Plus className="h-4 w-4" /> Novo Kit
              </Button>
            </AdminOnly>
          )}
          <AdminOnly>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCategoriasOpen(true)}
              title="Gerenciar categorias"
              aria-label="Gerenciar categorias"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </AdminOnly>
        </div>
      </div>

      <DotTabs
        tabs={tabConfig}
        value={activeTab}
        onChange={(k) => setActiveTab(k as TabKey)}
        className="mb-3"
      />

      {(() => {
        const d = tabDescriptions[activeTab];
        const Icon = d.icon;
        return (
          <p className="mb-4 flex items-start gap-2 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{d.text}</span>
          </p>
        );
      })()}

      {activeTab === "acabamentos" && <Acabamentos hideHeader />}
      {false && <EtapasTab />}
      {activeTab === "grupos" && <GruposTab />}
      {activeTab === "grupos-materiais" && <GruposMateriais hideHeader />}
      {activeTab === "kits" && <KitsProduto ref={kitsRef} hideHeader />}

      <Dialog open={categoriasOpen} onOpenChange={setCategoriasOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Categorias de processos</DialogTitle>
          </DialogHeader>
          <CategoriasTab />
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ─── Etapas Tab ──────────────────────────────────────────────────────
function EtapasTab() {
  const { data: categories } = useStepCategories();
  const [steps, setSteps] = useState<Step[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [description, setDescription] = useState("");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [stepType, setStepType] = useState<StepType>("outro");
  const [stepGroupId, setStepGroupId] = useState<string>("none");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSteps = async () => {
    setLoading(true);
    const [sRes, gRes] = await Promise.all([
      supabase.from("production_steps").select("*").order("created_at"),
      supabase.from("step_groups").select("id, name").order("name"),
    ]);
    if (sRes.data) setSteps(sRes.data as Step[]);
    if (gRes.data) setGroups(gRes.data as { id: string; name: string }[]);
    setLoading(false);
  };

  useEffect(() => { fetchSteps(); }, []);

  const openCreateDialog = () => {
    setEditingStep(null); setDescription(""); setTimeMinutes(""); setStepType("outro");
    setStepGroupId("none");
    setIsDialogOpen(true);
  };

  const openEditDialog = (step: Step) => {
    setEditingStep(step); setDescription(step.description);
    setTimeMinutes(step.time_minutes.toString());
    setStepType(step.step_type ?? "outro");
    setStepGroupId(step.step_group_id ?? "none");
    setIsDialogOpen(true);
  };

  const stepValidation = useMemo(() => {
    const time = parseFloat(timeMinutes);
    const parsed = stepSchema.safeParse({
      description,
      time_minutes: Number.isFinite(time) ? time : NaN,
    });
    return {
      valid: parsed.success,
      errors: parsed.success ? {} : zodErrorsToMap(parsed.error),
    };
  }, [description, timeMinutes]);

  const { requireAdmin } = usePermissionGuard();

  const saveStep = async () => {
    if (!requireAdmin(editingStep ? "editar etapa" : "criar etapa")) return;
    if (!description.trim()) { toast.error("Preencha a descrição da etapa"); return; }
    const time = parseFloat(timeMinutes);
    if (!time || time <= 0) { toast.error("Informe um tempo válido"); return; }
    const groupIdValue = stepGroupId === "none" ? null : stepGroupId;

    if (editingStep) {
      const { error } = await supabase.from("production_steps").update({ description, time_minutes: time, step_type: stepType, step_group_id: groupIdValue }).eq("id", editingStep.id);
      if (error) return handleError(error, "atualizar etapa");
      toast.success("Etapa atualizada!");
    } else {
      const { error } = await supabase.from("production_steps").insert({ description, time_minutes: time, step_type: stepType, step_group_id: groupIdValue });
      if (error) return handleError(error, "criar etapa");
      toast.success("Etapa criada!");
    }
    setIsDialogOpen(false);
    fetchSteps();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    if (!requireAdmin("excluir etapa")) { setDeletingId(null); return; }
    const { error } = await supabase.from("production_steps").delete().eq("id", deletingId);
    if (error) { handleError(error, "excluir etapa"); setDeletingId(null); return; }
    toast.success("Etapa excluída!");
    setDeletingId(null);
    fetchSteps();
  };

  if (loading) { return <PageLoader />; }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{steps.length} etapa(s) cadastrada(s)</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <AdminOnly mode="disable" action="criar etapa">
              <Button onClick={openCreateDialog} className="gap-2"><Plus className="h-4 w-4" /> Nova Etapa</Button>
            </AdminOnly>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingStep ? "Editar Etapa" : "Nova Etapa"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Descrição da Etapa</Label>
                <Input placeholder="Ex: Preparação de arquivo" value={description} onChange={(e) => setDescription(e.target.value)} />
                {stepValidation.errors.description && (
                  <p className="text-xs text-destructive">{stepValidation.errors.description}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Tempo Estimado (minutos)</Label>
                <Input type="number" placeholder="Ex: 15" value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)} />
                {stepValidation.errors.time_minutes && (
                  <p className="text-xs text-destructive">{stepValidation.errors.time_minutes}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Categoria do Processo</Label>
                <Select value={stepType} onValueChange={(v) => setStepType(v as StepType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.slug}>
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grupo de Etapas (detalhamento) — opcional</Label>
                <Select value={stepGroupId} onValueChange={setStepGroupId}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Quando preenchido, o orçamento mostra o passo-a-passo do grupo dentro desta etapa.
                </p>
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
  const [groupSteps, setGroupSteps] = useState<{ uid: string; production_step_id: string }[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const stepById = new Map(availableSteps.map((s) => [s.id, s]));

  const fetchGroups = async () => {
    setLoading(true);
    const [gRes, iRes, sRes] = await Promise.all([
      supabase.from("step_groups").select("*").order("created_at"),
      supabase
        .from("step_group_items")
        .select("id, step_group_id, sort_order, production_step_id, production_step:production_steps(id, description, time_minutes, step_type)")
        .order("sort_order"),
      supabase.from("production_steps").select("*").order("description"),
    ]);
    if (gRes.data && iRes.data) {
      const items = (iRes.data as any[])
        .filter((i) => i.production_step)
        .map((i): GroupItem & { step_group_id: string } => ({
          id: i.id,
          step_group_id: i.step_group_id,
          production_step_id: i.production_step_id,
          description: i.production_step.description,
          time_minutes: Number(i.production_step.time_minutes) || 0,
          sort_order: i.sort_order,
          step_type: (i.production_step.step_type ?? "outro") as StepType,
        }));
      setGroups(gRes.data.map(g => ({
        ...g,
        items: items.filter(i => i.step_group_id === g.id),
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
    setGroupSteps(group.items.map(i => ({ uid: i.id, production_step_id: i.production_step_id })));
    setIsDialogOpen(true);
  };

  const addExistingStep = (step: Step) => {
    setGroupSteps(prev => [...prev, { uid: `${Date.now()}-${Math.random()}`, production_step_id: step.id }]);
  };

  const removeStep = (uid: string) => setGroupSteps(groupSteps.filter(s => s.uid !== uid));

  const { requireAdmin } = usePermissionGuard();

  const saveGroup = async () => {
    if (!requireAdmin(editingGroup ? "editar grupo" : "criar grupo")) return;
    if (!groupName.trim()) { toast.error("Digite um nome para o grupo"); return; }
    if (groupSteps.length === 0) {
      toast.error("Adicione pelo menos uma etapa"); return;
    }

    if (editingGroup) {
      const r1 = await supabase.from("step_groups").update({ name: groupName }).eq("id", editingGroup.id);
      if (r1.error) return handleError(r1.error, "atualizar grupo");
      const r2 = await supabase.from("step_group_items").delete().eq("step_group_id", editingGroup.id);
      if (r2.error) return handleError(r2.error, "atualizar itens do grupo");
      const r3 = await supabase.from("step_group_items").insert(
        groupSteps.map((s, i) => ({ step_group_id: editingGroup.id, production_step_id: s.production_step_id, sort_order: i }))
      );
      if (r3.error) return handleError(r3.error, "salvar itens do grupo");
      toast.success("Grupo atualizado!");
    } else {
      const { data, error } = await supabase.from("step_groups").insert({ name: groupName }).select("id").single();
      if (error) return handleError(error, "criar grupo");
      if (data) {
        const r = await supabase.from("step_group_items").insert(
          groupSteps.map((s, i) => ({ step_group_id: data.id, production_step_id: s.production_step_id, sort_order: i }))
        );
        if (r.error) return handleError(r.error, "salvar itens do grupo");
      }
      toast.success("Grupo criado!");
    }
    setIsDialogOpen(false);
    fetchGroups();
  };


  const confirmDelete = async () => {
    if (!deletingId) return;
    if (!requireAdmin("excluir grupo")) { setDeletingId(null); return; }
    const { error } = await supabase.from("step_groups").delete().eq("id", deletingId);
    if (error) { handleError(error, "excluir grupo"); setDeletingId(null); return; }
    toast.success("Grupo excluído!");
    setDeletingId(null);
    fetchGroups();
  };

  const getTotalTime = (items: GroupItem[]) => items.reduce((sum, i) => sum + i.time_minutes, 0);

  if (loading) { return <PageLoader />; }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{groups.length} grupo(s) cadastrado(s)</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <AdminOnly mode="disable" action="criar grupo de etapas">
              <Button onClick={openNewGroupDialog} className="gap-2">
                <Plus className="h-4 w-4" /> Novo Grupo
              </Button>
            </AdminOnly>
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
                  <span className="text-xs text-muted-foreground">
                    Use apenas Etapas cadastradas na aba "Etapas".
                  </span>
                </div>

                {availableSteps.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma Etapa cadastrada. Cadastre na aba "Etapas" antes de montar grupos.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Adicionar Etapa:</Label>
                    <Select value="" onValueChange={(id) => {
                      const s = stepById.get(id);
                      if (s) addExistingStep(s);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Selecionar etapa..." /></SelectTrigger>
                      <SelectContent>
                        {availableSteps.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.description} ({s.time_minutes} min)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {groupSteps.length === 0 && availableSteps.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Selecione uma etapa acima para adicionar ao grupo.
                  </p>
                )}

                {groupSteps.map((s, idx) => {
                  const ps = stepById.get(s.production_step_id);
                  return (
                    <div key={s.uid} className="flex gap-2 items-center">
                      <span className="flex h-10 w-7 items-center justify-center text-xs font-medium text-muted-foreground">{idx + 1}</span>
                      <div className="flex-1 text-sm">
                        {ps ? `${ps.description} · ${ps.time_minutes} min` : "(etapa removida)"}
                      </div>
                      {ps && <StepTypeBadge type={ps.step_type} />}
                      <Button variant="ghost" size="icon" onClick={() => removeStep(s.uid)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  );
                })}
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
