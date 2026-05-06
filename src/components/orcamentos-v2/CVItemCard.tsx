import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, Trash2, Plus, X, ChevronDown, Megaphone, Lock, Wand2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  calcularItemCV,
  formatBRL,
  type CVMaterial,
  type CVPrinter,
  type CVFinish,
  type CVAppliedFinish,
  type CVCalcResult,
} from "@/lib/cv-pricing/engine";
import { marginTextClass, marginLabel } from "@/lib/quotes-v2/margin";

export interface CVItemState {
  id: string;
  material_id: string | null;
  printer_id: string | null;
  largura_cm: number;
  altura_cm: number;
  quantidade: number;
  acabamentos: Array<{
    finish_id: string;
    quantidade_unidades: number;
    /** Quando presente, é um acabamento avulso (não cadastrado), válido só neste orçamento. */
    custom?: { nome: string; valor: number };
  }>;
}

interface Props {
  item: CVItemState;
  index: number;
  materiais: CVMaterial[];
  impressoras: CVPrinter[];
  acabamentos: CVFinish[];
  onChange: (item: CVItemState) => void;
  onRemove: () => void;
  onResult: (result: CVCalcResult) => void;
}

export function CVItemCard({
  item, index, materiais, impressoras, acabamentos,
  onChange, onRemove, onResult,
}: Props) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  // Local state mirrors props for instant typing; debounced 150ms before recompute+propagate.
  const [local, setLocal] = useState(item);
  useEffect(() => setLocal(item), [item.id]); // re-sync on item swap

  // Debounce: only recompute and bubble up after pause
  const [debounced, setDebounced] = useState(local);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(local), 150);
    return () => clearTimeout(t);
  }, [local]);

  const material = useMemo(
    () => materiais.find((m) => m.id === debounced.material_id) || null,
    [materiais, debounced.material_id],
  );
  const printer = useMemo(
    () => impressoras.find((p) => p.id === debounced.printer_id) || null,
    [impressoras, debounced.printer_id],
  );

  // Intelligent filters: based on selected material's category
  const compatPrinters = useMemo(() => {
    if (!material) return impressoras;
    return impressoras.filter((p) => p.categorias_compativeis.includes(material.categoria));
  }, [impressoras, material]);
  const compatFinishes = useMemo(() => {
    if (!material) return acabamentos;
    return acabamentos.filter((f) => f.categoria_compativel.includes(material.categoria));
  }, [acabamentos, material]);

  // Auto-clear incompatible selections when material category changes
  useEffect(() => {
    if (!material) return;
    if (printer && !printer.categorias_compativeis.includes(material.categoria)) {
      setLocal((prev) => ({ ...prev, printer_id: null }));
    }
    setLocal((prev) => ({
      ...prev,
      acabamentos: prev.acabamentos.filter((a) => {
        if (a.custom) return true; // avulso é sempre compatível
        const f = acabamentos.find((x) => x.id === a.finish_id);
        return f && f.categoria_compativel.includes(material.categoria);
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material?.categoria]);

  // Map acabamentos refs → CVAppliedFinish[]
  const appliedFinishes: CVAppliedFinish[] = useMemo(() => {
    return debounced.acabamentos
      .map((a) => {
        if (a.custom) {
          const synth: CVFinish = {
            id: a.finish_id,
            nome: a.custom.nome || "Acabamento avulso",
            tipo_calculo: "fixo",
            custo: Number(a.custom.valor) || 0,
            margem_pct: 0,
            categoria_compativel: material ? [material.categoria] : [],
          };
          return { finish: synth, quantidade_unidades: 1 };
        }
        const f = acabamentos.find((x) => x.id === a.finish_id);
        if (!f) return null;
        return { finish: f, quantidade_unidades: a.quantidade_unidades };
      })
      .filter(Boolean) as CVAppliedFinish[];
  }, [debounced.acabamentos, acabamentos, material]);

  // Compute (memoised, pure)
  const result = useMemo(
    () => calcularItemCV({
      largura_cm: debounced.largura_cm,
      altura_cm: debounced.altura_cm,
      quantidade: debounced.quantidade,
      material,
      printer,
      acabamentos: appliedFinishes,
    }),
    [debounced, material, printer, appliedFinishes],
  );

  // Bubble up debounced state + result to parent (for persistence + total)
  useEffect(() => {
    onChange(debounced);
    onResult(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, result]);

  const updateField = <K extends keyof CVItemState>(key: K, value: CVItemState[K]) =>
    setLocal((prev) => ({ ...prev, [key]: value }));

  const addAcabamento = (finish: CVFinish) => {
    if (local.acabamentos.some((a) => a.finish_id === finish.id)) return;
    setLocal((prev) => ({
      ...prev,
      acabamentos: [...prev.acabamentos, { finish_id: finish.id, quantidade_unidades: 1 }],
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

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Megaphone className="h-4 w-4 text-primary" />
            Item {index + 1}
            {material && <Badge variant="outline" className="text-[10px]">{material.categoria}</Badge>}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Material + Printer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Material</Label>
            <Select
              value={local.material_id ?? ""}
              onValueChange={(v) => updateField("material_id", v || null)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione um material" /></SelectTrigger>
              <SelectContent>
                {materiais.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Impressora
              {material && compatPrinters.length < impressoras.length && (
                <span className="ml-1 text-muted-foreground">(filtrado p/ {material.categoria})</span>
              )}
            </Label>
            <Select
              value={local.printer_id ?? ""}
              onValueChange={(v) => updateField("printer_id", v || null)}
              disabled={!material}
            >
              <SelectTrigger><SelectValue placeholder={material ? "Selecione uma impressora" : "Escolha o material primeiro"} /></SelectTrigger>
              <SelectContent>
                {compatPrinters.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome} ({p.largura_max_cm}cm)</SelectItem>
                ))}
                {compatPrinters.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma impressora compatível</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dimensions */}
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

        {/* Area + emenda warning */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Área total: <span className="font-medium text-foreground">{result.area_total_m2.toFixed(2)} m²</span>
          </span>
        </div>
        {result.tem_emenda && printer && (
          <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Largura excede a impressora ({printer.largura_max_cm}cm). O material terá emenda.</span>
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
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={!material}>
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
                    {compatFinishes.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                        Nenhum acabamento cadastrado compatível com {material?.categoria || "este material"}.
                      </div>
                    ) : (
                      compatFinishes
                        .filter((f) => !local.acabamentos.some((a) => a.finish_id === f.id))
                        .map((f) => (
                          <button
                            key={f.id}
                            onClick={() => { addAcabamento(f); setFinishPickerOpen(false); }}
                            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                          >
                            <span>{f.nome}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {f.tipo_calculo === "unidade" ? "un" :
                               f.tipo_calculo === "mt2" ? "m²" :
                               f.tipo_calculo === "perimetro_metro" ? "perím." : "fixo"}
                            </span>
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
                const f = acabamentos.find((x) => x.id === a.finish_id);
                if (!f) return null;
                const finishResult = result.finishes.find((r) => r.finish_id === f.id);
                return (
                  <div key={a.finish_id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                    <span className="flex-1 text-sm font-medium truncate">{f.nome}</span>
                    {f.tipo_calculo === "unidade" && (
                      <Input
                        type="number" min="1" step="1"
                        value={a.quantidade_unidades || 1}
                        onChange={(e) => updateAcabamentoQty(a.finish_id, parseInt(e.target.value) || 1)}
                        className="h-7 w-16 text-center text-xs"
                      />
                    )}
                    <span className="w-20 text-right text-sm font-semibold">
                      {finishResult ? formatBRL(finishResult.valor) : "—"}
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
          <span className="text-xl font-bold text-primary">{formatBRL(result.preco_total)}</span>
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
                    <p className="font-semibold">{formatBRL(result.preco_acabamentos)}</p>
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
