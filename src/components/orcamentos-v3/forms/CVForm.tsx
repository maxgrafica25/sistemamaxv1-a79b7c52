import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Plus, AlertCircle, AlertTriangle, RotateCcw, Pencil, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuotePresets, type QuotePreset } from "../shared/useQuotePresets";
import { iconFor } from "../shared/presetIcons";
import { SavePresetDialog, type SavePresetPayload } from "../shared/SavePresetDialog";
import { fmtBRL } from "../shared/pricing";
import { genId, type ArtStatus, type V3CVItem, type V3Item } from "../types";
import { ArtePromptBlock } from "../shared/ArtePromptBlock";
import { stampArt, makeArtThirdParty, makeArtInternal } from "../shared/artStatus";
import { toast } from "sonner";
import { useV3CVCatalog } from "../shared/useV3CVCatalog";
import {
  calcular,
  type Acabamento as CVAcabamento,
} from "@/lib/cv-calc/engine";
import { filterAndSortForMidia } from "@/lib/cv-calc/media-order";
import { SOBRA_CM } from "../shared/bastaoSuggester";
import { buildCvDescricao } from "../shared/buildCvDescricao";
import { TierFaixasPanel } from "../shared/TierFaixasPanel";

// Extrai o tamanho (cm) de chips do tipo "Banner (Bastão topo e base até 105cm + ...)"
function parseBastaoCm(nome: string): number | null {
  const m = nome.match(/at[ée]\s*(\d+)\s*cm/i);
  return m ? Number(m[1]) : null;
}
function isBastaoFinish(nome: string): boolean {
  return /bast[ãa]o|banner.*at[ée]\s*\d+\s*cm/i.test(nome);
}
function isBannerFinish(nome: string): boolean {
  // Banner pode usar qualquer acabamento típico (bastão, ponteira, ilhós, bainha, etc.)
  return /bast[ãa]o|banner|ponteira|cordinha|faixa|ilh[óo]s|bainha|refor[çc]o|emenda|dupla\s*face/i.test(nome);
}
function isLonaOnlyFinish(nome: string): boolean {
  // Lona pura: exclui explicitamente acabamentos exclusivos de banner
  return !/bast[ãa]o|banner|ponteira|cordinha|faixa/i.test(nome);
}

interface Props {
  onAdd: (item: V3Item) => void;
  onAddTiers?: (items: V3Item[]) => void;
}

