import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Plus, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL } from "../shared/pricing";
import { genId, type V3CVItem } from "../types";
import { useV3CVCatalog } from "../shared/useV3CVCatalog";
import {
  calcular,
  type Acabamento as CVAcabamento,
} from "@/lib/cv-calc/engine";
import { filterAndSortForMidia } from "@/lib/cv-calc/media-order";

interface Props {
  onAdd: (item: V3CVItem) => void;
}

export function CVForm({ onAdd }: Props) {
  const cat = useV3CVCatalog();

  const [descricao, setDescricao] = useState("");
  const [largura_cm, setLargura] = useState(100);
  const [altura_cm, setAltura] = useState(100);
  const [quantidade, setQuantidade] = useState(1);
  const [midiaId, setMidiaId] = useState<string>("");
  const [impressaoId, setImpressaoId] = useState<string>("");
  const [acabIds, setAcabIds] = useState<string[]>([]);
  const [pulse, setPulse] = useState(false);

  const midia = useMemo(
    () => cat.midias.find((m) => m.id === midiaId) ?? null,
    [cat.midias, midiaId],
  );

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

  // Reset acabamentos incompatíveis
  useEffect(() => {
    setAcabIds((prev) => prev.filter((id) => acabamentosCompat.some((a) => a.id === id)));
  }, [acabamentosCompat]);

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
      </Field>

      <div
        className={cn(
          "rounded-md border px-3 py-2.5 flex items-center gap-3 transition-colors",
          impressao
            ? "border-primary/30 bg-primary/5"
            : "border-dashed border-border bg-muted/30",
        )}
      >
        <div
          className={cn(
            "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
            impressao ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Resolução de impressão
          </p>
          <p className="text-sm font-medium truncate">
            {impressao
              ? impressao.nome
              : !midia
                ? "Selecione a mídia primeiro"
                : "Nenhuma resolução compatível disponível"}
          </p>
          {impressao && (
            <p className="text-[11px] text-muted-foreground">
              Padrão recomendado · alta qualidade
            </p>
          )}
        </div>
      </div>

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

      {acabamentosCompat.length > 0 && (
        <Field label="Acabamentos">
          <div className="flex flex-wrap gap-2">
            {acabamentosCompat.map((a) => {
              const active = acabIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() =>
                    setAcabIds((prev) =>
                      prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                    )
                  }
                  className={cn(
                    "px-3 h-8 rounded-full text-sm border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input",
                  )}
                >
                  {a.nome}
                </button>
              );
            })}
          </div>
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
