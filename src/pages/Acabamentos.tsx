import { useEffect, useMemo, useState } from "react";
import { Scissors, Plus, Trash2, Edit2, Save, X, Search, Layers, Copy, Clock, GripVertical } from "lucide-react";
import { FinishingTiersDrawer } from "@/components/acabamentos/FinishingTiersDrawer";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SIZES = ["A4", "A3", "SRA3", "33x48"] as const;
const CATEGORIES = [
  { value: "recorte", label: "Recorte plotter" },
  { value: "laminacao", label: "Laminação" },
  { value: "verniz", label: "Verniz" },
  { value: "outro", label: "Outro" },
];

const DEFAULT_APPLIES_TO = ["etiqueta", "impressao"];
type PricingModel = "per_sheet" | "per_unit";
type FormMode = "per_sheet" | "per_unit" | "time_only";

const detectFormMode = (item: { pricing_model: PricingModel; price_per_sheet: number; time_minutes: number }): FormMode => {
  if (item.price_per_sheet === 0 && item.time_minutes > 0) return "time_only";
  return item.pricing_model;
};

interface FinishingItem {
  id: string;
  name: string;
  category: string;
  size: string | null;
  price_per_sheet: number;
  pricing_model: PricingModel;
  applies_to: string[];
  unit_label: string | null;
  is_active: boolean;
  sort_order: number;
  production_step_id: string | null;
  time_minutes: number;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const emptyDraft: Omit<FinishingItem, "id"> = {
  name: "",
  category: "recorte",
  size: "SRA3",
  price_per_sheet: 0,
  pricing_model: "per_sheet",
  applies_to: DEFAULT_APPLIES_TO,
  unit_label: null,
  is_active: true,
  sort_order: 0,
  production_step_id: null,
  time_minutes: 0,
};

export default function Acabamentos({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const isAdmin = useIsAdmin();
  const { requireAdmin } = usePermissionGuard();
  const [items, setItems] = useState<FinishingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSize, setFilterSize] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<typeof emptyDraft & { id?: string }>(emptyDraft);
  const [formMode, setFormMode] = useState<FormMode>("per_sheet");
  const [editing, setEditing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tiersFor, setTiersFor] = useState<FinishingItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const reload = async () => {
    setLoading(true);
    const itemsRes = await (supabase as any)
      .from("finishings_price_items")
      .select("*")
      .order("sort_order");
    if (itemsRes.error) {
      toast.error("Falha ao carregar acabamentos");
    } else {
      setItems((itemsRes.data ?? []) as FinishingItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const filtersActive =
    filterSize !== "all" || filterCategory !== "all" || search.trim() !== "";

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filterSize !== "all" && i.size !== filterSize) return false;
      if (filterCategory !== "all" && i.category !== filterCategory) return false;
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filterSize, filterCategory, search]);

  const startNew = () => {
    setDraft({
      ...emptyDraft,
      sort_order: (items[items.length - 1]?.sort_order ?? 0) + 1,
    });
    setEditing(true);
  };

  const startEdit = (item: FinishingItem) => {
    setDraft({ ...item });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(emptyDraft);
  };

  const save = async () => {
    if (!requireAdmin("salvar acabamento")) return;
    if (!draft.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (draft.price_per_sheet < 0) {
      toast.error("Preço não pode ser negativo");
      return;
    }
    if (draft.pricing_model === "per_sheet" && !draft.size) {
      toast.error("Modelo por folha exige selecionar o tamanho");
      return;
    }

    const payload = {
      name: draft.name.trim(),
      category: draft.category,
      size: draft.pricing_model === "per_unit" ? null : draft.size,
      price_per_sheet: draft.price_per_sheet,
      pricing_model: draft.pricing_model,
      applies_to: DEFAULT_APPLIES_TO,
      unit_label:
        draft.pricing_model === "per_unit"
          ? draft.unit_label?.trim() || "unidade"
          : null,
      is_active: draft.is_active,
      sort_order: draft.sort_order,
      production_step_id: draft.production_step_id,
      time_minutes: Math.max(0, Math.round(draft.time_minutes || 0)),
    };
    let error;
    if (draft.id) {
      ({ error } = await (supabase as any)
        .from("finishings_price_items")
        .update(payload)
        .eq("id", draft.id));
    } else {
      ({ error } = await (supabase as any)
        .from("finishings_price_items")
        .insert(payload));
    }
    if (error) return handleError(error, "salvar acabamento");
    toast.success(draft.id ? "Acabamento atualizado" : "Acabamento cadastrado");
    cancelEdit();
    reload();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    if (!requireAdmin("remover acabamento")) {
      setDeleteId(null);
      return;
    }
    const { error } = await (supabase as any)
      .from("finishings_price_items")
      .delete()
      .eq("id", deleteId);
    if (error) {
      handleError(error, "remover acabamento");
    } else {
      toast.success("Acabamento removido");
      reload();
    }
    setDeleteId(null);
  };

  const toggleActive = async (item: FinishingItem) => {
    if (!requireAdmin("alterar status do acabamento")) return;
    const { error } = await (supabase as any)
      .from("finishings_price_items")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) {
      handleError(error, "alterar status do acabamento");
    } else {
      reload();
    }
  };

  const cloneItem = async (item: FinishingItem) => {
    if (!requireAdmin("clonar acabamento")) return;
    const { data: inserted, error: insErr } = await (supabase as any)
      .from("finishings_price_items")
      .insert({
        name: `${item.name} (cópia)`,
        category: item.category,
        size: item.size,
        price_per_sheet: item.price_per_sheet,
        pricing_model: item.pricing_model,
        applies_to: DEFAULT_APPLIES_TO,
        unit_label: item.unit_label,
        is_active: item.is_active,
        sort_order: (items[items.length - 1]?.sort_order ?? 0) + 1,
        production_step_id: null,
        time_minutes: item.time_minutes,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      handleError(insErr ?? new Error("Falha ao clonar"), "clonar acabamento");
      return;
    }
    const { data: tiers } = await (supabase as any)
      .from("finishing_price_tiers")
      .select("label, min_qty, max_qty, price_per_sheet, sort_order")
      .eq("finishing_id", item.id);
    if (tiers && tiers.length > 0) {
      const payload = tiers.map((t: any) => ({
        finishing_id: inserted.id,
        label: t.label,
        min_qty: t.min_qty,
        max_qty: t.max_qty,
        price_per_sheet: t.price_per_sheet,
        sort_order: t.sort_order,
      }));
      const { error: tErr } = await (supabase as any)
        .from("finishing_price_tiers")
        .insert(payload);
      if (tErr) {
        handleError(tErr, "clonar faixas");
        return;
      }
    }
    toast.success("Acabamento clonado — ajuste os preços");
    reload();
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (!isAdmin) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      sort_order: idx + 1,
    }));
    setItems(reordered); // optimistic

