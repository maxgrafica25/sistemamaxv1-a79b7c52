import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, Trash2, Plus, X, ChevronDown, Megaphone, Lock, Wand2, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  calcular,
  formatBRL,
  type Midia,
  type Impressao,
  type Acabamento,
  type AcabamentoAplicado,
  type CalcResult,
  type MarkupSettings,
} from "@/lib/cv-calc/engine";
import { marginTextClass, marginLabel } from "@/lib/quotes-v2/margin";

export interface CVItemState {
  id: string;
  /** legado: `material_id` mapeia agora para `midia_id` */
  material_id: string | null;
  /** legado: `printer_id` mapeia agora para `impressao_id` */
  printer_id: string | null;
  largura_cm: number;
  altura_cm: number;
  quantidade: number;
  acabamentos: Array<{
    finish_id: string;
    quantidade_unidades: number;
    /** Acabamento avulso, válido só neste orçamento. */
    custom?: { nome: string; valor: number };
  }>;
}

interface Props {
  item: CVItemState;
  index: number;
  midias: Midia[];
  impressoes: Impressao[];
  acabamentos: Acabamento[];
  valorMinimo: number;
  hourRate?: number;
  markup?: MarkupSettings;
  onChange: (item: CVItemState) => void;
  onRemove: () => void;
  onResult: (result: CalcResult) => void;
}

