// Painel genérico de Kit de Produto — carrega kits cadastrados em product_kits
// para um determinado product_kind e permite aplicá-los ao orçamento.
import { useEffect, useMemo, useState } from "react";
import { Wand2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useV3Supplies } from "../shared/useV3Supplies";
import { useV3ProcessCatalog } from "../shared/useV3ProcessCatalog";
import { useV3HourlyRate } from "../shared/useV3HourlyRate";
import { fmtBRL } from "../shared/pricing";
import {
  buildProductKitRows,
  fetchActiveKitsForProduct,
  type ProductKitDB,
  type ProductKitRow,
} from "../shared/productKit";
import type { V3Item } from "../types";

interface Props {
  productKind: string;
  units: number;
  sheets?: number;
  perimeterM?: number;
  areaM2?: number;
  defaultMarginPct: number;
  onApply: (items: V3Item[]) => void;
}

export function ProductKitPanel({
  productKind,
  units,
  sheets,
  perimeterM,
  areaM2,
  defaultMarginPct,
  onApply,
}: Props) {
  const { supplies, loaded: supLoaded } = useV3Supplies();
  const { steps, loaded: stLoaded } = useV3ProcessCatalog();
  const { hourlyRate } = useV3HourlyRate();

  const [kits, setKits] = useState<ProductKitDB[]>([]);
  const [kitsLoaded, setKitsLoaded] = useState(false);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  // Estado de seleção por item (opcional/alternativo)
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [altChoice, setAltChoice] = useState<Record<string, string>>({}); // group → itemId

  useEffect(() => {
    let cancel = false;
    (async () => {
      const list = await fetchActiveKitsForProduct(supabase, productKind);
      if (cancel) return;
      setKits(list);
      setSelectedKitId(list[0]?.id ?? null);
      setKitsLoaded(true);
    })();
    return () => {
      cancel = true;
    };
  }, [productKind]);

  const kit = useMemo(
    () => kits.find((k) => k.id === selectedKitId) ?? null,
    [kits, selectedKitId],
  );

  const rows = useMemo<ProductKitRow[]>(() => {
    if (!kit) return [];
    return buildProductKitRows({
      kit,
      units,
      sheets,
      perimeterM,
      areaM2,
      supplies,
      steps,
      hourlyRate,
      defaultMarginPct,
    });
  }, [kit, units, sheets, perimeterM, areaM2, supplies, steps, hourlyRate, defaultMarginPct]);

  // Inicializa defaults quando o kit muda
  useEffect(() => {
    if (!kit) return;
    const nextExcluded = new Set<string>();
    const nextAlt: Record<string, string> = {};
    for (const it of kit.items) {
      if (it.role === "optional" && !it.auto_select_default) {
        nextExcluded.add(it.id);
      }
      if (it.role === "alternative" && it.alternative_group) {
        // primeiro com auto_select_default vence; fallback = primeiro do grupo
        if (it.auto_select_default && !nextAlt[it.alternative_group]) {
          nextAlt[it.alternative_group] = it.id;
        }
      }
    }
    // garante pelo menos 1 por grupo
    for (const it of kit.items) {
      if (it.role === "alternative" && it.alternative_group && !nextAlt[it.alternative_group]) {
        nextAlt[it.alternative_group] = it.id;
      }
    }
    setExcluded(nextExcluded);
    setAltChoice(nextAlt);
  }, [kit]);

  const loading = !supLoaded || !stLoaded || !kitsLoaded;

  const altGroups = useMemo(() => {
    const map = new Map<string, ProductKitRow[]>();
    for (const r of rows) {
      if (r.role === "alternative" && r.alternativeGroup) {
        const arr = map.get(r.alternativeGroup) || [];
        arr.push(r);
        map.set(r.alternativeGroup, arr);
      }
    }
    return map;
  }, [rows]);

  const requiredRows = rows.filter((r) => r.role === "required");
  const optionalRows = rows.filter((r) => r.role === "optional");

  const isPicked = (r: ProductKitRow): boolean => {
    if (r.role === "required") return true;
    if (r.role === "optional") return !excluded.has(r.itemId);
    if (r.role === "alternative" && r.alternativeGroup) {
      return altChoice[r.alternativeGroup] === r.itemId;
    }
    return false;
  };

  const toggleOpt = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apply = () => {
    const picked = rows.filter(isPicked);
    if (picked.length === 0) {
      toast.info("Selecione ao menos um item do kit.");
      return;
    }
    const items = picked.map((r) => r.build()) as V3Item[];
    onApply(items);
    const fallbacks = picked.filter((r) => r.fallback).map((r) => r.label);
    if (fallbacks.length > 0) {
      toast.warning(`Kit aplicado (${items.length} itens). Preencher: ${fallbacks.join(", ")}`);
    } else {
      toast.success(`Kit aplicado (${items.length} itens).`);
    }
  };

  if (kitsLoaded && kits.length === 0) {
    return null; // sem kits cadastrados para este produto → painel não aparece
  }

  return (
    <div className="rounded-md border border-primary/30 bg-primary/[0.03] p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            Kit sugerido
            {kit && <span className="ml-1.5 text-xs font-normal text-primary">· {kit.name}</span>}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Adiciona materiais e processos pré-cadastrados para este produto.
          </p>
        </div>
        {kits.length > 1 && (
          <Select value={selectedKitId ?? ""} onValueChange={setSelectedKitId}>
            <SelectTrigger className="h-7 text-xs w-[180px]">
              <SelectValue placeholder="Escolher kit" />
            </SelectTrigger>
            <SelectContent>
              {kits.map((k) => (
                <SelectItem key={k.id} value={k.id} className="text-xs">
                  {k.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Carregando catálogo…</p>
      ) : (
        <div className="space-y-1.5">
          {requiredRows.map((r) => (
            <RowLine key={r.itemId} row={r} checked disabled onToggle={() => {}} />
          ))}
          {optionalRows.map((r) => (
            <RowLine
              key={r.itemId}
              row={r}
              checked={!excluded.has(r.itemId)}
              onToggle={() => toggleOpt(r.itemId)}
            />
          ))}
          {Array.from(altGroups.entries()).map(([group, items]) => (
            <div key={group} className="rounded-sm border border-border/50 p-2 space-y-1">
              <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                Escolha uma opção · {group}
              </p>
              <RadioGroup
                value={altChoice[group] ?? ""}
                onValueChange={(v) => setAltChoice((p) => ({ ...p, [group]: v }))}
                className="space-y-1"
              >
                {items.map((r) => (
                  <label
                    key={r.itemId}
                    className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-xs cursor-pointer hover:bg-muted/50"
                  >
                    <RadioGroupItem value={r.itemId} className="h-3.5 w-3.5" />
                    <span className="flex-1 min-w-0 truncate font-medium">{r.label}</span>
                    <span className="text-muted-foreground text-[10.5px] truncate max-w-[180px] hidden sm:inline">
                      {r.description}
                    </span>
                    <span className="text-muted-foreground tabular-nums text-[10.5px]">
                      {r.unit === "un" ? `${r.qty} un` : `${r.qty.toFixed(0)} min`}
                    </span>
                    <span className="font-semibold tabular-nums w-[70px] text-right">
                      {fmtBRL(r.cost)}
                    </span>
                    {r.fallback && <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />}
                  </label>
                ))}
              </RadioGroup>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-[10px] text-muted-foreground">
          {rows.some((r) => r.fallback) && (
            <>
              <AlertCircle className="inline h-3 w-3 mr-1 text-amber-500" />
              Itens em amarelo não foram encontrados no cadastro.
            </>
          )}
        </p>
        <Button size="sm" onClick={apply} disabled={loading || !kit} className="h-8 text-xs">
          <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Aplicar Kit
        </Button>
      </div>
    </div>
  );
}

function RowLine({
  row,
  checked,
  disabled,
  onToggle,
}: {
  row: ProductKitRow;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors",
        disabled ? "cursor-default" : "cursor-pointer",
        checked ? "bg-background hover:bg-muted/50" : "opacity-50 hover:opacity-75",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        disabled={disabled}
        className="h-3.5 w-3.5"
      />
      <span className="flex-1 min-w-0 truncate font-medium">{row.label}</span>
      <span className="text-muted-foreground text-[10.5px] truncate max-w-[180px] hidden sm:inline">
        {row.description}
      </span>
      <span className="text-muted-foreground tabular-nums text-[10.5px]">
        {row.unit === "un" ? `${row.qty} un` : `${row.qty.toFixed(0)} min`}
      </span>
      <span className="font-semibold tabular-nums w-[70px] text-right">{fmtBRL(row.cost)}</span>
      {row.fallback && <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />}
    </label>
  );
}
