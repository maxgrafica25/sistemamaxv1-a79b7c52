// Suprimento avulso V3 — usa SupplySearch (mesmo catálogo do V2).
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Check, Plus, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import SupplySearch, {
  type SupplyOption,
} from "@/components/orcamentos-v2/SupplySearch";
import { fmtBRL, roundUp10 } from "../shared/pricing";
import { TierFaixasPanel } from "../shared/TierFaixasPanel";
import { genId, type V3SupplyItem } from "../types";

interface Props {
  defaultMarginPct: number;
  onAdd: (item: V3SupplyItem) => void;
  onAddTiers?: (items: V3SupplyItem[]) => void;
}

export function SupplyForm({ defaultMarginPct, onAdd, onAddTiers }: Props) {
  const [supply, setSupply] = useState<SupplyOption | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [extraTiers, setExtraTiers] = useState<number[]>([]);
  const [margem, setMargem] = useState<number>(defaultMarginPct || 20);
  const [descricao, setDescricao] = useState("");
  const [pulse, setPulse] = useState(false);

  const custoUnit = supply?.valor_unitario ?? 0;
  const totalCusto = custoUnit * qty;
  const totalPreco = totalCusto * (1 + margem / 100);
  const canAdd = !!supply && qty > 0;

  const buildItem = (q: number, tierGroupId?: string): V3SupplyItem | null => {
    if (!supply) return null;
    return {
      id: genId(),
      kind: "supply",
      descricao: descricao.trim() || supply.produto,
      tier_group_id: tierGroupId ?? null,
      supply_id: supply.id,
      supply_nome: supply.produto,
      fornecedor: supply.fornecedor || null,
      custo_unitario: custoUnit,
      margem_pct: margem,
      quantidade: q,
    };
  };

  const submit = () => {
    if (!supply || !canAdd) return;
    const it = buildItem(qty);
    if (!it) return;
    onAdd(it);
    setDescricao("");
    setSupply(null);
    setQty(1);
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  const submitAsTiers = (qtys: number[], primaryQty: number) => {
    if (!onAddTiers || !supply) return;
    const tg = `tg_${genId()}`;
    const items = qtys
      .map((q) => {
        const it = buildItem(q, tg);
        return it ? ({ ...it, tier_primary: q === primaryQty } as V3SupplyItem) : null;
      })
      .filter((x): x is V3SupplyItem => !!x);
    if (items.length === 0) return;
    onAddTiers(items);
    setDescricao("");
    setSupply(null);
    setQty(1);
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Suprimento do catálogo
        </Label>
        <SupplySearch
          onSelect={(s) => {
            setSupply(s);
            if (s.margem_pct != null) setMargem(Number(s.margem_pct));
          }}
        />
      </div>

      {supply && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 flex items-center gap-3">
          <Package className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{supply.produto}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {supply.fornecedor || "Sem fornecedor"} · {fmtBRL(custoUnit)} /un
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSupply(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            trocar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Quantidade
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={qty || ""}
              onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
              className="h-9"
            />
            <TierSimulator
              currentQty={qty}
              disabled={!supply}
              compute={(q) => {
                const c = q * custoUnit;
                return { custo_total: c, preco_total: roundUp10(c * (1 + margem / 100)) };
              }}
              onPickQty={(q) => setQty(q)}
              onCloneAsTiers={onAddTiers ? submitAsTiers : undefined}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Margem ({margem.toFixed(0)}%)
          </Label>
          <Slider
            min={0}
            max={300}
            step={1}
            value={[margem]}
            onValueChange={(v) => setMargem(v[0] ?? 0)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Descrição (opcional)
        </Label>
        <Input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={supply ? `Padrão: ${supply.produto}` : "Selecione o suprimento primeiro"}
          className="h-9"
        />
      </div>

      {supply && (
        <div className="rounded-md border border-border/60 bg-background px-3 py-2.5 flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">
            Custo {fmtBRL(totalCusto)} · {qty} un
          </span>
          <span className="font-semibold text-primary tabular-nums">
            {fmtBRL(totalPreco)}
          </span>
        </div>
      )}

      <div className="flex items-center justify-end pt-2">
        <Button
          onClick={submit}
          disabled={!canAdd}
          className={cn(
            "min-w-[200px] transition-colors",
            pulse && "bg-emerald-600 hover:bg-emerald-600",
          )}
        >
          {pulse ? (
            <>
              <Check className="h-4 w-4 mr-2" /> Adicionado!
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" /> Adicionar suprimento
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
