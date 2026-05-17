import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, GripVertical, Loader2, RotateCcw, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Midia = "lona" | "adesivo" | "chapa" | "outro";

const MIDIAS: { value: Midia; label: string }[] = [
  { value: "lona", label: "Lona" },
  { value: "adesivo", label: "Adesivo" },
  { value: "chapa", label: "Chapa" },
  { value: "outro", label: "Outro" },
];

interface Acab {
  id: string;
  nome: string;
  familia: string;
  tipos_midia_compativeis: string[];
  sort_order: number;
  ativo: boolean;
}

interface OrderRow {
  acabamento_id: string;
  tipo_midia: Midia;
  sort_order: number;
  visivel: boolean;
}

interface ListItem {
  id: string; // acabamento_id
  nome: string;
  familia: string;
  sort_order: number;
  visivel: boolean;
  isOverride: boolean; // true se há linha em media_order
}

function SortableCard({
  item,
  onToggleVisible,
}: {
  item: ListItem;
  onToggleVisible: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : item.visivel ? 1 : 0.5,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm ${
        !item.visivel ? "border-dashed" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Arrastar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{item.nome}</div>
        <div className="text-[10px] text-muted-foreground truncate">{item.familia}</div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onToggleVisible}
        aria-label={item.visivel ? "Ocultar nesta mídia" : "Mostrar nesta mídia"}
        title={item.visivel ? "Ocultar nesta mídia" : "Mostrar nesta mídia"}
      >
        {item.visivel ? (
          <Eye className="h-4 w-4 text-primary" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}

export default function AcabamentosMediaOrderPanel() {
  const { requireAdmin } = usePermissionGuard();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acabs, setAcabs] = useState<Acab[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchAll = async () => {
    setLoading(true);
    const [a, o] = await Promise.all([
      supabase
        .from("cv_calc_acabamentos")
        .select("id, nome, familia, tipos_midia_compativeis, sort_order, ativo")
        .eq("ativo", true)
        .order("sort_order")
        .order("nome"),
      supabase
        .from("cv_calc_acabamento_media_order" as never)
        .select("acabamento_id, tipo_midia, sort_order, visivel"),
    ]);
    if (a.error) handleError(a.error, "carregar acabamentos");
    else setAcabs((a.data as Acab[]) ?? []);
    setOrders(((o.data as OrderRow[]) ?? []));
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Para cada mídia, monta a lista ordenada
  const listsByMidia = useMemo(() => {
    const out: Record<Midia, ListItem[]> = { lona: [], adesivo: [], chapa: [], outro: [] };
    for (const m of MIDIAS) {
      const compat = acabs.filter((a) => a.tipos_midia_compativeis.includes(m.value));
      const items: ListItem[] = compat.map((a) => {
        const ovr = orders.find((o) => o.acabamento_id === a.id && o.tipo_midia === m.value);
        return {
          id: a.id,
          nome: a.nome,
          familia: a.familia,
          sort_order: ovr?.sort_order ?? a.sort_order,
          visivel: ovr?.visivel ?? true,
          isOverride: !!ovr,
        };
      });
      items.sort((x, y) => x.sort_order - y.sort_order);
      out[m.value] = items;
    }
    return out;
  }, [acabs, orders]);

  const upsertOrder = async (rows: { acabamento_id: string; tipo_midia: Midia; sort_order: number; visivel: boolean }[]) => {
    if (!rows.length) return;
    const { error } = await supabase
      .from("cv_calc_acabamento_media_order" as never)
      .upsert(rows as never, { onConflict: "acabamento_id,tipo_midia" });
    if (error) {
      handleError(error, "salvar ordem");
      return false;
    }
    return true;
  };

  const handleDragEnd = async (midia: Midia, e: DragEndEvent) => {
    if (!requireAdmin("alterar ordem dos acabamentos")) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const list = listsByMidia[midia];
    const oldIdx = list.findIndex((i) => i.id === active.id);
    const newIdx = list.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(list, oldIdx, newIdx);
    // Otimista
    const upsertRows = next.map((it, idx) => ({
      acabamento_id: it.id,
      tipo_midia: midia,
      sort_order: idx * 10,
      visivel: it.visivel,
    }));
    // Atualiza local imediatamente
    setOrders((prev) => {
      const filtered = prev.filter((o) => o.tipo_midia !== midia);
      return [...filtered, ...upsertRows];
    });
    setSaving(true);
    const ok = await upsertOrder(upsertRows);
    setSaving(false);
    if (ok) toast.success("Ordem atualizada");
  };

  const toggleVisible = async (midia: Midia, acabId: string, currentVisible: boolean) => {
    if (!requireAdmin("alterar visibilidade")) return;
    const list = listsByMidia[midia];
    const item = list.find((i) => i.id === acabId);
    if (!item) return;
    const row = {
      acabamento_id: acabId,
      tipo_midia: midia,
      sort_order: item.sort_order,
      visivel: !currentVisible,
    };
    // Otimista
    setOrders((prev) => {
      const others = prev.filter((o) => !(o.acabamento_id === acabId && o.tipo_midia === midia));
      return [...others, row];
    });
    setSaving(true);
    const ok = await upsertOrder([row]);
    setSaving(false);
    if (ok) toast.success(currentVisible ? "Acabamento ocultado" : "Acabamento exibido");
  };

  const resetMidia = async (midia: Midia) => {
    if (!requireAdmin("resetar ordem")) return;
    if (!confirm(`Resetar a ordem e visibilidade dos acabamentos de "${midia}" para o padrão global?`)) return;
    setSaving(true);
    const { error } = await supabase
      .from("cv_calc_acabamento_media_order" as never)
      .delete()
      .eq("tipo_midia", midia);
    setSaving(false);
    if (error) {
      handleError(error, "resetar ordem");
      return;
    }
    setOrders((prev) => prev.filter((o) => o.tipo_midia !== midia));
    toast.success(`Ordem de ${midia} resetada`);
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Layers className="h-4 w-4 text-primary" />
        Arraste pelo <GripVertical className="inline h-3.5 w-3.5" /> para reordenar. Use o
        <Eye className="inline h-3.5 w-3.5 mx-1 text-primary" /> para ocultar um acabamento apenas naquela mídia (continua disponível nas outras).
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {MIDIAS.map((m) => {
          const items = listsByMidia[m.value];
          const customCount = items.filter((i) => i.isOverride).length;
          return (
            <Card key={m.value} className="flex flex-col">
              <CardContent className="p-3 flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{m.label}</h3>
                    <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                  </div>
                  {customCount > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => resetMidia(m.value)}
                      title="Resetar para ordem global"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">
                    Nenhum acabamento compatível.
                  </p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => handleDragEnd(m.value, e)}
                  >
                    <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1.5">
                        {items.map((it) => (
                          <SortableCard
                            key={it.id}
                            item={it}
                            onToggleVisible={() => toggleVisible(m.value, it.id, it.visivel)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
