import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Sparkles,
  Copy,
  MoreHorizontal,
  Package,
  Cog,
  ChevronDown,
  Layers,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  type KitItemRole,
  type KitQuantityFormula,
  SPIRAL_VARIANT_PRESET,
} from "@/components/orcamentos-v3/shared/productKit";
import AddItemsPicker, { type PickedItem } from "@/components/kits/AddItemsPicker";
import KitHowItWorks from "@/components/kits/KitHowItWorks";
import VariantsDialog, { type VariantRow } from "@/components/kits/VariantsDialog";

interface KitItem {
  id?: string;
  tmp_id: string;
  position: number;
  item_type: "supply" | "process";
  supply_id: string | null;
  supply_label: string;
  process_step_id: string | null;
  process_label: string;
  role: KitItemRole;
  alternative_group: string;
  quantity_formula: KitQuantityFormula;
  quantity_value: number;
  auto_select_default: boolean;
  notes: string;
  variants: VariantRow[];
}

interface KitRow {
  id: string;
  name: string;
  product_kind: string;
  description: string | null;
  is_active: boolean;
  item_count: number;
  preset_ids: string[];
}

interface PresetOption {
  id: string;
  nome: string;
  icone: string;
}

// Mapeia nome do preset → product_kind legado (compat com fetchers antigos).
const PRESET_NAME_TO_KIND: Record<string, string> = {
  "Cartão de Visita": "cartao_visita",
  Apostila: "apostila",
  Etiqueta: "etiqueta",
  "Folheto / Flyer": "folheto",
  Adesivo: "adesivo",
  Banner: "banner",
  Lona: "lona",
  Faixa: "faixa",
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const FORMULA_LABELS: Record<KitQuantityFormula, string> = {
  per_unit: "Por unidade",
  per_sheet: "Por folha (× unidades)",
  per_x_sheets: "A cada X folhas",
  per_perimeter_m: "Por metro de perímetro",
  per_m2: "Por m²",
  fixed: "Quantidade fixa",
  auto_spiral: "Espiral automática (legado)",
  variant_by_sheets: "Variante por nº de folhas",
};

const ROLE_LABELS: Record<KitItemRole, string> = {
  required: "Obrigatório",
  optional: "Opcional",
  alternative: "Alternativo",
};

const ROLE_SHORT: Record<KitItemRole, string> = {
  required: "Obrig.",
  optional: "Opc.",
  alternative: "Alt.",
};

const tmp = () => `tmp_${Math.random().toString(36).slice(2, 9)}`;

interface ProcessOption {
  id: string;
  description: string;
}

function formulaBadge(it: KitItem): string {
  switch (it.quantity_formula) {
    case "per_unit":
      return `× ${it.quantity_value} / un`;
    case "per_sheet":
      return `× ${it.quantity_value} / folha`;
    case "per_x_sheets":
      return `1 a cada ${it.quantity_value} folhas`;
    case "per_perimeter_m":
      return `× ${it.quantity_value} / m perím.`;
    case "per_m2":
      return `× ${it.quantity_value} / m²`;
    case "fixed":
      return `fixo ${it.quantity_value}`;
    case "auto_spiral":
      return `auto espiral`;
    case "variant_by_sheets":
      return `variante · ${it.variants.length} faixa${it.variants.length === 1 ? "" : "s"}`;
  }
}

export default function KitsProduto() {
  const { requireAdmin } = usePermissionGuard();
  const [kits, setKits] = useState<KitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processes, setProcesses] = useState<ProcessOption[]>([]);
  const [availablePresets, setAvailablePresets] = useState<PresetOption[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState("");
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<KitItem[]>([]);

  // Sub-dialogs
  const [pickerOpen, setPickerOpen] = useState(false);
  const [variantsEditing, setVariantsEditing] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [kitsRes, itemsRes, procRes] = await Promise.all([
      supabase
        .from("product_kits")
        .select("id, name, product_kind, description, is_active")
        .order("product_kind")
        .order("name"),
      supabase.from("product_kit_items").select("kit_id"),
      supabase.from("production_steps").select("id, description").order("description"),
    ]);
    if (kitsRes.error) handleError(kitsRes.error, "carregar kits");
    if (procRes.error) handleError(procRes.error, "carregar processos");
    const counts = new Map<string, number>();
    (itemsRes.data || []).forEach((i: any) => {
      counts.set(i.kit_id, (counts.get(i.kit_id) || 0) + 1);
    });
    setKits(
      (kitsRes.data || []).map((k: any) => ({
        id: k.id,
        name: k.name,
        product_kind: k.product_kind,
        description: k.description,
        is_active: !!k.is_active,
        item_count: counts.get(k.id) || 0,
      })),
    );
    setProcesses((procRes.data || []) as ProcessOption[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setProductKind("apostila");
    setDescription("");
    setIsActive(true);
    setItems([]);
  };

  const openNew = () => {
    if (!requireAdmin("gerenciar kits de produto")) return;
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = async (kitId: string) => {
    if (!requireAdmin("gerenciar kits de produto")) return;
    const k = kits.find((x) => x.id === kitId);
    if (!k) return;
    const [{ data: itemsData }, { data: supList }] = await Promise.all([
      supabase
        .from("product_kit_items")
        .select("*")
        .eq("kit_id", kitId)
        .order("position"),
      supabase.from("supplies").select("id, produto"),
    ]);
    const supMap = new Map<string, string>(
      (supList || []).map((s: any) => [s.id, s.produto]),
    );
    const procMap = new Map<string, string>(processes.map((p) => [p.id, p.description]));
    const itemIdList = (itemsData || []).map((i: any) => i.id);
    const variantsByItem = new Map<string, any[]>();
    if (itemIdList.length > 0) {
      const { data: vars } = await supabase
        .from("product_kit_item_variants")
        .select("*")
        .in("item_id", itemIdList)
        .order("position");
      for (const v of (vars || []) as any[]) {
        const arr = variantsByItem.get(v.item_id) || [];
        arr.push(v);
        variantsByItem.set(v.item_id, arr);
      }
    }
    setEditingId(kitId);
    setName(k.name);
    setProductKind(k.product_kind);
    setDescription(k.description ?? "");
    setIsActive(k.is_active);
    setItems(
      (itemsData || []).map((i: any, idx: number) => ({
        id: i.id,
        tmp_id: tmp(),
        position: i.position ?? idx,
        item_type: i.item_type,
        supply_id: i.supply_id,
        supply_label: i.supply_id ? supMap.get(i.supply_id) ?? "" : "",
        process_step_id: i.process_step_id,
        process_label: i.process_step_id ? procMap.get(i.process_step_id) ?? "" : "",
        role: i.role,
        alternative_group: i.alternative_group ?? "",
        quantity_formula: i.quantity_formula,
        quantity_value: Number(i.quantity_value) || 1,
        auto_select_default: !!i.auto_select_default,
        notes: i.notes ?? "",
        variants: (variantsByItem.get(i.id) || []).map((v: any) => ({
          tmp_id: tmp(),
          min_value: Number(v.min_value) || 0,
          max_value: v.max_value == null ? null : Number(v.max_value),
          supply_id: v.supply_id,
          supply_label: v.supply_id ? supMap.get(v.supply_id) ?? "" : "",
          label: v.label ?? "",
        })),
      })),
    );
    setDialogOpen(true);
  };

  const duplicateKit = async (kitId: string) => {
    if (!requireAdmin("gerenciar kits de produto")) return;
    await openEdit(kitId);
    setEditingId(null);
    setName((n) => `${n} (cópia)`);
  };

  const handlePickerConfirm = (picked: PickedItem[]) => {
    setItems((prev) => {
      const start = prev.length;
      const added: KitItem[] = picked.map((p, i) => ({
        tmp_id: tmp(),
        position: start + i,
        item_type: p.kind,
        supply_id: p.kind === "supply" ? p.id : null,
        supply_label: p.kind === "supply" ? p.label : "",
        process_step_id: p.kind === "process" ? p.id : null,
        process_label: p.kind === "process" ? p.label : "",
        role: "required",
        alternative_group: "",
        quantity_formula: "per_unit",
        quantity_value: 1,
        auto_select_default: true,
        notes: "",
        variants: [],
      }));
      return [...prev, ...added];
    });
  };

  const addSpiralByVariant = () => {
    const newTmpId = tmp();
    setItems((prev) => [
      ...prev,
      {
        tmp_id: newTmpId,
        position: prev.length,
        item_type: "supply",
        supply_id: null,
        supply_label: "Encadernação espiral",
        process_step_id: null,
        process_label: "",
        role: "required",
        alternative_group: "",
        quantity_formula: "variant_by_sheets",
        quantity_value: 1,
        auto_select_default: true,
        notes: "",
        variants: SPIRAL_VARIANT_PRESET.map((p) => ({
          tmp_id: tmp(),
          min_value: p.min,
          max_value: p.max,
          supply_id: null,
          supply_label: "",
          label: p.label,
        })),
      },
    ]);
    setVariantsEditing(newTmpId);
    toast.success("Selecione o suprimento de cada faixa. Você faz isso uma vez e reusa nos próximos kits.");

  };

  const updateItem = (tmp_id: string, patch: Partial<KitItem>) => {
    setItems((prev) => prev.map((i) => (i.tmp_id === tmp_id ? { ...i, ...patch } : i)));
  };

  const removeItem = (tmp_id: string) => {
    setItems((prev) =>
      prev.filter((i) => i.tmp_id !== tmp_id).map((i, idx) => ({ ...i, position: idx })),
    );
  };

  const moveItem = (tmp_id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.tmp_id === tmp_id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy.map((i, k) => ({ ...i, position: k }));
    });
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Informe o nome do kit.";
    if (!productKind.trim()) return "Informe o tipo de produto.";
    if (items.length === 0) return "Adicione pelo menos um item ao kit.";
    for (const it of items) {
      if (
        it.item_type === "supply" &&
        !it.supply_id &&
        it.quantity_formula !== "auto_spiral" &&
        it.quantity_formula !== "variant_by_sheets"
      ) {
        return "Selecione o suprimento de todos os itens (ou use uma fórmula automática).";
      }
      if (it.item_type === "supply" && it.quantity_formula === "variant_by_sheets") {
        if (it.variants.length === 0) {
          return "Adicione pelo menos uma faixa de variante por nº de folhas.";
        }
        if (it.variants.some((v) => !v.supply_id)) {
          return "Selecione o suprimento de cada faixa de variante.";
        }
      }
      if (it.item_type === "process" && !it.process_step_id) {
        return "Selecione o processo de todos os itens de mão-de-obra.";
      }
      if (it.role === "alternative" && !it.alternative_group.trim()) {
        return "Itens alternativos precisam de um nome de grupo (ex.: 'capa').";
      }
    }
    const altCounts: Record<string, number> = {};
    items.forEach((i) => {
      if (i.role === "alternative") {
        altCounts[i.alternative_group] = (altCounts[i.alternative_group] || 0) + 1;
      }
    });
    for (const [g, c] of Object.entries(altCounts)) {
      if (c < 2) return `Grupo de alternativas "${g}" precisa de pelo menos 2 itens.`;
    }
    return null;
  };

  const save = async () => {
    if (!requireAdmin("gerenciar kits de produto")) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    const payload = {
      name: name.trim(),
      product_kind: productKind.trim().toLowerCase(),
      description: description.trim() || null,
      is_active: isActive,
    };

    try {
      let kitId = editingId;
      if (kitId) {
        const { error } = await supabase.from("product_kits").update(payload).eq("id", kitId);
        if (error) throw error;
        await supabase.from("product_kit_items").delete().eq("kit_id", kitId);
      } else {
        const { data: ures } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("product_kits")
          .insert({ ...payload, created_by: ures.user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        kitId = data.id;
      }

      const itemsPayload = items.map((i, idx) => ({
        kit_id: kitId!,
        position: idx,
        item_type: i.item_type,
        supply_id: i.item_type === "supply" ? i.supply_id : null,
        process_step_id: i.item_type === "process" ? i.process_step_id : null,
        role: i.role,
        alternative_group: i.role === "alternative" ? i.alternative_group.trim() : null,
        quantity_formula: i.quantity_formula,
        quantity_value: Number(i.quantity_value) || 1,
        auto_select_default: i.auto_select_default,
        notes: i.notes.trim() || null,
      }));
      if (itemsPayload.length > 0) {
        const { data: inserted, error: ie } = await supabase
          .from("product_kit_items")
          .insert(itemsPayload)
          .select("id, position")
          .order("position");
        if (ie) throw ie;
        const idByPos = new Map<number, string>();
        (inserted || []).forEach((row: any) => idByPos.set(row.position, row.id));
        const variantsPayload: any[] = [];
        items.forEach((i, idx) => {
          if (i.quantity_formula !== "variant_by_sheets") return;
          const newId = idByPos.get(idx);
          if (!newId) return;
          i.variants.forEach((v, vIdx) => {
            variantsPayload.push({
              item_id: newId,
              position: vIdx,
              min_value: Number(v.min_value) || 0,
              max_value:
                v.max_value == null || isNaN(Number(v.max_value))
                  ? null
                  : Number(v.max_value),
              supply_id: v.supply_id,
              label: v.label.trim() || null,
            });
          });
        });
        if (variantsPayload.length > 0) {
          const { error: ve } = await supabase
            .from("product_kit_item_variants")
            .insert(variantsPayload);
          if (ve) throw ve;
        }
      }
      toast.success(editingId ? "Kit atualizado." : "Kit criado.");
      setDialogOpen(false);
      resetForm();
      fetchAll();
    } catch (e) {
      handleError(e, "salvar kit");
    }
  };

  const remove = async () => {
    if (!deletingId) return;
    if (!requireAdmin("gerenciar kits de produto")) return;
    const { error } = await supabase.from("product_kits").delete().eq("id", deletingId);
    if (error) {
      handleError(error, "excluir kit");
      return;
    }
    toast.success("Kit excluído.");
    setDeletingId(null);
    fetchAll();
  };

  const toggleActive = async (k: KitRow) => {
    if (!requireAdmin("gerenciar kits de produto")) return;
    const { error } = await supabase
      .from("product_kits")
      .update({ is_active: !k.is_active })
      .eq("id", k.id);
    if (error) {
      handleError(error, "alternar kit");
      return;
    }
    fetchAll();
  };

  const grouped = useMemo(() => {
    const map = new Map<string, KitRow[]>();
    for (const k of kits) {
      const arr = map.get(k.product_kind) || [];
      arr.push(k);
      map.set(k.product_kind, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [kits]);

  // Agrupar itens: normais individualmente, alternativos agrupados por nome
  const renderedItems = useMemo(() => {
    type Block =
      | { kind: "item"; item: KitItem; index: number }
      | { kind: "alt-group"; group: string; items: { item: KitItem; index: number }[] };
    const blocks: Block[] = [];
    const altSeen = new Map<string, number>();
    items.forEach((it, idx) => {
      if (it.role === "alternative" && it.alternative_group.trim()) {
        const g = it.alternative_group.trim();
        const at = altSeen.get(g);
        if (at == null) {
          const bIdx = blocks.length;
          blocks.push({ kind: "alt-group", group: g, items: [{ item: it, index: idx }] });
          altSeen.set(g, bIdx);
        } else {
          (blocks[at] as any).items.push({ item: it, index: idx });
        }
      } else {
        blocks.push({ kind: "item", item: it, index: idx });
      }
    });
    return blocks;
  }, [items]);

  const variantItem = variantsEditing
    ? items.find((i) => i.tmp_id === variantsEditing)
    : null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Kits de Produto</h1>
            <p className="text-sm text-muted-foreground">
              Materiais e processos sugeridos automaticamente por tipo de produto no orçamento.
            </p>
          </div>
        </div>
        <AdminOnly>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Novo Kit
          </Button>
        </AdminOnly>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum kit cadastrado. Crie um kit para que o orçamento sugira itens automaticamente.
          </CardContent>
        </Card>
      ) : (
        grouped.map(([kind, list]) => (
          <div key={kind} className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground">{kind}</h2>
              <Badge variant="outline">{list.length}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {list.map((k) => (
                <Card key={k.id} className={k.is_active ? "" : "opacity-60"}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{k.name}</p>
                        <p className="text-xs text-muted-foreground">{k.item_count} itens</p>
                      </div>
                      <Switch checked={k.is_active} onCheckedChange={() => toggleActive(k)} />
                    </div>
                    {k.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{k.description}</p>
                    )}
                    <div className="flex gap-1 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(k.id)}>
                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => duplicateKit(k.id)}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeletingId(k.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <DialogTitle>{editingId ? "Editar Kit" : "Novo Kit"}</DialogTitle>
          </DialogHeader>

          {/* Cabeçalho enxuto */}
          <div className="px-5 py-3 border-b space-y-3 bg-muted/20">
            <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
              <div>
                <Label className="text-xs">Nome do kit</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Kit Encadernação Apostila"
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Tipo de produto</Label>
                <Input
                  list="kit-kinds"
                  value={productKind}
                  onChange={(e) => setProductKind(e.target.value)}
                  placeholder="ex.: apostila"
                  className="h-9"
                />
                <datalist id="kit-kinds">
                  {KIND_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={isActive} onCheckedChange={setIsActive} id="kit-active" />
                <Label htmlFor="kit-active" className="text-xs">Ativo</Label>
              </div>
            </div>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground -ml-2">
                  <ChevronDown className="h-3.5 w-3.5 mr-1" /> Descrição (opcional)
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Quando aplicar este kit?"
                  className="mt-1"
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Lista de itens */}
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
            <KitHowItWorks />

            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Itens do kit ({items.length})
              </h3>
            </div>
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed py-10 text-center">
                <Layers className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum item ainda. Use os botões abaixo para adicionar
                  acabamentos ou encadernação espiral.
                </p>
              </div>
            ) : (
              renderedItems.map((b, bi) =>
                b.kind === "item" ? (
                  <CompactItemRow
                    key={b.item.tmp_id}
                    item={b.item}
                    index={b.index}
                    total={items.length}
                    processes={processes}
                    onChange={(p) => updateItem(b.item.tmp_id, p)}
                    onRemove={() => removeItem(b.item.tmp_id)}
                    onMove={(d) => moveItem(b.item.tmp_id, d)}
                    onEditVariants={() => setVariantsEditing(b.item.tmp_id)}
                  />
                ) : (
                  <div
                    key={`alt-${bi}`}
                    className="rounded-md border border-primary/30 bg-primary/5 p-2 space-y-1.5"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary px-1">
                      Alternativos · grupo "{b.group}"
                    </p>
                    {b.items.map(({ item, index }) => (
                      <CompactItemRow
                        key={item.tmp_id}
                        item={item}
                        index={index}
                        total={items.length}
                        processes={processes}
                        onChange={(p) => updateItem(item.tmp_id, p)}
                        onRemove={() => removeItem(item.tmp_id)}
                        onMove={(d) => moveItem(item.tmp_id, d)}
                        onEditVariants={() => setVariantsEditing(item.tmp_id)}
                      />
                    ))}
                  </div>
                ),
              )
            )}
          </div>

          {/* Barra de ações */}
          <div className="border-t bg-muted/20 px-5 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setPickerOpen(true)} size="sm" variant="default">
                <Plus className="h-4 w-4 mr-1" /> Adicionar acabamentos
              </Button>
              <Button onClick={addSpiralByVariant} size="sm" variant="outline">
                <Wand2 className="h-4 w-4 mr-1" /> Encadernação espiral
              </Button>

            </div>
          </div>

          <DialogFooter className="px-5 py-3 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>{editingId ? "Salvar alterações" : "Criar kit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddItemsPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        processes={processes}
        onConfirm={handlePickerConfirm}
      />

      {variantItem && (
        <VariantsDialog
          open={!!variantsEditing}
          onOpenChange={(v) => !v && setVariantsEditing(null)}
          variants={variantItem.variants}
          onChange={(next) => updateItem(variantItem.tmp_id, { variants: next })}
          itemLabel={variantItem.supply_label || "Item"}
          currentItemId={variantItem.id}
        />
      )}


      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Excluir kit?"
        description="Esta ação não pode ser desfeita. Orçamentos já criados não são afetados."
        onConfirm={remove}
        confirmText="Excluir"
      />
    </div>
  );
}

function CompactItemRow({
  item,
  index,
  total,
  processes,
  onChange,
  onRemove,
  onMove,
  onEditVariants,
}: {
  item: KitItem;
  index: number;
  total: number;
  processes: ProcessOption[];
  onChange: (patch: Partial<KitItem>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onEditVariants: () => void;
}) {
  const isVariant = item.quantity_formula === "variant_by_sheets";
  const Icon = item.item_type === "supply" ? Package : Cog;
  const label =
    item.item_type === "supply"
      ? item.supply_label || (isVariant ? "Variante por folhas" : "(sem suprimento)")
      : item.process_label || "(sem processo)";

  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 hover:bg-muted/30 transition-colors">
      <div className="flex flex-col -my-1">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none text-xs"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label="Subir"
        >
          ▲
        </button>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none text-xs"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label="Descer"
        >
          ▼
        </button>
      </div>
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" title={label}>
          {label}
        </p>
      </div>
      {isVariant ? (() => {
        const total = item.variants.length;
        const mapped = item.variants.filter((v) => !!v.supply_id).length;
        const complete = mapped === total && total > 0;
        return (
          <button
            type="button"
            onClick={onEditVariants}
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 cursor-pointer transition-colors ${
              complete
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25"
            }`}
            title={complete ? "Todas as faixas mapeadas" : "Faixas pendentes — clique para configurar"}
          >
            {complete ? `✓ ${total} faixas mapeadas` : `⚠ ${total - mapped} pendente${total - mapped === 1 ? "" : "s"}`}
          </button>
        );
      })() : (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 bg-muted text-muted-foreground">
          {formulaBadge(item)}
        </span>
      )}

      <Select
        value={item.role}
        onValueChange={(v: KitItemRole) =>
          onChange({
            role: v,
            alternative_group:
              v === "alternative" && !item.alternative_group ? "grupo 1" : item.alternative_group,
          })
        }
      >
        <SelectTrigger className="h-7 w-[90px] text-xs shrink-0">
          <SelectValue>{ROLE_SHORT[item.role]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(ROLE_LABELS) as KitItemRole[]).map((r) => (
            <SelectItem key={r} value={r} className="text-xs">
              {ROLE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ItemMorePopover
        item={item}
        processes={processes}
        onChange={onChange}
        onEditVariants={onEditVariants}
      />
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}

function ItemMorePopover({
  item,
  processes,
  onChange,
  onEditVariants,
}: {
  item: KitItem;
  processes: ProcessOption[];
  onChange: (patch: Partial<KitItem>) => void;
  onEditVariants: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <p className="text-xs font-semibold text-muted-foreground">Configurações avançadas</p>

        <div>
          <Label className="text-xs">Fórmula de quantidade</Label>
          <Select
            value={item.quantity_formula}
            onValueChange={(v: KitQuantityFormula) => onChange({ quantity_formula: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FORMULA_LABELS) as KitQuantityFormula[])
                .filter((f) => f !== "auto_spiral" || item.quantity_formula === "auto_spiral")
                .map((f) => (
                  <SelectItem key={f} value={f} className="text-xs">
                    {FORMULA_LABELS[f]}
                  </SelectItem>
                ))}
            </SelectContent>

          </Select>
        </div>

        {item.quantity_formula !== "variant_by_sheets" &&
          item.quantity_formula !== "auto_spiral" && (
            <div>
              <Label className="text-xs">Valor da fórmula</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                className="h-8 text-xs"
                value={item.quantity_value}
                onChange={(e) => onChange({ quantity_value: Number(e.target.value) })}
              />
            </div>
          )}

        {item.quantity_formula === "variant_by_sheets" && (
          <Button size="sm" variant="outline" className="w-full" onClick={onEditVariants}>
            <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar faixas
          </Button>
        )}

        {item.item_type === "process" && (
          <div>
            <Label className="text-xs">Processo</Label>
            <Select
              value={item.process_step_id ?? ""}
              onValueChange={(v) => {
                const p = processes.find((x) => x.id === v);
                onChange({ process_step_id: v, process_label: p?.description ?? "" });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecionar processo…" />
              </SelectTrigger>
              <SelectContent>
                {processes.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {item.role === "alternative" && (
          <div>
            <Label className="text-xs">Grupo de alternativas</Label>
            <Input
              className="h-8 text-xs"
              value={item.alternative_group}
              onChange={(e) => onChange({ alternative_group: e.target.value })}
              placeholder="ex.: capa"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Switch
            id={`auto-${item.tmp_id}`}
            checked={item.auto_select_default}
            onCheckedChange={(v) => onChange({ auto_select_default: v })}
          />
          <Label htmlFor={`auto-${item.tmp_id}`} className="text-xs">
            Pré-marcado ao abrir o painel
          </Label>
        </div>

        <div>
          <Label className="text-xs">Notas (opcional)</Label>
          <Textarea
            value={item.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={2}
            className="text-xs"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
