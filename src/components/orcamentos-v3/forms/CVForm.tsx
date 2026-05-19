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
import { Check, Plus, AlertCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL } from "../shared/pricing";
import { genId, type V3CVItem } from "../types";
import { useV3CVCatalog } from "../shared/useV3CVCatalog";
import {
  calcular,
  type Acabamento as CVAcabamento,
} from "@/lib/cv-calc/engine";
import { filterAndSortForMidia } from "@/lib/cv-calc/media-order";
import { SOBRA_CM } from "../shared/bastaoSuggester";
import { buildCvDescricao } from "../shared/buildCvDescricao";

// Extrai o tamanho (cm) de chips do tipo "Banner (Bastão topo e base até 105cm + ...)"
function parseBastaoCm(nome: string): number | null {
  const m = nome.match(/at[ée]\s*(\d+)\s*cm/i);
  return m ? Number(m[1]) : null;
}
function isBastaoFinish(nome: string): boolean {
  return /bast[ãa]o|banner.*at[ée]\s*\d+\s*cm/i.test(nome);
}
function isBannerFinish(nome: string): boolean {
  return /banner|bast[ãa]o|ponteira|cordinha|ilh[óo]s|bainha|emenda|dupla\s*face|faixa/i.test(nome);
}
function isLonaOnlyFinish(nome: string): boolean {
  // Acabamentos típicos de lona (não-banner)
  return /refile|lona|ilh[óo]s|bainha|dupla\s*face/i.test(nome) && !/bast[ãa]o|banner|ponteira|cordinha|faixa/i.test(nome);
}

interface Props {
  onAdd: (item: V3CVItem) => void;
}

export function CVForm({ onAdd }: Props) {
  const cat = useV3CVCatalog();

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

  const midia = useMemo(
    () => cat.midias.find((m) => m.id === midiaId) ?? null,
    [cat.midias, midiaId],
  );

  const isLona = useMemo(
    () => /lona|banner|vinil/i.test((midia?.tipo_midia || "") + " " + (midia?.nome || "")),
    [midia],
  );

  // Default "É banner?" quando o nome já indicar banner
  useEffect(() => {
    if (!midia) { setIsBanner(false); return; }
    if (isLona) setIsBanner(/banner/i.test(midia.nome || ""));
    else setIsBanner(false);
  }, [midia, isLona]);

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

  const submit = () => {
    if (!canAdd || !midia || !result) return;
    const efetivo = result.acabamento_efetivo;
    onAdd({
      id: genId(),
      kind: "cv",
      descricao: descricao.trim(),
      midia_id: midia.id,
      midia_nome: midia.nome,
      custo_mt2: midia.custo_mt2,
      margem_mt2_pct: 0,
      largura_m: largura_cm / 100,
      altura_m: altura_cm / 100,
      quantidade,
      finishings: acabamentosAplicados.map((a) => a.acabamento.nome),
      impressao_id: impressao?.id ?? null,
      impressao_nome: impressao?.nome ?? null,
      acabamento_ids: acabIds,
      acabamentos_qtd_unidades: {},
      snapshot: {
        preco_total: result.valor_total,
        custo_total: result.custo_total,
        preco_midia: result.preco_midia,
        preco_impressao: result.preco_impressao,
        preco_acabamentos: result.preco_acabamento,
        area_total_m2: result.area_m2,
        perim_m: result.perim_m,
        tem_emenda: result.emenda_impressao,
        aplicou_minimo: result.aplicou_minimo,
        acabamento_efetivo_id: efetivo?.id ?? null,
        acabamento_efetivo_nome: efetivo?.nome ?? null,
      },
    });
    setDescricao("");
    setAcabIds([]);
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5">
      <Field label="Descrição">
        <Input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: Banner promocional fachada"
          className="h-9"
        />
      </Field>

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
              <Switch checked={isBanner} onCheckedChange={(v) => setIsBanner(!!v)} />
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
            value={largura_cm}
            onChange={(e) => setLargura(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
        <Field label="Altura (cm)">
          <Input
            type="number" step="1" min={0}
            value={altura_cm}
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
                  onClick={() =>
                    setAcabIds((prev) =>
                      prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                    )
                  }
                  title={naoCabe ? `Não cabe na largura + ${2 * SOBRA_CM}cm de sobra` : undefined}
                  className={cn(
                    "px-3 h-8 rounded-full text-sm border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input",
                    sugerido && !active && "ring-2 ring-primary/40 border-primary/40",
                    naoCabe && !active && "opacity-50",
                  )}
                >
                  {a.nome}
                  {sugerido && !active && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-primary font-semibold">
                      sugerido
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

      <div className="flex items-center justify-between pt-2">
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
