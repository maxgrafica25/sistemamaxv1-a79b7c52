import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Edit2, Loader2, Sparkles, GripVertical, Copy } from "lucide-react";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import ConfirmDialog from "@/components/ConfirmDialog";
import SupplySearch from "@/components/orcamentos-v2/SupplySearch";
import type {
  KitItemRole,
  KitQuantityFormula,
} from "@/components/orcamentos-v3/shared/productKit";

interface VariantRow {
  tmp_id: string;
  min_value: number;
  max_value: number | null;
  supply_id: string | null;
  supply_label: string;
  label: string;
}

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
}

const KIND_SUGGESTIONS = [
  "apostila",
  "cartao",
  "banner",
  "bloco",
  "folder",
  "panfleto",
  "adesivo",
  "convite",
  "certificado",
];

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

const tmp = () => `tmp_${Math.random().toString(36).slice(2, 9)}`;

interface ProcessOption {
  id: string;
  description: string;
}

export default function KitsProduto() {
  const { requireAdmin } = usePermissionGuard();
  const [kits, setKits] = useState<KitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processes, setProcesses] = useState<ProcessOption[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState("");
  const [productKind, setProductKind] = useState("apostila");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<KitItem[]>([]);

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
    let variantsByItem = new Map<string, any[]>();
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

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        tmp_id: tmp(),
        position: prev.length,
        item_type: "supply",
        supply_id: null,
        supply_label: "",
        process_step_id: null,
        process_label: "",
        role: "required",
        alternative_group: "",
        quantity_formula: "per_unit",
        quantity_value: 1,
        auto_select_default: true,
        notes: "",
        variants: [],
      },
    ]);
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
      if (it.item_type === "supply" && !it.supply_id && it.quantity_formula !== "auto_spiral") {
        return "Selecione o suprimento de todos os itens (ou marque como 'auto espiral').";
      }
      if (it.item_type === "process" && !it.process_step_id) {
        return "Selecione o processo de todos os itens de mão-de-obra.";
      }
      if (it.role === "alternative" && !it.alternative_group.trim()) {
        return "Itens alternativos precisam de um nome de grupo (ex.: 'capa').";
      }
    }
    // grupos alternativos com pelo menos 2 itens
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
        const { error: ie } = await supabase.from("product_kit_items").insert(itemsPayload);
        if (ie) throw ie;
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Kit" : "Novo Kit"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Nome do Kit</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Kit Encadernação Apostila" />
              </div>
              <div>
                <Label>Tipo de produto</Label>
                <Input
                  list="kit-kinds"
                  value={productKind}
                  onChange={(e) => setProductKind(e.target.value)}
                  placeholder="ex.: apostila"
                />
                <datalist id="kit-kinds">
                  {KIND_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Quando aplicar este kit?"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="kit-active" />
              <Label htmlFor="kit-active">Ativo</Label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Itens do kit</h3>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
                </Button>
              </div>
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum item ainda.</p>
              )}
              {items.map((it, idx) => (
                <ItemRow
                  key={it.tmp_id}
                  item={it}
                  index={idx}
                  total={items.length}
                  processes={processes}
                  onChange={(patch) => updateItem(it.tmp_id, patch)}
                  onRemove={() => removeItem(it.tmp_id)}
                  onMove={(dir) => moveItem(it.tmp_id, dir)}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>{editingId ? "Salvar alterações" : "Criar kit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function ItemRow({
  item,
  index,
  total,
  processes,
  onChange,
  onRemove,
  onMove,
}: {
  item: KitItem;
  index: number;
  total: number;
  processes: ProcessOption[];
  onChange: (patch: Partial<KitItem>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="rounded-md border p-3 space-y-2 bg-muted/30">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Subir"
          >
            ▲
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Descer"
          >
            ▼
          </button>
        </div>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">#{index + 1}</span>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select
            value={item.item_type}
            onValueChange={(v: "supply" | "process") =>
              onChange({
                item_type: v,
                supply_id: null,
                supply_label: "",
                process_step_id: null,
                process_label: "",
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="supply">Suprimento</SelectItem>
              <SelectItem value="process">Processo (mão-de-obra)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">
            {item.item_type === "supply" ? "Suprimento" : "Processo"}
          </Label>
          {item.item_type === "supply" ? (
            <SupplySearch
              initialLabel={item.supply_label}
              onSelect={(s) =>
                onChange({ supply_id: s.id, supply_label: s.produto })
              }
            />
          ) : (
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
          )}
        </div>

        <div>
          <Label className="text-xs">Papel no kit</Label>
          <Select
            value={item.role}
            onValueChange={(v: KitItemRole) => onChange({ role: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABELS) as KitItemRole[]).map((r) => (
                <SelectItem key={r} value={r} className="text-xs">
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
              {(Object.keys(FORMULA_LABELS) as KitQuantityFormula[]).map((f) => (
                <SelectItem key={f} value={f} className="text-xs">
                  {FORMULA_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Valor da fórmula</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            className="h-8 text-xs"
            value={item.quantity_value}
            onChange={(e) => onChange({ quantity_value: Number(e.target.value) })}
            disabled={item.quantity_formula === "auto_spiral"}
          />
        </div>

        <div className="flex items-center gap-2 md:col-span-2">
          <Switch
            id={`auto-${item.tmp_id}`}
            checked={item.auto_select_default}
            onCheckedChange={(v) => onChange({ auto_select_default: v })}
          />
          <Label htmlFor={`auto-${item.tmp_id}`} className="text-xs">
            Pré-marcado ao abrir o painel
          </Label>
        </div>
      </div>
    </div>
  );
}
