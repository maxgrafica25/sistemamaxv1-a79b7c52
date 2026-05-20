// Painel genérico de Kit de Produto — carrega kits cadastrados em product_kits
// para um determinado product_kind, mostra um resumo compacto por item e aplica
// ao orçamento ao clicar em "Aplicar Kit".
import { useEffect, useMemo, useState } from "react";
import {
  Wand2,
  AlertCircle,
  Sparkles,
  Lock,
  Package,
  Clock,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [altChoice, setAltChoice] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (!kit) return;
    const nextExcluded = new Set<string>();
    const nextAlt: Record<string, string> = {};
    for (const it of kit.items) {
      if (it.role === "optional" && !it.auto_select_default) {
        nextExcluded.add(it.id);
      }
      if (it.role === "alternative" && it.alternative_group) {
        if (it.auto_select_default && !nextAlt[it.alternative_group]) {
          nextAlt[it.alternative_group] = it.id;
        }
      }
    }
    for (const it of kit.items) {
      if (it.role === "alternative" && it.alternative_group && !nextAlt[it.alternative_group]) {
        nextAlt[it.alternative_group] = it.id;
      }
    }
    setExcluded(nextExcluded);
    setAltChoice(nextAlt);
  }, [kit]);

  const loading = !supLoaded || !stLoaded || !kitsLoaded;

  // Agrupa alternativos por grupo
  const altGroupsRows = useMemo(() => {
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

  // Linhas finais (1 por slot): required + optional + 1 escolhido por grupo alt
  type Slot =
    | { kind: "row"; row: ProductKitRow }
    | { kind: "alt"; group: string; rows: ProductKitRow[]; pickedId: string };
  const slots = useMemo<Slot[]>(() => {
    const out: Slot[] = [];
    const seenAltGroups = new Set<string>();
    for (const r of rows) {
      if (r.role === "alternative" && r.alternativeGroup) {
        if (seenAltGroups.has(r.alternativeGroup)) continue;
        seenAltGroups.add(r.alternativeGroup);
        const groupRows = altGroupsRows.get(r.alternativeGroup) || [];
        const pickedId =
          altChoice[r.alternativeGroup] && groupRows.some((x) => x.itemId === altChoice[r.alternativeGroup])
            ? altChoice[r.alternativeGroup]
            : groupRows[0]?.itemId ?? "";
        out.push({ kind: "alt", group: r.alternativeGroup, rows: groupRows, pickedId });
      } else {
        out.push({ kind: "row", row: r });
      }
    }
    return out;
  }, [rows, altGroupsRows, altChoice]);

  const pickedRows = useMemo<ProductKitRow[]>(() => {
    const list: ProductKitRow[] = [];
    for (const s of slots) {
      if (s.kind === "row") {
        if (s.row.role === "required") list.push(s.row);
        else if (s.row.role === "optional" && !excluded.has(s.row.itemId)) list.push(s.row);
      } else {
        const picked = s.rows.find((r) => r.itemId === s.pickedId);
        if (picked) list.push(picked);
      }
    }
    return list;
  }, [slots, excluded]);

  const total = pickedRows.reduce((acc, r) => acc + r.cost, 0);
  const fallbackCount = pickedRows.filter((r) => r.fallback).length;

  const toggleOpt = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apply = () => {
    if (pickedRows.length === 0) {
      toast.info("Selecione ao menos um item do kit.");
      return;
    }
    const items = pickedRows.map((r) => r.build()) as V3Item[];
    onApply(items);
    if (fallbackCount > 0) {
      toast.warning(`Kit aplicado (${items.length} itens). ${fallbackCount} precisa(m) ser preenchido(s) no cadastro.`);
    } else {
      toast.success(`Kit aplicado (${items.length} itens) · ${fmtBRL(total)}`);
    }
  };

  if (kitsLoaded && kits.length === 0) return null;

  return (
    <div className="rounded-md border border-primary/30 bg-primary/[0.03] p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight">
            Kit sugerido
            {kit && <span className="ml-1.5 text-xs font-normal text-primary">· {kit.name}</span>}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {pickedRows.length} item(ns) marcados · total {fmtBRL(total)}
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

      {/* Linhas */}
      {loading ? (
        <p className="text-[11px] text-muted-foreground">Carregando catálogo…</p>
      ) : (
        <div className="space-y-1">
          {slots.map((s, idx) =>
            s.kind === "row" ? (
              <SlotRow
                key={s.row.itemId + idx}
                row={s.row}
                checked={s.row.role === "required" || !excluded.has(s.row.itemId)}
                disabled={s.row.role === "required"}
                onToggle={() => toggleOpt(s.row.itemId)}
              />
            ) : (
              <AlternativeSlot
                key={s.group}
                group={s.group}
                rows={s.rows}
                pickedId={s.pickedId}
                onPick={(id) => setAltChoice((p) => ({ ...p, [s.group]: id }))}
              />
            ),
          )}
        </div>
      )}

      {/* Rodapé */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 min-w-0">
          {fallbackCount > 0 && (
            <>
              <AlertCircle className="inline h-3 w-3 text-amber-500 shrink-0" />
              <span className="truncate">{fallbackCount} item(ns) sem cadastro</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tabular-nums">{fmtBRL(total)}</span>
          <Button size="sm" onClick={apply} disabled={loading || !kit} className="h-8 text-xs">
            <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Aplicar Kit
          </Button>
        </div>
      </div>
    </div>
  );
}

function ItemIcon({ unit }: { unit: "un" | "min" }) {
  return unit === "un" ? (
    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  ) : (
    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  );
}

function qtyLabel(row: ProductKitRow): string {
  return row.unit === "un" ? `${row.qty} un` : `${row.qty.toFixed(0)} min`;
}

function SlotRow({
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
    <div
      className={cn(
        "flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors",
        checked ? "bg-background hover:bg-muted/40" : "opacity-50",
      )}
    >
      <ItemIcon unit={row.unit} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-medium truncate">{row.label}</span>
          {row.fallback && (
            <Badge variant="outline" className="h-4 text-[9px] px-1 border-amber-500 text-amber-600">
              preencher
            </Badge>
          )}
        </div>
        {row.description && row.description !== row.label && (
          <p className="text-[10.5px] text-muted-foreground truncate">{row.description}</p>
        )}
      </div>
      <span className="text-muted-foreground tabular-nums text-[10.5px] shrink-0">
        {qtyLabel(row)}
      </span>
      <span className="font-semibold tabular-nums w-[70px] text-right shrink-0">
        {fmtBRL(row.cost)}
      </span>
      {disabled ? (
        <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Obrigatório" />
      ) : (
        <Switch
          checked={checked}
          onCheckedChange={onToggle}
          className="scale-75 -mx-1"
        />
      )}
    </div>
  );
}

function AlternativeSlot({
  group,
  rows,
  pickedId,
  onPick,
}: {
  group: string;
  rows: ProductKitRow[];
  pickedId: string;
  onPick: (id: string) => void;
}) {
  const picked = rows.find((r) => r.itemId === pickedId) ?? rows[0];
  if (!picked) return null;
  const hasChoices = rows.length > 1;
  return (
    <div className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs bg-background hover:bg-muted/40">
      <ItemIcon unit={picked.unit} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Badge variant="secondary" className="h-4 text-[9px] px-1 shrink-0 capitalize">
            {group}
          </Badge>
          <span className="font-medium truncate">{picked.label}</span>
          {picked.fallback && (
            <Badge variant="outline" className="h-4 text-[9px] px-1 border-amber-500 text-amber-600">
              preencher
            </Badge>
          )}
        </div>
        {picked.description && picked.description !== picked.label && (
          <p className="text-[10.5px] text-muted-foreground truncate">{picked.description}</p>
        )}
      </div>
      <span className="text-muted-foreground tabular-nums text-[10.5px] shrink-0">
        {qtyLabel(picked)}
      </span>
      <span className="font-semibold tabular-nums w-[70px] text-right shrink-0">
        {fmtBRL(picked.cost)}
      </span>
      {hasChoices ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]">
              Trocar <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[260px]">
            <DropdownMenuLabel className="text-[11px] capitalize">{group}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={pickedId} onValueChange={onPick}>
              {rows.map((r) => (
                <DropdownMenuRadioItem
                  key={r.itemId}
                  value={r.itemId}
                  className="text-xs flex justify-between gap-2"
                >
                  <span className="truncate">{r.label}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {fmtBRL(r.cost)}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </div>
  );
}