    // Persist new orders
    const updates = await Promise.all(
      reordered.map((it) =>
        (supabase as any)
          .from("finishings_price_items")
          .update({ sort_order: it.sort_order })
          .eq("id", it.id)
      )
    );
    const failed = updates.find((u: any) => u.error);
    if (failed) {
      handleError(failed.error, "reordenar acabamentos");
      reload();
    }
  };

  const canDrag = isAdmin && !filtersActive;

  return (
    <div className={hideHeader ? "space-y-6" : "p-4 md:p-6 space-y-6"}>
      {!hideHeader && (
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Scissors className="h-6 w-6 text-primary" />
            Acabamentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastro único de acabamentos. Cobre por folha (recorte, laminação,
            verniz…) ou por unidade. Arraste as linhas para reordenar.
          </p>
        </header>
      )}

      {/* Form modal */}
      {isAdmin && (
        <Dialog open={editing} onOpenChange={(o) => !o && cancelEdit()}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {draft.id ? "Editar acabamento" : "Novo acabamento"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ex.: Laminação BOPP brilho"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Select
                    value={draft.category}
                    onValueChange={(v) => setDraft({ ...draft, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Modelo de cobrança</Label>
                  <Select
                    value={draft.pricing_model}
                    onValueChange={(v: PricingModel) =>
                      setDraft({
                        ...draft,
                        pricing_model: v,
                        size: v === "per_unit" ? null : draft.size ?? "SRA3",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_sheet">Por folha</SelectItem>
                      <SelectItem value="per_unit">Por unidade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {draft.pricing_model === "per_sheet" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tamanho da folha</Label>
                    <Select
                      value={draft.size ?? ""}
                      onValueChange={(v) => setDraft({ ...draft, size: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div /> /* spacer */
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Preço por {draft.pricing_model === "per_sheet" ? "folha" : "unidade"} (R$)
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.10"
                    min={0}
                    value={draft.price_per_sheet}
                    onChange={(e) =>
                      setDraft({ ...draft, price_per_sheet: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tempo de execução (minutos)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={draft.time_minutes}
                    onChange={(e) =>
                      setDraft({ ...draft, time_minutes: parseInt(e.target.value, 10) || 0 })
                    }
                    placeholder="Ex.: 10"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Tempo de mão de obra. Deixe 0 se o acabamento não tem
                    execução manual associada.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ativo</Label>
                  <div className="flex items-center h-10">
                    <Switch
                      checked={draft.is_active}
                      onCheckedChange={(c) => setDraft({ ...draft, is_active: c })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={cancelEdit}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button onClick={save}>
                <Save className="h-4 w-4 mr-1" /> Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Filtros + ação */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome…"
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterSize} onValueChange={setFilterSize}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tamanhos</SelectItem>
            {SIZES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Button onClick={startNew} className="ml-auto">
            <Plus className="h-4 w-4 mr-1" /> Novo acabamento
          </Button>
        )}
      </div>

      {isAdmin && filtersActive && (
        <p className="text-[11px] text-muted-foreground">
          Reordenação por arrasto desativada enquanto há filtros ou busca ativos.
        </p>
      )}

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {canDrag && <TableHead className="w-[36px]" />}
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Cobrança</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="w-[80px]">Ativo</TableHead>
                {isAdmin && <TableHead className="w-[160px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? (canDrag ? 7 : 6) : 5} className="text-center text-muted-foreground py-8">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? (canDrag ? 7 : 6) : 5} className="text-center text-muted-foreground py-8">
                    Nenhum acabamento cadastrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : canDrag ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={filtered.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {filtered.map((item) => (
                      <SortableFinishingRow
                        key={item.id}
                        item={item}
                        isAdmin={isAdmin}
                        onEdit={startEdit}
                        onClone={cloneItem}
                        onDelete={(id) => setDeleteId(id)}
                        onToggleActive={toggleActive}
                        onOpenTiers={setTiersFor}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                filtered.map((item) => (
                  <FinishingRow
                    key={item.id}
                    item={item}
                    isAdmin={isAdmin}
                    onEdit={startEdit}
                    onClone={cloneItem}
                    onDelete={(id) => setDeleteId(id)}
                    onToggleActive={toggleActive}
                    onOpenTiers={setTiersFor}
                    showDragHandle={false}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Remover acabamento?"
        description="Esta ação não pode ser desfeita. A calculadora deixará de oferecer este item."
        confirmText="Remover"
      />

      <FinishingTiersDrawer
        open={!!tiersFor}
        onOpenChange={(o) => !o && setTiersFor(null)}
        finishingId={tiersFor?.id ?? null}
        finishingName={tiersFor?.name ?? ""}
        basePrice={tiersFor?.price_per_sheet ?? 0}
        onSaved={reload}
      />
    </div>
  );
}

// ─── Row components ──────────────────────────────────────────────────

interface RowProps {
  item: FinishingItem;
  isAdmin: boolean;
  onEdit: (item: FinishingItem) => void;
  onClone: (item: FinishingItem) => void;
  onDelete: (id: string) => void;
  onToggleActive: (item: FinishingItem) => void;
  onOpenTiers: (item: FinishingItem) => void;
  showDragHandle?: boolean;
  dragHandleProps?: {
    attributes: any;
    listeners: any;
  };
}

function FinishingRow({
  item,
  isAdmin,
  onEdit,
  onClone,
  onDelete,
  onToggleActive,
  onOpenTiers,
  showDragHandle = false,
  dragHandleProps,
}: RowProps) {
  const unit =
    item.pricing_model === "per_sheet"
      ? `/folha ${item.size ?? ""}`.trim()
      : `/${item.unit_label || "unidade"}`;
  return (
    <TableRow className={!item.is_active ? "opacity-50" : ""}>
      {showDragHandle && (
        <TableCell className="w-[36px] p-2">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            aria-label="Arrastar para reordenar"
            {...(dragHandleProps?.attributes ?? {})}
            {...(dragHandleProps?.listeners ?? {})}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </TableCell>
      )}
      <TableCell className="font-medium">
        <span className="inline-flex items-center gap-1.5">
          {item.name}
          {item.time_minutes > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
              title={`Tempo de execução: ${item.time_minutes} min`}
            >
              <Clock className="h-3 w-3" />
              {item.time_minutes}m
            </span>
          )}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-xs">
          {CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {item.pricing_model === "per_sheet" ? "Por folha" : "Por unidade"}
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">
        {fmt(item.price_per_sheet)}
        <span className="text-[10px] font-normal text-muted-foreground ml-1">
          {unit}
        </span>
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <Switch
            checked={item.is_active}
            onCheckedChange={() => onToggleActive(item)}
          />
        ) : (
          <Badge variant={item.is_active ? "default" : "secondary"} className="text-xs">
            {item.is_active ? "Sim" : "Não"}
          </Badge>
        )}
      </TableCell>
      {isAdmin && (
        <TableCell>
          <div className="flex gap-1">
            {item.pricing_model === "per_sheet" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenTiers(item)}
                title="Faixas por quantidade"
              >
                <Layers className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onClone(item)}
              title="Clonar acabamento (mesmas faixas)"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(item)}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

function SortableFinishingRow(props: Omit<RowProps, "showDragHandle" | "dragHandleProps">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <tr ref={setNodeRef} style={style} className={!props.item.is_active ? "opacity-50" : ""}>
      <td className="w-[36px] p-2">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          aria-label="Arrastar para reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <RowCells {...props} />
    </tr>
  );
}

function RowCells({
  item,
  isAdmin,
  onEdit,
  onClone,
  onDelete,
  onToggleActive,
  onOpenTiers,
}: Omit<RowProps, "showDragHandle" | "dragHandleProps">) {
  const unit =
    item.pricing_model === "per_sheet"
      ? `/folha ${item.size ?? ""}`.trim()
      : `/${item.unit_label || "unidade"}`;
  return (
    <>
      <TableCell className="font-medium">
        <span className="inline-flex items-center gap-1.5">
          {item.name}
          {item.time_minutes > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
              title={`Tempo de execução: ${item.time_minutes} min`}
            >
              <Clock className="h-3 w-3" />
              {item.time_minutes}m
            </span>
          )}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-xs">
          {CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {item.pricing_model === "per_sheet" ? "Por folha" : "Por unidade"}
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">
        {fmt(item.price_per_sheet)}
        <span className="text-[10px] font-normal text-muted-foreground ml-1">
          {unit}
        </span>
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <Switch
            checked={item.is_active}
            onCheckedChange={() => onToggleActive(item)}
          />
        ) : (
          <Badge variant={item.is_active ? "default" : "secondary"} className="text-xs">
            {item.is_active ? "Sim" : "Não"}
          </Badge>
        )}
      </TableCell>
      {isAdmin && (
        <TableCell>
          <div className="flex gap-1">
            {item.pricing_model === "per_sheet" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenTiers(item)}
                title="Faixas por quantidade"
              >
                <Layers className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onClone(item)}
              title="Clonar acabamento (mesmas faixas)"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(item)}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      )}
    </>
  );
}
