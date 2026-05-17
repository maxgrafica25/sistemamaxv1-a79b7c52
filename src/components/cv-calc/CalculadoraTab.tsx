import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, AlertTriangle, Calculator, Info, Plus, Trash2, Copy, Receipt, Package,
  Flag, AlignHorizontalJustifyCenter, Square, Megaphone, Pencil, RotateCcw, ChevronDown, Check, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useHourRate } from "@/hooks/useHourRate";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import {
  calcular, formatBRL, detectarTipoProduto,
  type Midia, type Impressao, type Acabamento, type SangriasMm, type CalcResult,
  type MarkupSettings, type RecipeItem, type TipoProduto,
} from "@/lib/cv-calc/engine";
import { calcKitPrice, type KitDef, type KitConsumoTipo, type KitPricingMode, type KitPriceResult } from "@/lib/kitPricing";

type Item = {
  id: string;
  largura: number;
  altura: number;
  quantidade: number;
  midiaId: string;
  impressaoId: string;
  acabamentoId: string;
  kitId: string;
  /** Nome customizado pelo usuário (sobrescreve a sugestão automática). */
  nomeOverride?: string;
};

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const newItem = (): Item => ({
  id: uid(),
  largura: 0,
  altura: 0,
  quantidade: 1,
  midiaId: "",
  impressaoId: "",
  acabamentoId: "",
  kitId: "",
});

const tipoIconMap: Record<TipoProduto, typeof Flag> = {
  banner: Flag,
  faixa: AlignHorizontalJustifyCenter,
  lona: Square,
  outro: Megaphone,
};