export function CVForm({ onAdd, onAddTiers }: Props) {
  const cat = useV3CVCatalog();

  // Pergunta "Tem arte pronta?"
  const [artStatus, setArtStatus] = useState<ArtStatus | null>(null);
  const [artTercValue, setArtTercValue] = useState<number>(0);

  // null = Personalizado (padrão); caso contrário, id do preset ativo
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [descricaoEditada, setDescricaoEditada] = useState(false);
  const [largura_cm, setLargura] = useState(100);
  const [altura_cm, setAltura] = useState(100);
  const [quantidade, setQuantidade] = useState(1);
  const [midiaId, setMidiaId] = useState<string>("");
  const [impressaoId, setImpressaoId] = useState<string>("");
  const [acabIds, setAcabIds] = useState<string[]>([]);
  const [pulse, setPulse] = useState(false);
  const [isBanner, setIsBanner] = useState(false);
  const [bannerTouched, setBannerTouched] = useState(false);
  const [extraTiers, setExtraTiers] = useState<number[]>([]);

  const { presets: cvPresets, reload: reloadCvPresets } = useQuotePresets("cv");
  const [saveOpen, setSaveOpen] = useState(false);

  const applyPreset = (p: QuotePreset) => {
    setActivePresetId(p.id);
    if (p.largura_cm != null) setLargura(Number(p.largura_cm));
    else if (p.is_banner) setLargura(0);
    if (p.altura_cm != null) setAltura(Number(p.altura_cm));
    else if (p.is_banner) setAltura(0);
    if (p.quantidade_padrao != null) setQuantidade(p.quantidade_padrao);
    setIsBanner(p.is_banner);
    setBannerTouched(true);
    // Escolha de mídia: 1) trecho do nome  2) primeira do tipo  3) qualquer
    let found = undefined as ReturnType<typeof cat.midias.find>;
    if (p.midia_nome_match) {
      const re = new RegExp(p.midia_nome_match, "i");
      found = cat.midias.find((m) => re.test(`${m.nome} ${m.tipo_midia}`));
    }
    if (!found && p.midia_tipo) {
      found = cat.midias.find((m) => m.tipo_midia === p.midia_tipo);
    }
    if (found) setMidiaId(found.id);
    setDescricaoEditada(false);
  };



  const midia = useMemo(
    () => cat.midias.find((m) => m.id === midiaId) ?? null,
    [cat.midias, midiaId],
  );

  const isLona = useMemo(
    () => /lona|banner|vinil/i.test((midia?.tipo_midia || "") + " " + (midia?.nome || "")),
    [midia],
  );

  // Default "É banner?" baseado no nome da mídia — só enquanto usuário não tocou o toggle nem aplicou preset.
  useEffect(() => {
    if (!midia) { setIsBanner(false); setBannerTouched(false); return; }
    if (!isLona) { setIsBanner(false); return; }
    if (bannerTouched) return;
    const detected = /banner/i.test(midia.nome || "");
    setIsBanner(detected);
    if (detected) { setLargura(0); setAltura(0); }
  }, [midia, isLona, bannerTouched]);


  // Impressoras compatíveis com a mídia selecionada
  const impressoesCompat = useMemo(() => {
    if (!midia) return cat.impressoes;
    return cat.impressoes.filter((i) =>
      !i.tipos_midia_compativeis?.length ||
      i.tipos_midia_compativeis.includes(midia.tipo_midia),
    );
  }, [cat.impressoes, midia]);

  // Acabamentos compatíveis + ordenados pela mídia
  const acabamentosCompat = useMemo<CVAcabamento[]>(() => {
    return filterAndSortForMidia(cat.acabamentos, midia?.tipo_midia ?? null);
  }, [cat.acabamentos, midia]);

  // Filtra acabamentos pelo modo Lona × Banner
  const acabamentosView = useMemo<CVAcabamento[]>(() => {
    if (!isLona) return acabamentosCompat;
    if (isBanner) return acabamentosCompat.filter((a) => isBannerFinish(a.nome));
    return acabamentosCompat.filter((a) => isLonaOnlyFinish(a.nome));
  }, [acabamentosCompat, isLona, isBanner]);

  // Sugestão de bastão baseada na largura
  const necessarioBastaoCm = largura_cm > 0 ? largura_cm + 2 * SOBRA_CM : 0;
  const bastaoSugerido = useMemo<CVAcabamento | null>(() => {
    if (!isLona || !isBanner || !necessarioBastaoCm) return null;
    const candidatos = acabamentosView
      .map((a) => ({ a, cm: parseBastaoCm(a.nome) }))
      .filter((x): x is { a: CVAcabamento; cm: number } => x.cm != null && x.cm >= necessarioBastaoCm)
      .sort((x, y) => x.cm - y.cm);
    return candidatos[0]?.a ?? null;
  }, [acabamentosView, isLona, isBanner, necessarioBastaoCm]);
  const semBastaoCabe = isLona && isBanner && necessarioBastaoCm > 0 && !bastaoSugerido &&
    acabamentosView.some((a) => parseBastaoCm(a.nome) != null);

  // Auto-seleciona o bastão sugerido se nenhum chip de bastão estiver marcado ainda
  useEffect(() => {
    if (!bastaoSugerido) return;
    setAcabIds((prev) => {
      const jaMarcouBastao = prev.some((id) => {
        const ac = acabamentosView.find((a) => a.id === id);
        return ac && parseBastaoCm(ac.nome) != null;
      });
      if (jaMarcouBastao) return prev;
      return [...prev, bastaoSugerido.id];
    });
  }, [bastaoSugerido, acabamentosView]);

  // Auto-seleciona "Impressão solvente alta resolução" (ou primeira compatível como fallback)
  useEffect(() => {
    if (impressoesCompat.length === 0) {
      if (impressaoId) setImpressaoId("");
      return;
    }
    const preferida = impressoesCompat.find((i) =>
      i.nome?.toLowerCase().includes("solvente alta resolu"),
    );
    const escolhida = preferida ?? impressoesCompat[0];
    if (escolhida.id !== impressaoId) setImpressaoId(escolhida.id);
  }, [impressoesCompat, impressaoId]);

  // Reset acabamentos que saíram da view
  useEffect(() => {
    setAcabIds((prev) => prev.filter((id) => acabamentosView.some((a) => a.id === id)));
  }, [acabamentosView]);

  const impressao = useMemo(
    () => cat.impressoes.find((i) => i.id === impressaoId) ?? null,
    [cat.impressoes, impressaoId],
  );

  const acabamentosAplicados = useMemo(
    () =>
      acabIds
        .map((id) => cat.acabamentos.find((a) => a.id === id))
        .filter((a): a is CVAcabamento => !!a)
        .map((a) => ({ acabamento: a })),
    [acabIds, cat.acabamentos],
  );

  // Auto-gera descrição inteligente quando o usuário não editou manualmente
  useEffect(() => {
    if (descricaoEditada) return;
    const auto = buildCvDescricao({
      midia,
      isLona,
      isBanner,
      impressao: impressao,
      largura_cm,
      altura_cm,
      quantidade,
      acabamentos: acabamentosAplicados.map((a) => a.acabamento),
    });
    setDescricao(auto);
    // impressao referenciado abaixo — recalc via deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descricaoEditada, midia, isLona, isBanner, impressaoId, largura_cm, altura_cm, quantidade, acabIds]);

  const result = useMemo(() => {
    if (!midia) return null;
    return calcular({
      largura_cm,
      altura_cm,
      quantidade,
      midia,
      impressao,
      acabamentos: acabamentosAplicados,
      acabamentos_pool: cat.acabamentos,
      valor_minimo: cat.valorMinimo,
      markup: cat.markup,
      hourRate: cat.hourRate,
    });
  }, [
    midia, impressao, largura_cm, altura_cm, quantidade,
    acabamentosAplicados, cat.acabamentos, cat.valorMinimo, cat.markup, cat.hourRate,
  ]);

  const canAdd =
    !cat.loading &&
    descricao.trim().length > 0 &&
    !!midia &&
    largura_cm > 0 &&
    altura_cm > 0 &&
    quantidade > 0 &&
    !!result &&
    result.valor_total > 0;

  const buildItem = (qty: number, tierGroupId?: string): V3CVItem | null => {
    if (!midia) return null;
    const r = calcular({
      largura_cm,
      altura_cm,
      quantidade: qty,
      midia,
      impressao,
      acabamentos: acabamentosAplicados,
      acabamentos_pool: cat.acabamentos,
      valor_minimo: cat.valorMinimo,
      markup: cat.markup,
      hourRate: cat.hourRate,
    });
    if (!r || r.valor_total <= 0) return null;
    const efetivo = r.acabamento_efetivo;
    return {
      id: genId(),
      kind: "cv",
      descricao: descricao.trim(),
      tier_group_id: tierGroupId ?? null,
      midia_id: midia.id,
      midia_nome: midia.nome,
      custo_mt2: midia.custo_mt2,
      margem_mt2_pct: 0,
      largura_m: largura_cm / 100,
      altura_m: altura_cm / 100,
      quantidade: qty,
      finishings: acabamentosAplicados.map((a) => a.acabamento.nome),
      impressao_id: impressao?.id ?? null,
      impressao_nome: impressao?.nome ?? null,
      acabamento_ids: acabIds,
      acabamentos_qtd_unidades: {},
      snapshot: {
        preco_total: r.valor_total,
        custo_total: r.custo_total,
        preco_midia: r.preco_midia,
        preco_impressao: r.preco_impressao,
        preco_acabamentos: r.preco_acabamento,
        area_total_m2: r.area_m2,
        perim_m: r.perim_m,
        tem_emenda: r.emenda_impressao,
        aplicou_minimo: r.aplicou_minimo,
        acabamento_efetivo_id: efetivo?.id ?? null,
        acabamento_efetivo_nome: efetivo?.nome ?? null,
      },
    };
  };

  const artBlockedReason = (): string | null =>
    !artStatus
      ? "Responda 'Tem arte pronta?' antes de adicionar."
      : artStatus === "terceirizada" && artTercValue <= 0
        ? "Informe o valor da arte terceirizada."
        : null;

  const emitWithArt = (items: V3CVItem[], emit: (xs: V3Item[]) => void) => {
    const reason = artBlockedReason();
    if (reason) { toast.warning(reason); return; }
    const stamped = stampArt(items as V3Item[], artStatus);
    let toEmit: V3Item[] = stamped;
    if (artStatus === "terceirizada" && artTercValue > 0) {
      const leader = stamped[0];
      let bundleId = (leader as { bundle_id?: string | null } | undefined)?.bundle_id ?? null;
      if (leader && !bundleId) {
        bundleId = `bnd_${Date.now().toString(36)}`;
        toEmit = stamped.map((it, idx) =>
          idx === 0
            ? ({ ...it, bundle_id: bundleId, bundle_label: (it as { descricao?: string }).descricao || "Com. Visual" } as V3Item)
            : it,
        );
      }
      const art = makeArtThirdParty(artTercValue, bundleId);
      if (art) toEmit = [...toEmit, art];
    }
    emit(toEmit);
    setArtStatus(null);
    setArtTercValue(0);
  };

  const submit = () => {
    if (!canAdd) return;
    const cleanExtras = [...new Set(extraTiers)]
      .filter((q) => q > 0 && q !== quantidade)
      .sort((a, b) => a - b);
    if (cleanExtras.length > 0 && onAddTiers) {
      submitAsTiers([quantidade, ...cleanExtras], quantidade);
      setExtraTiers([]);
      return;
    }
    const item = buildItem(quantidade);
    if (!item) return;
    emitWithArt([item], (xs) => xs.forEach((x) => onAdd(x)));
    setDescricao("");
    setDescricaoEditada(false);
    setAcabIds([]);
    setExtraTiers([]);
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  const submitAsTiers = (qtys: number[], primaryQty: number) => {
    if (!onAddTiers) return;
    const tg = `tg_${genId()}`;
    const items = qtys
      .map((q) => {
        const it = buildItem(q, tg);
        return it ? ({ ...it, tier_primary: q === primaryQty } as V3CVItem) : null;
      })
      .filter((x): x is V3CVItem => !!x);
    if (items.length === 0) return;
    emitWithArt(items, (xs) => onAddTiers(xs));
    setDescricao("");
    setDescricaoEditada(false);
    setAcabIds([]);
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5 flex-1 flex flex-col">
      <ArtePromptBlock
        value={artStatus}
        onChange={setArtStatus}
        terceirizadaValue={artTercValue}
        onTerceirizadaValueChange={setArtTercValue}
      />
      {/* Descrição — acima do toggle */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Descrição
          </Label>
          {descricaoEditada && (
            <button
              type="button"
              onClick={() => setDescricaoEditada(false)}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <RotateCcw className="h-3 w-3" /> Regenerar
            </button>
          )}
        </div>
        <Input
          value={descricao}
          onChange={(e) => {
            const v = e.target.value;
            setDescricao(v);
            setDescricaoEditada(v.trim().length > 0);
          }}
          placeholder="Gerada automaticamente — edite se quiser"
          className="h-9"
        />
      </div>

      {/* Chips: Personalizado + favoritos + Salvar preset */}
      {(() => {
        const isCustom = !activePresetId;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActivePresetId(null)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isCustom
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
              Personalizado
            </button>
            {cvPresets.map((p) => {
              const active = p.id === activePresetId;
              const Icon = iconFor(p.icone);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {p.nome}
                </button>
              );
            })}
            {isCustom && midia && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSaveOpen(true)}
                className="h-7 text-xs text-muted-foreground hover:text-primary ml-auto"
                title="Salva a configuração atual como um botão rápido em favoritos"
              >
                <Star className="h-3.5 w-3.5" />
                Salvar como favorito
              </Button>
            )}
          </div>
        );
      })()}
      {!activePresetId && midia && (() => {
        const tipoSupported = ["lona", "adesivo", "chapa"].includes(midia.tipo_midia ?? "");
        const nameMatch = (midia.nome ?? "").split(/\s+/).slice(0, 2).join(" ").toLowerCase() || null;
        const resumo: { label: string; value: string }[] = [];
        if (largura_cm > 0 && altura_cm > 0) resumo.push({ label: "Tamanho", value: `${largura_cm} × ${altura_cm} cm` });
        if (midia.nome) resumo.push({ label: "Mídia", value: midia.nome });
        if (isBanner) resumo.push({ label: "Banner", value: "sim (filtra acabamentos de banner)" });
        const payload: SavePresetPayload = {
          modulo: "cv",
          form_tipo: null,
          largura_cm: largura_cm > 0 ? largura_cm : null,
          altura_cm: altura_cm > 0 ? altura_cm : null,
          is_banner: isBanner,
          midia_tipo: tipoSupported ? (midia.tipo_midia as "lona" | "adesivo" | "chapa") : null,
          midia_nome_match: nameMatch,
          quantidade_atual: quantidade,
          resumo,
        };
        return (
          <SavePresetDialog
            open={saveOpen}
            onOpenChange={setSaveOpen}
            payload={payload}
            onSaved={reloadCvPresets}
          />
        );
      })()}





      <Field label="Mídia (catálogo CV)">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Select value={midiaId} onValueChange={setMidiaId} disabled={cat.loading}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={cat.loading ? "Carregando..." : "Selecione a mídia"} />
              </SelectTrigger>
              <SelectContent>
                {cat.midias.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome} <span className="text-muted-foreground">· {m.tipo_midia}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isLona && (
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer shrink-0 rounded-md border border-primary/30 bg-primary/5 px-3 h-9">
              É banner?
              <Switch checked={isBanner} onCheckedChange={(v) => { setIsBanner(!!v); setBannerTouched(true); if (v) { setLargura(0); setAltura(0); } }} />
            </label>
          )}
        </div>
      </Field>

      {midia && (
        <Field label="Resolução de impressão">
          {impressoesCompat.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma resolução compatível disponível
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {impressoesCompat.map((i) => {
                const active = impressaoId === i.id;
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setImpressaoId(i.id)}
                    className={cn(
                      "px-3 h-8 rounded-full text-sm border transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-input",
                    )}
                  >
                    {i.nome}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Field label="Largura (cm)">
          <Input
            type="number" step="1" min={0}
            value={largura_cm === 0 ? "" : largura_cm}
            placeholder="—"
            onChange={(e) => setLargura(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
        <Field label="Altura (cm)">
          <Input
            type="number" step="1" min={0}
            value={altura_cm === 0 ? "" : altura_cm}
            placeholder="—"
            onChange={(e) => setAltura(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />

        </Field>
        <Field label="Quantidade">
          <Input
            type="number" min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
            className="h-9"
          />
        </Field>
      </div>

      {onAddTiers && (
        <TierFaixasPanel
          currentQty={quantidade}
          disabled={!midia || largura_cm <= 0 || altura_cm <= 0}
          onExtrasChange={setExtraTiers}
          compute={(q) => {
            if (!midia) return { custo_total: 0, preco_total: 0 };
            const r = calcular({
              largura_cm,
              altura_cm,
              quantidade: q,
              midia,
              impressao,
              acabamentos: acabamentosAplicados,
              acabamentos_pool: cat.acabamentos,
              valor_minimo: cat.valorMinimo,
              markup: cat.markup,
              hourRate: cat.hourRate,
            });
            return { custo_total: r.custo_total, preco_total: r.valor_total };
          }}
        />
      )}

      <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Área total</span>
        <span className="font-semibold tabular-nums">
          {(result?.area_m2 ?? 0).toFixed(2).replace(".", ",")} m²
          {result?.emenda_impressao && (
            <span className="ml-2 text-amber-600 text-xs">· com emenda</span>
          )}
        </span>
      </div>

      {acabamentosView.length > 0 && (
        <Field label="Acabamentos">
          <div className="flex flex-wrap gap-2">
            {acabamentosView.map((a) => {
              const active = acabIds.includes(a.id);
              const bastaoCm = parseBastaoCm(a.nome);
              const isBastao = bastaoCm != null;
              const naoCabe = isBastao && necessarioBastaoCm > 0 && bastaoCm! < necessarioBastaoCm;
              const sugerido = bastaoSugerido?.id === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={naoCabe}
                  onClick={() =>
                    setAcabIds((prev) => {
                      if (prev.includes(a.id)) return prev.filter((x) => x !== a.id);
                      if (isBastao) {
                        // Apenas 1 bastão por vez: remove outros bastões da seleção
                        const semOutrosBastoes = prev.filter((id) => {
                          const ac = acabamentosView.find((x) => x.id === id);
                          return !ac || parseBastaoCm(ac.nome) == null;
                        });
                        return [...semOutrosBastoes, a.id];
                      }
                      return [...prev, a.id];
                    })
                  }
                  title={naoCabe ? `Não cabe na largura + ${2 * SOBRA_CM}cm de sobra` : undefined}
                  className={cn(
                    "px-3 h-8 rounded-full text-sm border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input",
                    sugerido && !active && "ring-2 ring-primary/40 border-primary/40",
                    naoCabe && "opacity-40 cursor-not-allowed",
                  )}
                >
                  {a.nome}
                  {sugerido && !active && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-primary font-semibold">
                      melhor aproveitamento
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {isLona && isBanner && necessarioBastaoCm > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Sugestão baseada em largura ({largura_cm}cm) + {2 * SOBRA_CM}cm de sobra para ponteiras = {necessarioBastaoCm}cm úteis.
            </p>
          )}
          {semBastaoCabe && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Nenhum bastão do catálogo cabe — considere marcar "Emenda" e usar 2 bastões.
            </p>
          )}
        </Field>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 mt-auto -mb-5 lg:-mb-0 bg-background border-t border-border shadow-[0_-8px_16px_-8px_hsl(var(--background))] flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {result?.aplicou_minimo && (
            <span className="inline-flex items-center gap-1 text-amber-600 mr-3">
              <AlertCircle className="h-3 w-3" /> mínimo aplicado
            </span>
          )}
          Pré-visualização:{" "}
          <span className="font-semibold text-foreground">
            {fmtBRL(result?.valor_total ?? 0)}
          </span>
        </div>
        <Button
          onClick={submit}
          disabled={!canAdd}
          className={cn(
            "min-w-[200px] transition-colors",
            pulse && "bg-emerald-600 hover:bg-emerald-600",
          )}
        >
          {pulse ? (
            <><Check className="h-4 w-4 mr-2" /> Adicionado!</>
          ) : (
            <><Plus className="h-4 w-4 mr-2" /> Adicionar ao orçamento</>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