export function CVItemCard({
  item, index, midias, impressoes, acabamentos, valorMinimo, hourRate, markup,
  onChange, onRemove, onResult,
}: Props) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  // Local + debounce
  const [local, setLocal] = useState(item);
  useEffect(() => setLocal(item), [item.id]);

  const [debounced, setDebounced] = useState(local);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(local), 150);
    return () => clearTimeout(t);
  }, [local]);

  const midia = useMemo(
    () => midias.find((m) => m.id === debounced.material_id) || null,
    [midias, debounced.material_id],
  );
  const impressao = useMemo(
    () => impressoes.find((p) => p.id === debounced.printer_id) || null,
    [impressoes, debounced.printer_id],
  );
  const tipo = midia?.tipo_midia ?? null;

  // Filtros por compatibilidade com tipo_midia
  const compatImpressoes = useMemo(() => {
    if (!tipo) return impressoes;
    return impressoes.filter((p) => p.tipos_midia_compativeis.includes(tipo));
  }, [impressoes, tipo]);
  const compatAcabamentos = useMemo(() => {
    if (!tipo) return acabamentos;
    return acabamentos.filter((a) => a.tipos_midia_compativeis.includes(tipo));
  }, [acabamentos, tipo]);

  // Auto-limpar seleções incompatíveis
  useEffect(() => {
    if (!tipo) return;
    if (impressao && !impressao.tipos_midia_compativeis.includes(tipo)) {
      setLocal((prev) => ({ ...prev, printer_id: null }));
    }
    setLocal((prev) => ({
      ...prev,
      acabamentos: prev.acabamentos.filter((a) => {
        if (a.custom) return true;
        const f = acabamentos.find((x) => x.id === a.finish_id);
        return f && f.tipos_midia_compativeis.includes(tipo);
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  // Monta lista de acabamentos aplicados (incluindo avulsos sintéticos)
  const aplicados: AcabamentoAplicado[] = useMemo(() => {
    return debounced.acabamentos
      .map((a) => {
        if (a.custom) {
          const synth: Acabamento = {
            id: a.finish_id,
            nome: a.custom.nome || "Acabamento avulso",
            familia: "outro",
            tipos_midia_compativeis: tipo ? [tipo] : [],
            custo_fixo: Number(a.custom.valor) || 0,
            lucro_fixo: 0,
            custo_mt2: 0, lucro_mt2: 0,
            custo_perimetro: 0, lucro_perimetro: 0,
            custo_unidade: 0, lucro_unidade: 0,
            largura_max_cm: null,
          };
          return { acabamento: synth, qtd_unidades: 1 };
        }
        const f = acabamentos.find((x) => x.id === a.finish_id);
        if (!f) return null;
        return { acabamento: f, qtd_unidades: a.quantidade_unidades };
      })
      .filter(Boolean) as AcabamentoAplicado[];
  }, [debounced.acabamentos, acabamentos, tipo]);

  const result = useMemo(
    () => calcular({
      largura_cm: debounced.largura_cm,
      altura_cm: debounced.altura_cm,
      quantidade: debounced.quantidade,
      midia,
      impressao,
      acabamentos: aplicados,
      acabamentos_pool: acabamentos,
      valor_minimo: valorMinimo,
    }),
    [debounced, midia, impressao, aplicados, acabamentos, valorMinimo],
  );

  useEffect(() => {
    onChange(debounced);
    onResult(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, result]);

  const updateField = <K extends keyof CVItemState>(key: K, value: CVItemState[K]) =>
    setLocal((prev) => ({ ...prev, [key]: value }));

  const addAcabamento = (ac: Acabamento) => {
    if (local.acabamentos.some((a) => a.finish_id === ac.id)) return;
    setLocal((prev) => ({
      ...prev,
      acabamentos: [...prev.acabamentos, { finish_id: ac.id, quantidade_unidades: 1 }],
    }));
  };
  const removeAcabamento = (finishId: string) =>
    setLocal((prev) => ({ ...prev, acabamentos: prev.acabamentos.filter((a) => a.finish_id !== finishId) }));
  const updateAcabamentoQty = (finishId: string, qty: number) =>
    setLocal((prev) => ({
      ...prev,
      acabamentos: prev.acabamentos.map((a) => (a.finish_id === finishId ? { ...a, quantidade_unidades: qty } : a)),
    }));

  const addCustomAcabamento = (nome: string, valor: number) => {
    const id = `custom-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    setLocal((prev) => ({
      ...prev,
      acabamentos: [
        ...prev.acabamentos,
        { finish_id: id, quantidade_unidades: 1, custom: { nome, valor } },
      ],
    }));
  };

  const [finishPickerOpen, setFinishPickerOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customNome, setCustomNome] = useState("");
  const [customValor, setCustomValor] = useState("");
  const resetCustom = () => { setCustomMode(false); setCustomNome(""); setCustomValor(""); };

  // Detecta detalhe do bastão para mostrar emenda
  const detalheBastao = result.acabamentos_detalhe.find((d) => d.info_bastao);

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Megaphone className="h-4 w-4 text-primary" />
            Item {index + 1}
            {midia && <Badge variant="outline" className="text-[10px]">{midia.tipo_midia}</Badge>}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Mídia + Impressão */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mídia</Label>
            <Select
              value={local.material_id ?? ""}
              onValueChange={(v) => updateField("material_id", v || null)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione uma mídia" /></SelectTrigger>
              <SelectContent>
                {midias.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Impressão
              {tipo && compatImpressoes.length < impressoes.length && (
                <span className="ml-1 text-muted-foreground">(filtrado p/ {tipo})</span>
              )}
            </Label>
            <Select
              value={local.printer_id ?? ""}
              onValueChange={(v) => updateField("printer_id", v || null)}
              disabled={!midia}
            >
              <SelectTrigger>
                <SelectValue placeholder={midia ? "Selecione uma impressão" : "Escolha a mídia primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {compatImpressoes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}{p.largura_max_cm ? ` (${p.largura_max_cm}cm)` : ""}
                  </SelectItem>
                ))}
                {compatImpressoes.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma impressão compatível</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dimensões */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Largura (cm)</Label>
            <div className="relative">
              <Input
                type="number" inputMode="decimal" step="0.1" min="0"
                value={local.largura_cm || ""}
                onChange={(e) => updateField("largura_cm", parseFloat(e.target.value) || 0)}
                className="pr-9"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">cm</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Altura (cm)</Label>
            <div className="relative">
              <Input
                type="number" inputMode="decimal" step="0.1" min="0"
                value={local.altura_cm || ""}
                onChange={(e) => updateField("altura_cm", parseFloat(e.target.value) || 0)}
                className="pr-9"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">cm</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quantidade</Label>
            <Input
              type="number" inputMode="numeric" step="1" min="1"
              value={local.quantidade || ""}
              onChange={(e) => updateField("quantidade", parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        {/* Área + avisos */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Área: <span className="font-medium text-foreground">{result.area_m2.toFixed(2)} m²</span>
            <span className="mx-2">·</span>
            Perímetro: <span className="font-medium text-foreground">{result.perim_m.toFixed(2)} m</span>
          </span>
        </div>
        {result.emenda_impressao && impressao && (
          <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Largura excede a impressão ({impressao.largura_max_cm}cm). Haverá emenda.</span>
          </div>
        )}
        {detalheBastao?.info_bastao && (
          <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>
              Bastão escolhido: <strong>{detalheBastao.info_bastao.escolhido}</strong>
              {detalheBastao.info_bastao.tipo === "emenda" && (
                <Badge variant="destructive" className="ml-2 text-[10px]">
                  Emenda × {detalheBastao.info_bastao.qtd}
                </Badge>
              )}
            </span>
          </div>
        )}

        {/* Acabamentos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Acabamentos</Label>
            <Popover
              open={finishPickerOpen}
              onOpenChange={(o) => { setFinishPickerOpen(o); if (!o) resetCustom(); }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={!midia}>
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-1" align="end">
                {customMode ? (
                  <div className="p-2 space-y-2">
                    <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Wand2 className="h-3.5 w-3.5 text-primary" /> Acabamento avulso
                    </div>
                    <Input
                      autoFocus
                      placeholder="Nome (ex: Ilhós dourado)"
                      value={customNome}
                      onChange={(e) => setCustomNome(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number" inputMode="decimal" step="0.01" min="0"
                      placeholder="Valor total (R$)"
                      value={customValor}
                      onChange={(e) => setCustomValor(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Válido apenas neste orçamento. Não será salvo no cadastro.
                    </p>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetCustom}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm" className="h-7 text-xs"
                        disabled={!customNome.trim() || !(parseFloat(customValor) > 0)}
                        onClick={() => {
                          addCustomAcabamento(customNome.trim(), parseFloat(customValor) || 0);
                          resetCustom();
                          setFinishPickerOpen(false);
                        }}
                      >
                        Adicionar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setCustomMode(true)}
                      className="flex w-full items-center gap-2 rounded-sm border border-dashed border-primary/40 bg-primary/5 px-2 py-1.5 text-left text-sm text-primary hover:bg-primary/10 mb-1"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      <span className="font-medium">Adicionar acabamento avulso</span>
                    </button>
                    {compatAcabamentos.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                        Nenhum acabamento compatível com {tipo || "esta mídia"}.
                      </div>
                    ) : (
                      compatAcabamentos
                        .filter((f) => !local.acabamentos.some((a) => a.finish_id === f.id))
                        .map((f) => (
                          <button
                            key={f.id}
                            onClick={() => { addAcabamento(f); setFinishPickerOpen(false); }}
                            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                          >
                            <span>{f.nome}</span>
                            <span className="text-[10px] text-muted-foreground">{f.familia}</span>
                          </button>
                        ))
                    )}
                  </>
                )}
              </PopoverContent>
            </Popover>
          </div>
          {local.acabamentos.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum acabamento aplicado.</p>
          ) : (
            <div className="space-y-1.5">
              {local.acabamentos.map((a) => {
                const isCustom = !!a.custom;
                const f = isCustom ? null : acabamentos.find((x) => x.id === a.finish_id);
                if (!isCustom && !f) return null;
                const detalhe = result.acabamentos_detalhe.find((r) => r.acabamento_id === a.finish_id);
                const nome = isCustom ? (a.custom!.nome || "Acabamento avulso") : f!.nome;
                // Mostra input de quantidade só para famílias unidade-based
                const usaUnidade = !isCustom && f && (f.custo_unidade > 0 || f.lucro_unidade > 0)
                  && f.familia !== "banner_bastao"; // bastão auto-selecionado
                return (
                  <div key={a.finish_id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                    <span className="flex-1 text-sm font-medium truncate flex items-center gap-1.5">
                      {nome}
                      {isCustom && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">avulso</Badge>
                      )}
                    </span>
                    {usaUnidade && (
                      <Input
                        type="number" min="1" step="1"
                        value={a.quantidade_unidades || 1}
                        onChange={(e) => updateAcabamentoQty(a.finish_id, parseInt(e.target.value) || 1)}
                        className="h-7 w-16 text-center text-xs"
                      />
                    )}
                    <span className="w-20 text-right text-sm font-semibold">
                      {detalhe ? formatBRL(detalhe.preco) : "—"}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAcabamento(a.finish_id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Total do item</span>
            {result.aplicou_minimo && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Lock className="h-2.5 w-2.5" /> mínimo
              </Badge>
            )}
          </div>
          <span className="text-xl font-bold text-primary">{formatBRL(result.valor_total)}</span>
        </div>

        {/* Admin-only: Saúde do orçamento */}
        {isAdmin && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors">
                <span className="font-medium">Saúde do orçamento (admin)</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="rounded-md bg-muted/40 border p-3 space-y-2 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Mídia</p>
                    <p className="font-semibold">{formatBRL(result.preco_midia)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Impressão</p>
                    <p className="font-semibold">{formatBRL(result.preco_impressao)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Acabamentos</p>
                    <p className="font-semibold">{formatBRL(result.preco_acabamento)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Custo total</p>
                    <p className="font-semibold">{formatBRL(result.custo_total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Lucro líquido</p>
                    <p className="font-semibold">{formatBRL(result.lucro_liquido)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Margem</p>
                    <p className={`font-semibold ${marginTextClass(result.margem_pct)}`}>
                      {result.margem_pct.toFixed(1)}% · {marginLabel(result.margem_pct)}
                    </p>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
