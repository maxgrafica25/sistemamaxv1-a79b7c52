import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
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
  
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
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

const normalizeForMatch = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const singularize = (t: string) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t);

function suggestPresets(
  kitName: string,
  presets: PresetOption[],
  alreadySelected: string[],
): PresetOption[] {
  const n = normalizeForMatch(kitName);
  if (n.length < 3) return [];
  const kitTokens = new Set(n.split(" ").map(singularize).filter((t) => t.length > 3));
  const out: PresetOption[] = [];
  for (const p of presets) {
    if (alreadySelected.includes(p.id)) continue;
    const pn = normalizeForMatch(p.nome);
    if (!pn) continue;
    let match = n.includes(pn) || pn.includes(n);
    if (!match) {
      const presetTokens = pn.split(" ").map(singularize).filter((t) => t.length > 3);
      match = presetTokens.some((t) => kitTokens.has(t));
    }
    if (match) out.push(p);
  }
  return out;
}


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

interface ReadonlyKitItem {
  kind: "supply" | "process";
  label: string;
  role: KitItemRole;
  formula: string;
}

export interface KitsProdutoHandle {
  openNew: () => void;
}

interface KitsProdutoProps {
  hideHeader?: boolean;
}

const KitsProduto = forwardRef<KitsProdutoHandle, KitsProdutoProps>(function KitsProduto(
  { hideHeader = false },
  ref,
) {
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

  // Expansão (preview readonly dos itens no card)
  const [expandedKits, setExpandedKits] = useState<Set<string>>(new Set());
  const [kitItemsCache, setKitItemsCache] = useState<Record<string, ReadonlyKitItem[]>>({});
  const [loadingKits, setLoadingKits] = useState<Set<string>>(new Set());
  const [erroredKits, setErroredKits] = useState<Set<string>>(new Set());

  // Sub-dialogs
  const [pickerOpen, setPickerOpen] = useState(false);
  const [variantsEditing, setVariantsEditing] = useState<string | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchAll = async () => {
    setLoading(true);
    const [kitsRes, itemsRes, procRes, presetsRes, linksRes] = await Promise.all([
      supabase
        .from("product_kits")
        .select("id, name, product_kind, description, is_active")
        .order("name"),
      supabase.from("product_kit_items").select("kit_id"),
      (supabase as any)
        .from("finishings_price_items")
        .select("id, name, production_step_id, is_active")
        .eq("is_active", true)
        .not("production_step_id", "is", null)
        .order("name"),
      supabase
        .from("quote_presets")
        .select("id, nome, icone, ativo, ordem")
        .eq("ativo", true)
        .order("ordem"),
      supabase.from("product_kit_presets").select("kit_id, preset_id"),
    ]);
    if (kitsRes.error) handleError(kitsRes.error, "carregar kits");
    if (procRes.error) handleError(procRes.error, "carregar acabamentos");
    if (presetsRes.error) handleError(presetsRes.error, "carregar produtos favoritos");
    const counts = new Map<string, number>();
    (itemsRes.data || []).forEach((i: any) => {
      counts.set(i.kit_id, (counts.get(i.kit_id) || 0) + 1);
    });
    const linksByKit = new Map<string, string[]>();
    (linksRes.data || []).forEach((l: any) => {
      const arr = linksByKit.get(l.kit_id) || [];
      arr.push(l.preset_id);
      linksByKit.set(l.kit_id, arr);
    });
    setKits(
      (kitsRes.data || []).map((k: any) => ({
        id: k.id,
        name: k.name,
        product_kind: k.product_kind,
        description: k.description,
        is_active: !!k.is_active,
        item_count: counts.get(k.id) || 0,
        preset_ids: linksByKit.get(k.id) || [],
      })),
    );
    setProcesses(
      ((procRes.data || []) as any[])
        .filter((f) => f.production_step_id)
        .map((f) => ({ id: f.production_step_id as string, description: f.name as string })),
    );
    setAvailablePresets(
      ((presetsRes.data || []) as any[]).map((p) => ({
        id: p.id,
        nome: p.nome,
        icone: p.icone,
      })),
    );
    // Invalida cache de preview — itens podem ter mudado.
    setKitItemsCache({});
    setErroredKits(new Set());
    setLoading(false);
  };

  const toggleKitExpanded = async (kitId: string) => {
    const isOpen = expandedKits.has(kitId);
    setExpandedKits((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(kitId);
      else next.add(kitId);
      return next;
    });
    if (isOpen) return;
    if (kitItemsCache[kitId]) return;
    setLoadingKits((prev) => new Set(prev).add(kitId));
    setErroredKits((prev) => {
      const next = new Set(prev);
      next.delete(kitId);
      return next;
    });
    try {
      const { data, error } = await supabase
        .from("product_kit_items")
        .select("item_type, supply_id, process_step_id, role, quantity_formula, quantity_value")
        .eq("kit_id", kitId)
        .order("position");
      if (error) throw error;
      const rows = (data || []) as any[];
      const supplyIds = Array.from(
        new Set(rows.filter((r) => r.supply_id).map((r) => r.supply_id as string)),
      );
      const supMap = new Map<string, string>();
      if (supplyIds.length > 0) {
        const { data: sups } = await supabase
          .from("supplies")
          .select("id, produto")
          .in("id", supplyIds);
        for (const s of (sups || []) as any[]) supMap.set(s.id, s.produto);
      }
      const procMap = new Map<string, string>(processes.map((p) => [p.id, p.description]));
      const mapped: ReadonlyKitItem[] = rows.map((r) => {
        const kind = (r.item_type as "supply" | "process") ?? "supply";
        const label =
          kind === "supply"
            ? (r.supply_id ? supMap.get(r.supply_id) ?? "(suprimento)" : "(automático)")
            : (r.process_step_id ? procMap.get(r.process_step_id) ?? "(processo)" : "(processo)");
        return {
          kind,
          label,
          role: r.role as KitItemRole,
          formula: formulaBadge({
            quantity_formula: r.quantity_formula,
            quantity_value: Number(r.quantity_value) || 1,
            variants: [],
          } as KitItem),
        };
      });
      setKitItemsCache((prev) => ({ ...prev, [kitId]: mapped }));
    } catch (err) {
      console.error("[kit preview]", err);
      setErroredKits((prev) => new Set(prev).add(kitId));
    } finally {
      setLoadingKits((prev) => {
        const next = new Set(prev);
        next.delete(kitId);
        return next;
      });
    }
  };


  useEffect(() => {
    fetchAll();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSelectedPresetIds([]);
    setDescription("");
    setIsActive(true);
    setItems([]);
    setSuggestionDismissed(false);
    setNameTouched(false);
  };

  const openNew = () => {
    if (!requireAdmin("gerenciar kits de produto")) return;
    resetForm();
    setDialogOpen(true);
  };

  useImperativeHandle(ref, () => ({ openNew }));


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
    setSelectedPresetIds(k.preset_ids ?? []);
    setDescription(k.description ?? "");
    setIsActive(k.is_active);
    setSuggestionDismissed(false);
    setNameTouched(false);
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

  const reorderWithinBlock = (blockTmpIds: string[], activeId: string, overId: string) => {
    if (activeId === overId) return;
    setItems((prev) => {
      const fromBlock = blockTmpIds.indexOf(activeId);
      const toBlock = blockTmpIds.indexOf(overId);
      if (fromBlock < 0 || toBlock < 0) return prev;
      const newBlockOrder = arrayMove(blockTmpIds, fromBlock, toBlock);
      // Map block tmp_id → new global index slot (slots = current global indexes of that block)
      const blockSlots = blockTmpIds
        .map((id) => prev.findIndex((i) => i.tmp_id === id))
        .sort((a, b) => a - b);
      const next = [...prev];
      newBlockOrder.forEach((tmpId, k) => {
        const slot = blockSlots[k];
        const item = prev.find((i) => i.tmp_id === tmpId)!;
        next[slot] = item;
      });
      return next.map((i, k) => ({ ...i, position: k }));
    });
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Informe o nome do kit.";
    if (selectedPresetIds.length === 0)
      return "Selecione pelo menos um produto favorito ao qual este kit se aplica.";
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

    // Deriva product_kind do PRIMEIRO preset selecionado (compat com leitores antigos).
    const firstPreset = availablePresets.find((p) => p.id === selectedPresetIds[0]);
    const derivedKind = firstPreset
      ? PRESET_NAME_TO_KIND[firstPreset.nome] ?? slugify(firstPreset.nome)
      : "outros";

    const payload = {
      name: name.trim(),
      product_kind: derivedKind,
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

      // Sincroniza vínculos com Produtos Favoritos (N:N)
      await supabase.from("product_kit_presets").delete().eq("kit_id", kitId!);
      if (selectedPresetIds.length > 0) {
        const linksPayload = selectedPresetIds.map((pid) => ({
          kit_id: kitId!,
          preset_id: pid,
        }));
        const { error: le } = await supabase
          .from("product_kit_presets")
          .insert(linksPayload);
        if (le) throw le;
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
    const presetName = new Map(availablePresets.map((p) => [p.id, p.nome]));
    const map = new Map<string, KitRow[]>();
    for (const k of kits) {
      if (k.preset_ids.length === 0) {
        const arr = map.get("__sem_produto__") || [];
        arr.push(k);
        map.set("__sem_produto__", arr);
        continue;
      }
      for (const pid of k.preset_ids) {
        const label = presetName.get(pid) ?? "Produto removido";
        const arr = map.get(label) || [];
        arr.push(k);
        map.set(label, arr);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "__sem_produto__") return 1;
      if (b === "__sem_produto__") return -1;
      return a.localeCompare(b);
    });
  }, [kits, availablePresets]);

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

  const presetSuggestions = useMemo(() => {
    if (suggestionDismissed || !nameTouched) return [];
    return suggestPresets(name, availablePresets, selectedPresetIds);
  }, [name, availablePresets, selectedPresetIds, suggestionDismissed, nameTouched]);


  return (
    <div className="space-y-6 p-4 md:p-6">
      {!hideHeader && (
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
      )}

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
        grouped.map(([label, list]) => (
          <div key={label} className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground">
                {label === "__sem_produto__" ? "Sem produto vinculado" : label}
              </h2>
              <Badge variant="outline">{list.length}</Badge>
            </div>
            <Separator className="mb-2" />
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {list.map((k) => (
                <Card key={k.id} className={k.is_active ? "" : "opacity-60"}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      {k.item_count > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleKitExpanded(k.id)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/50 transition-colors"
                          aria-expanded={expandedKits.has(k.id)}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{k.name}</p>
                            <p className="text-xs text-muted-foreground">{k.item_count} itens</p>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                              expandedKits.has(k.id) ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{k.name}</p>
                          <p className="text-xs text-muted-foreground">Nenhum item cadastrado</p>
                        </div>
                      )}
                      <Switch checked={k.is_active} onCheckedChange={() => toggleActive(k)} />
                    </div>
                    {k.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{k.description}</p>
                    )}
                    {expandedKits.has(k.id) && k.item_count > 0 && (
                      <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-1">
                        {loadingKits.has(k.id) ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Carregando itens…
                          </div>
                        ) : erroredKits.has(k.id) ? (
                          <p className="text-xs text-destructive py-1">Falha ao carregar itens.</p>
                        ) : (
                          (kitItemsCache[k.id] || []).map((it, idx) => {
                            const Icon = it.kind === "supply" ? Package : Cog;
                            return (
                              <div
                                key={idx}
                                className="flex items-center gap-2 text-xs min-w-0"
                              >
                                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate flex-1" title={it.label}>
                                  {it.label}
                                </span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                  {ROLE_SHORT[it.role]}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                                  {it.formula}
                                </Badge>
                              </div>
                            );
                          })
                        )}
                      </div>
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
                        className="ml-auto text-destructive hover:text-destructive"
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
        <DialogContent className="max-w-[95vw] lg:max-w-6xl max-h-[95vh] h-[95vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <DialogTitle>{editingId ? "Editar Kit" : "Novo Kit"}</DialogTitle>
          </DialogHeader>

          {/* Cabeçalho enxuto */}
          <div className="px-5 py-3 border-b space-y-3 bg-muted/20">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <div>
                <Label className="text-xs">Nome do kit</Label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!nameTouched) setNameTouched(true);
                    if (suggestionDismissed) setSuggestionDismissed(false);
                  }}
                  placeholder="Ex.: Kit Encadernação Apostila"
                  className="h-9"
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={isActive} onCheckedChange={setIsActive} id="kit-active" />
                <Label htmlFor="kit-active" className="text-xs">Ativo</Label>
              </div>
            </div>
            <div>
              <Label className="text-xs">Aplica-se aos produtos</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-9 w-full justify-start px-2 py-1.5 flex-wrap gap-1"
                  >
                    {selectedPresetIds.length === 0 ? (
                      <span className="text-muted-foreground text-xs">
                        Selecione um ou mais produtos favoritos…
                      </span>
                    ) : (
                      availablePresets
                        .filter((p) => selectedPresetIds.includes(p.id))
                        .map((p) => (
                          <Badge key={p.id} variant="secondary" className="gap-1">
                            {p.nome}
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={`Remover ${p.nome}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPresetIds((prev) =>
                                  prev.filter((id) => id !== p.id),
                                );
                              }}
                              className="ml-0.5 cursor-pointer text-muted-foreground hover:text-foreground"
                            >
                              ×
                            </span>
                          </Badge>
                        ))
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-1 w-72 max-h-72 overflow-y-auto" align="start">
                  {availablePresets.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">
                      Nenhum produto favorito ativo. Cadastre em Vender → Produtos
                      Favoritos.
                    </p>
                  ) : (
                    availablePresets.map((p) => {
                      const checked = selectedPresetIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setSelectedPresetIds((prev) =>
                              checked
                                ? prev.filter((id) => id !== p.id)
                                : [...prev, p.id],
                            )
                          }
                          className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2 ${
                            checked ? "bg-primary/10" : ""
                          }`}
                        >
                          <span
                            className={`h-3.5 w-3.5 rounded border ${
                              checked
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/40"
                            }`}
                          />
                          {p.nome}
                        </button>
                      );
                    })
                  )}
                </PopoverContent>
              </Popover>
              <p className="text-[11px] text-muted-foreground mt-1">
                Um mesmo kit pode atender vários produtos (ex.: Cartão + Folheto).
              </p>
              {presetSuggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-muted-foreground">Sugestão:</span>
                  {presetSuggestions.map((p) => (
                    <Badge key={p.id} variant="secondary" className="font-normal">
                      {p.nome}
                    </Badge>
                  ))}
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setSelectedPresetIds((prev) => [
                          ...prev,
                          ...presetSuggestions
                            .map((p) => p.id)
                            .filter((id) => !prev.includes(id)),
                        ]);
                      }}
                    >
                      Aplicar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => setSuggestionDismissed(true)}
                    >
                      Ignorar
                    </Button>
                  </div>
                </div>
              )}
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
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Itens do kit ({items.length})
              </h3>
              <KitHowItWorks />
            </div>
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed py-10 text-center">
                <Layers className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum item ainda. Clique em <em>+ Adicionar acabamentos</em> para
                  incluir suprimentos, processos ou a encadernação espiral automática.
                </p>
              </div>
            ) : (
              (() => {
                const looseIds: string[] = [];
                const groupIds: Record<string, string[]> = {};
                renderedItems.forEach((b) => {
                  if (b.kind === "item") looseIds.push(b.item.tmp_id);
                  else groupIds[b.group] = b.items.map((x) => x.item.tmp_id);
                });
                const scopeOf = (id: string): string | null => {
                  if (looseIds.includes(id)) return "__loose__";
                  for (const g in groupIds) if (groupIds[g].includes(id)) return g;
                  return null;
                };
                const handleDragEnd = (ev: DragEndEvent) => {
                  const { active, over } = ev;
                  if (!over || active.id === over.id) return;
                  const a = String(active.id);
                  const o = String(over.id);
                  const sa = scopeOf(a);
                  const so = scopeOf(o);
                  if (!sa || sa !== so) return;
                  const block = sa === "__loose__" ? looseIds : groupIds[sa];
                  reorderWithinBlock(block, a, o);
                };
                return (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={looseIds} strategy={verticalListSortingStrategy}>
                      {renderedItems.map((b, bi) =>
                        b.kind === "item" ? (
                          <CompactItemRow
                            key={b.item.tmp_id}
                            item={b.item}
                            processes={processes}
                            onChange={(p) => updateItem(b.item.tmp_id, p)}
                            onRemove={() => removeItem(b.item.tmp_id)}
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
                            <SortableContext
                              items={groupIds[b.group]}
                              strategy={verticalListSortingStrategy}
                            >
                              {b.items.map(({ item }) => (
                                <CompactItemRow
                                  key={item.tmp_id}
                                  item={item}
                                  processes={processes}
                                  onChange={(p) => updateItem(item.tmp_id, p)}
                                  onRemove={() => removeItem(item.tmp_id)}
                                  onEditVariants={() => setVariantsEditing(item.tmp_id)}
                                />
                              ))}
                            </SortableContext>
                          </div>
                        ),
                      )}
                    </SortableContext>
                  </DndContext>
                );
              })()
            )}
          </div>

          {/* Barra de ações */}
          <div className="border-t bg-muted/20 px-5 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setPickerOpen(true)} size="sm" variant="default">
                <Plus className="h-4 w-4 mr-1" /> Adicionar acabamentos
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
        kitName={name}
        onConfirm={handlePickerConfirm}
        onAddSpiralShortcut={() => {
          addSpiralByVariant();
          setPickerOpen(false);
        }}
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


      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Kit?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este kit? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className={buttonVariants({ variant: "destructive" })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

export default KitsProduto;


function CompactItemRow({
  item,
  processes,
  onChange,
  onRemove,
  onEditVariants,
}: {
  item: KitItem;
  processes: ProcessOption[];
  onChange: (patch: Partial<KitItem>) => void;
  onRemove: () => void;
  onEditVariants: () => void;
}) {
  const isVariant = item.quantity_formula === "variant_by_sheets";
  const Icon = item.item_type === "supply" ? Package : Cog;
  const label =
    item.item_type === "supply"
      ? item.supply_label || (isVariant ? "Variante por folhas" : "(sem suprimento)")
      : item.process_label || "(sem processo)";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.tmp_id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    boxShadow: isDragging ? "0 8px 20px hsl(var(--foreground) / 0.15)" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 hover:bg-muted/30 transition-colors"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none -ml-1 p-0.5 rounded hover:bg-muted"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
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
