import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FolderInput } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StepTypeBadge } from "./StepTypeBadge";

export type GroupKind = "labor" | "materials";

export interface LaborGroupItem {
  id: string;
  description: string;
  timeMinutes: number;
  stepType: string;
}

export interface MaterialGroupItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface BaseProps {
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
}

interface LaborProps extends BaseProps {
  kind: "labor";
  onLoad: (items: LaborGroupItem[]) => void;
}

interface MaterialProps extends BaseProps {
  kind: "materials";
  onLoad: (items: MaterialGroupItem[]) => void;
}

type Props = LaborProps | MaterialProps;

export function LoadFromGroupDialog(props: Props) {
  const { kind, triggerLabel = "Carregar de um Grupo", triggerVariant = "outline" } = props;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [previewLabor, setPreviewLabor] = useState<LaborGroupItem[]>([]);
  const [previewMat, setPreviewMat] = useState<MaterialGroupItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const table = kind === "labor" ? "step_groups" : "material_groups";
    supabase.from(table).select("id, name").order("name").then(({ data, error }) => {
      if (error) toast.error("Erro ao carregar grupos");
      setGroups(data || []);
      setLoading(false);
    });
  }, [open, kind]);

  useEffect(() => {
    if (!selected) {
      setPreviewLabor([]);
      setPreviewMat([]);
      return;
    }
    setLoading(true);
    if (kind === "labor") {
      supabase
        .from("step_group_items")
        .select("id, description, time_minutes, step_type")
        .eq("step_group_id", selected)
        .order("sort_order")
        .then(({ data }) => {
          setPreviewLabor(
            (data || []).map((r: any) => ({
              id: r.id,
              description: r.description,
              timeMinutes: Number(r.time_minutes) || 0,
              stepType: r.step_type || "outro",
            })),
          );
          setLoading(false);
        });
    } else {
      (async () => {
        const { data } = await supabase
          .from("material_group_items")
          .select("id, description, quantity, unit_price, supply_id")
          .eq("material_group_id", selected)
          .order("sort_order");

        const rows = data || [];
        const supplyIds = Array.from(
          new Set(rows.map((r: any) => r.supply_id).filter(Boolean)),
        ) as string[];

        let liveMap = new Map<string, { price: number; margem: number; tiers: any[] }>();
        if (supplyIds.length > 0) {
          const [{ data: sup }, { data: tiers }] = await Promise.all([
            supabase
              .from("supplies")
              .select("id, valor_unitario, margem_pct")
              .in("id", supplyIds),
            (supabase as any)
              .from("supply_pricing_tiers")
              .select("*")
              .in("supply_id", supplyIds)
              .order("min_qty"),
          ]);
          const tiersBySupply = new Map<string, any[]>();
          for (const t of (tiers || []) as any[]) {
            const arr = tiersBySupply.get(t.supply_id) || [];
            arr.push(t);
            tiersBySupply.set(t.supply_id, arr);
          }
          liveMap = new Map(
            (sup || []).map((s: any) => [
              s.id,
              {
                price: Number(s.valor_unitario) || 0,
                margem: Number(s.margem_pct) || 0,
                tiers: tiersBySupply.get(s.id) || [],
              },
            ]),
          );
        }

        setPreviewMat(
          rows.map((r: any) => {
            const live = r.supply_id ? liveMap.get(r.supply_id) : undefined;
            return {
              id: r.id,
              description: r.description,
              quantity: Number(r.quantity) || 1,
              unitPrice: live ? live.price : Number(r.unit_price) || 0,
              margemPct: live ? live.margem : 0,
              supplyId: r.supply_id ?? null,
              pricingTiers: live ? live.tiers : [],
            } as any;
          }),
        );
        setLoading(false);
      })();
    }
  }, [selected, kind]);

  const handleConfirm = () => {
    const stamp = Date.now();
    if (kind === "labor") {
      // Cópias locais com novos IDs (não referenciam o cadastro central)
      const copies = previewLabor.map((it, i) => ({
        ...it,
        id: `lab-${stamp}-${i}`,
      }));
      props.onLoad(copies);
      toast.success(`${copies.length} etapa(s) carregada(s) — você pode editar livremente.`);
    } else {
      const copies = previewMat.map((it, i) => ({
        ...it,
        id: `mat-${stamp}-${i}`,
      }));
      props.onLoad(copies);
      toast.success(`${copies.length} material(is) carregado(s) — você pode editar livremente.`);
    }
    setOpen(false);
    setSelected("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm" className="gap-1.5">
          <FolderInput className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Carregar {kind === "labor" ? "grupo de mão de obra" : "grupo de materiais"}</DialogTitle>
          <DialogDescription>
            Os itens serão importados como <strong>cópias editáveis</strong>. Alterar valores aqui não afeta o cadastro principal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder={loading && !groups.length ? "Carregando..." : "Selecione um grupo"} />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
              {!loading && groups.length === 0 && (
                <div className="px-2 py-3 text-sm text-muted-foreground">Nenhum grupo cadastrado.</div>
              )}
            </SelectContent>
          </Select>

          {loading && selected && (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          )}

          {kind === "labor" && previewLabor.length > 0 && (
            <div className="rounded-lg border max-h-60 overflow-y-auto divide-y">
              {previewLabor.map((it) => (
                <div key={it.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <StepTypeBadge type={it.stepType} />
                  <span className="flex-1 truncate">{it.description}</span>
                  <span className="text-muted-foreground tabular-nums">{it.timeMinutes} min</span>
                </div>
              ))}
            </div>
          )}

          {kind === "materials" && previewMat.length > 0 && (
            <div className="rounded-lg border max-h-60 overflow-y-auto divide-y">
              {previewMat.map((it) => (
                <div key={it.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="flex-1 truncate">{it.description}</span>
                  <span className="text-muted-foreground tabular-nums">{it.quantity} × R$ {it.unitPrice.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected || (kind === "labor" ? previewLabor.length === 0 : previewMat.length === 0)}
          >
            Carregar como cópia editável
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