export default function CalculadoraTab() {
  const isAdmin = useIsAdmin();
  const { hourRate } = useHourRate();
  const { settings: globalSettings } = useGlobalSettings();
  const [loading, setLoading] = useState(true);
  const [midias, setMidias] = useState<Midia[]>([]);
  const [impressoes, setImpressoes] = useState<Impressao[]>([]);
  const [acabamentos, setAcabamentos] = useState<Acabamento[]>([]);
  const [kits, setKits] = useState<KitDef[]>([]);
  const [valorMinimo, setValorMinimo] = useState(35);
  const [sangrias, setSangrias] = useState<SangriasMm>({});
  const [markup, setMarkup] = useState<MarkupSettings | undefined>(undefined);

  const [items, setItems] = useState<Item[]>([newItem()]);

  useEffect(() => {
    (async () => {
      const [m, i, a, c, gs, recipes, supplies, kitGroups, kitItems] = await Promise.all([
        supabase.from("cv_calc_midias" as never).select("*").eq("ativo", true).order("sort_order"),
        supabase.from("cv_calc_impressoes" as never).select("*").eq("ativo", true).order("sort_order"),
        supabase.from("cv_calc_acabamentos" as never).select("*").eq("ativo", true).order("sort_order"),
        supabase.from("cv_calc_config" as never).select("valor_minimo, sangria_adesivo_mm, sangria_lona_mm, sangria_chapa_mm, sangria_outro_mm").maybeSingle(),
        supabase.from("global_settings" as never).select("tax_pct, invoice_pct, credit_card_pct, collection_fee_pct, default_margin_pct").maybeSingle(),
        supabase.from("cv_calc_acabamento_recipe_items" as never).select("acabamento_id, supply_id, consumo_qty, consumo_tipo"),
        supabase.from("supplies").select("id, valor_unitario"),
        supabase.from("material_groups").select("id, name, pricing_mode, labor_minutes, margin_pct, modulo, is_kit").eq("is_kit", true).contains("modulo", ["cv"]).order("name"),
        supabase.from("material_group_items").select("id, material_group_id, description, quantity, unit_price, consumo_tipo, supply_id, sort_order").order("sort_order"),
      ]);

      // monta map supply_id -> custo unitário
      const supplyCost = new Map<string, number>();
      ((supplies.data as { id: string; valor_unitario: number }[]) ?? [])
        .forEach((s) => supplyCost.set(s.id, Number(s.valor_unitario) || 0));

      // agrupa receita por acabamento
      const recipeByAc = new Map<string, RecipeItem[]>();
      ((recipes.data as { acabamento_id: string; supply_id: string; consumo_qty: number; consumo_tipo: RecipeItem["consumo_tipo"] }[]) ?? [])
        .forEach((r) => {
          const arr = recipeByAc.get(r.acabamento_id) ?? [];
          arr.push({
            supply_id: r.supply_id,
            supply_custo_unitario: supplyCost.get(r.supply_id) ?? 0,
            consumo_qty: Number(r.consumo_qty) || 0,
            consumo_tipo: r.consumo_tipo,
          });
          recipeByAc.set(r.acabamento_id, arr);
        });

      const acabamentos = ((a.data as Acabamento[]) ?? []).map((ac) => ({
        ...ac,
        recipe: recipeByAc.get(ac.id) ?? [],
      }));

      // Monta kits a partir de material_groups + material_group_items
      const itemsByKit = new Map<string, KitDef["items"]>();
      ((kitItems.data as Array<{ id: string; material_group_id: string; description: string; quantity: number; unit_price: number; consumo_tipo: string; supply_id: string | null }>) ?? [])
        .forEach((ki) => {
          const arr = itemsByKit.get(ki.material_group_id) ?? [];
          // Usa preço atualizado do suprimento quando disponível; fallback no snapshot
          const live = ki.supply_id ? supplyCost.get(ki.supply_id) : undefined;
          arr.push({
            id: ki.id,
            description: ki.description,
            quantity: Number(ki.quantity) || 0,
            unit_price: live ?? (Number(ki.unit_price) || 0),
            consumo_tipo: (ki.consumo_tipo as KitConsumoTipo) ?? "fixo",
          });
          itemsByKit.set(ki.material_group_id, arr);
        });
      const kitsParsed: KitDef[] = ((kitGroups.data as Array<{ id: string; name: string; pricing_mode: string; labor_minutes: number; margin_pct: number | null }>) ?? [])
        .map((k) => ({
          id: k.id,
          name: k.name,
          pricing_mode: (k.pricing_mode as KitPricingMode) ?? "fixo",
          labor_minutes: Number(k.labor_minutes) || 0,
          margin_pct: k.margin_pct,
          items: itemsByKit.get(k.id) ?? [],
        }));

      setMidias((m.data as never) ?? []);
      setImpressoes((i.data as never) ?? []);
      setAcabamentos(acabamentos);
      setKits(kitsParsed);
      const cfg = c.data as {
        valor_minimo?: number;
        sangria_adesivo_mm?: number;
        sangria_lona_mm?: number;
        sangria_chapa_mm?: number;
        sangria_outro_mm?: number;
      } | null;
      if (cfg?.valor_minimo != null) setValorMinimo(Number(cfg.valor_minimo));
      setSangrias({
        adesivo: Number(cfg?.sangria_adesivo_mm ?? 3),
        lona: Number(cfg?.sangria_lona_mm ?? 0),
        chapa: Number(cfg?.sangria_chapa_mm ?? 0),
        outro: Number(cfg?.sangria_outro_mm ?? 0),
      });
      const gsData = (gs as { data: unknown }).data;
      if (gsData) setMarkup(gsData as MarkupSettings);
      setLoading(false);
    })();
  }, []);

  const patchItem = (id: string, patch: Partial<Item>) =>
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addItem = () => setItems((arr) => [...arr, newItem()]);
  const removeItem = (id: string) =>
    setItems((arr) => (arr.length <= 1 ? arr : arr.filter((it) => it.id !== id)));
  const cloneItem = (id: string) =>
    setItems((arr) => {
      const idx = arr.findIndex((it) => it.id === id);
      if (idx < 0) return arr;
      const copy = { ...arr[idx], id: uid() };
      return [...arr.slice(0, idx + 1), copy, ...arr.slice(idx + 1)];
    });

  const kitGlobals = useMemo(() => ({
    hourRate,
    tax_pct: globalSettings.tax_pct,
    invoice_pct: globalSettings.invoice_pct,
    collection_pct: globalSettings.collection_pct,
    collection_fee_pct: globalSettings.collection_fee_pct,
    credit_card_pct: globalSettings.credit_card_pct,
    waste_pct: globalSettings.waste_pct,
    default_margin_pct: globalSettings.default_margin_pct,
  }), [hourRate, globalSettings]);

  const results = useMemo(() => {
    return items.map((it) => {
      const midia = midias.find((m) => m.id === it.midiaId) ?? null;
      const impressao = impressoes.find((i) => i.id === it.impressaoId) ?? null;
      const acabamento = acabamentos.find((a) => a.id === it.acabamentoId) ?? null;
      const kit = kits.find((k) => k.id === it.kitId) ?? null;
      const res = calcular({
        largura_cm: it.largura,
        altura_cm: it.altura,
        quantidade: it.quantidade,
        midia, impressao, acabamento,
        acabamentos_pool: acabamentos,
        valor_minimo: valorMinimo,
        sangrias_mm: sangrias,
        markup,
      });
      const kitRes: KitPriceResult | null = kit
        ? calcKitPrice(kit, { largura_cm: it.largura, altura_cm: it.altura, quantidade: it.quantidade }, kitGlobals)
        : null;
      const tipoInfo = detectarTipoProduto(midia, acabamento ? [acabamento] : []);
      const nomeFinal = it.nomeOverride?.trim() || tipoInfo.nome;
      return { item: it, midia, kit, res, kitRes, tipoInfo, nomeFinal };
    });
  }, [items, midias, impressoes, acabamentos, kits, valorMinimo, sangrias, markup, kitGlobals]);

  const totalGeral = results.reduce((s, r) => s + r.res.valor_total + (r.kitRes?.precoVenda ?? 0), 0);
  const totalPecas = results.reduce((s, r) => s + r.item.quantidade, 0);

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Itens */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">
              Itens do orçamento
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({items.length} {items.length === 1 ? "item" : "itens"})
              </span>
            </h2>
          </div>
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
          </Button>
        </div>

        {results.map(({ item, midia, res, kit, kitRes, tipoInfo, nomeFinal }, idx) => (
          <ItemCard
            key={item.id}
            index={idx + 1}
            item={item}
            midia={midia}
            res={res}
            kit={kit}
            kitRes={kitRes}
            tipoInfo={tipoInfo}
            nomeFinal={nomeFinal}
            midias={midias}
            impressoes={impressoes}
            acabamentos={acabamentos}
            kits={kits}
            isAdmin={isAdmin}
            canRemove={items.length > 1}
            onChange={(patch) => patchItem(item.id, patch)}
            onClone={() => cloneItem(item.id)}
            onRemove={() => removeItem(item.id)}
          />
        ))}

        <Button variant="outline" className="w-full border-dashed" onClick={addItem}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar outro item
        </Button>
      </div>

      {/* Resumo */}
      <Card className="border-primary/30 lg:sticky lg:top-4 lg:self-start">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> Resumo do orçamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {results.map(({ item, res, kit, kitRes, tipoInfo, nomeFinal }, idx) => {
              const totalItem = res.valor_total + (kitRes?.precoVenda ?? 0);
              const unit = item.quantidade > 0 ? totalItem / item.quantidade : totalItem;
              const TipoIcon = tipoIconMap[tipoInfo.tipo];
              return (
                <ResumoItem
                  key={item.id}
                  index={idx + 1}
                  nome={nomeFinal}
                  Icon={TipoIcon}
                  largura={item.largura}
                  altura={item.altura}
                  quantidade={item.quantidade}
                  totalItem={totalItem}
                  unit={unit}
                  res={res}
                  kit={kit}
                  kitRes={kitRes}
                />
              );
            })}
          </div>

          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Total de peças</span>
              <span>{totalPecas}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Itens distintos</span>
              <span>{items.length}</span>
            </div>
          </div>

          <div className="rounded-md bg-primary/10 border border-primary/30 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Valor total do orçamento
            </div>
            <div className="text-3xl font-bold text-primary tabular-nums">
              {formatBRL(totalGeral)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

interface ItemCardProps {
  index: number;
  item: Item;
  midia: Midia | null;
  res: CalcResult;
  kit: KitDef | null;
  kitRes: KitPriceResult | null;
  midias: Midia[];
  impressoes: Impressao[];
  acabamentos: Acabamento[];
  kits: KitDef[];
  isAdmin: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<Item>) => void;
  onClone: () => void;
  onRemove: () => void;
}

function ItemCard({
  index, item, midia, res, kit, kitRes, midias, impressoes, acabamentos, kits,
  isAdmin, canRemove, onChange, onClone, onRemove,
}: ItemCardProps) {
  const tipo = midia?.tipo_midia ?? null;
  const impressoesCompat = tipo
    ? impressoes.filter((i) => i.tipos_midia_compativeis.includes(tipo))
    : impressoes;
  const acabamentosCompat = tipo
    ? acabamentos.filter((a) => a.tipos_midia_compativeis.includes(tipo))
    : acabamentos;

  // Reset incompat selections
  useEffect(() => {
    if (item.impressaoId && !impressoesCompat.some((i) => i.id === item.impressaoId)) {
      onChange({ impressaoId: "" });
    }
    if (item.acabamentoId && !acabamentosCompat.some((a) => a.id === item.acabamentoId)) {
      onChange({ acabamentoId: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5 border-b">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">Item {index}</Badge>
          {midia && (
            <span className="text-xs text-muted-foreground truncate">
              {midia.nome}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-primary tabular-nums">
            {formatBRL(res.valor_total + (kitRes?.precoVenda ?? 0))}
          </span>
          <div className="flex items-center gap-0.5">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClone} title="Duplicar item">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon" variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive disabled:opacity-30"
              onClick={onRemove} disabled={!canRemove} title="Remover item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Largura (cm)</Label>
            <Input type="number" min={0} value={item.largura}
              onChange={(e) => onChange({ largura: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <Label className="text-xs">Altura (cm)</Label>
            <Input type="number" min={0} value={item.altura}
              onChange={(e) => onChange({ altura: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <Label className="text-xs">Quantidade</Label>
            <Input type="number" min={1} value={item.quantidade}
              onChange={(e) => onChange({ quantidade: Math.max(1, Number(e.target.value) || 1) })} />
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <Label className="text-xs">Mídia</Label>
            <Select value={item.midiaId} onValueChange={(v) => onChange({ midiaId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {midias.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Impressão</Label>
            <Select value={item.impressaoId} onValueChange={(v) => onChange({ impressaoId: v })} disabled={!midia}>
              <SelectTrigger>
                <SelectValue placeholder={midia ? "Selecione" : "Escolha a mídia"} />
              </SelectTrigger>
              <SelectContent>
                {impressoesCompat.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Acabamento</Label>
            <Select value={item.acabamentoId} onValueChange={(v) => onChange({ acabamentoId: v })} disabled={!midia}>
              <SelectTrigger>
                <SelectValue placeholder={midia ? "Opcional" : "Escolha a mídia"} />
              </SelectTrigger>
              <SelectContent>
                {acabamentosCompat.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {kits.length > 0 && (
          <div>
            <Label className="text-xs flex items-center gap-1">
              <Package className="h-3 w-3 text-primary" /> Kit (Grupo de Materiais)
            </Label>
            <Select
              value={item.kitId || "none"}
              onValueChange={(v) => onChange({ kitId: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum kit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum kit</SelectItem>
                {kits.map((k) => (
                  <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {kit && kitRes && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Material {formatBRL(kitRes.custoMaterial)} · MO {formatBRL(kitRes.custoMO)} · Venda{" "}
                <span className="text-primary font-semibold">{formatBRL(kitRes.precoVenda)}</span>
                {" · Lucro "}<span className="text-green-600 font-medium">{formatBRL(kitRes.lucroLiquido)}</span>
              </p>
            )}
          </div>
        )}

        {(res.emenda_impressao || res.info_bastao) && (
          <div className="space-y-1">
            {res.emenda_impressao && (
              <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Largura excede o limite da impressora — emenda necessária.</span>
              </div>
            )}
            {res.info_bastao && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <span>
                  Bastão: <strong className="text-foreground">{res.info_bastao.escolhido}</strong>
                  {res.info_bastao.tipo === "emenda" && (
                    <Badge variant="destructive" className="ml-2 text-[10px]">
                      Emenda × {res.info_bastao.qtd}
                    </Badge>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {isAdmin && midia && (
          <div className="rounded-md bg-muted/30 p-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            <Mini label="Área" value={`${res.area_m2.toFixed(2)} m²`} />
            <Mini label="Perímetro" value={`${res.perim_m.toFixed(2)} m`} />
            <Mini label="Mídia" value={formatBRL(res.preco_midia)} />
            <Mini label="Impressão" value={formatBRL(res.preco_impressao)} />
            <Mini label="Acabamento" value={formatBRL(res.preco_acabamento)} />
            <Mini label="Subtotal" value={formatBRL(res.subtotal)} bold />
            {item.quantidade > 1 && (
              <Mini label="Unitário" value={formatBRL(res.valor_unitario)} muted />
            )}
            {res.sangria_aplicada_mm > 0 && (
              <Mini label="Sangria" value={`+${res.sangria_aplicada_mm} mm`} muted />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold text-foreground" : muted ? "text-muted-foreground" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
