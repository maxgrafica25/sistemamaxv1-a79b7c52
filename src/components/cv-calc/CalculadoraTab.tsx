import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Calculator, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  calcular, formatBRL,
  type Midia, type Impressao, type Acabamento, type SangriasMm,
} from "@/lib/cv-calc/engine";

export default function CalculadoraTab() {
  const isAdmin = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [midias, setMidias] = useState<Midia[]>([]);
  const [impressoes, setImpressoes] = useState<Impressao[]>([]);
  const [acabamentos, setAcabamentos] = useState<Acabamento[]>([]);
  const [valorMinimo, setValorMinimo] = useState(35);
  const [sangrias, setSangrias] = useState<SangriasMm>({});

  const [largura, setLargura] = useState(90);
  const [altura, setAltura] = useState(120);
  const [quantidade, setQuantidade] = useState(1);
  const [midiaId, setMidiaId] = useState<string>("");
  const [impressaoId, setImpressaoId] = useState<string>("");
  const [acabamentoId, setAcabamentoId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [m, i, a, c] = await Promise.all([
        supabase.from("cv_calc_midias" as never).select("*").eq("ativo", true).order("sort_order"),
        supabase.from("cv_calc_impressoes" as never).select("*").eq("ativo", true).order("sort_order"),
        supabase.from("cv_calc_acabamentos" as never).select("*").eq("ativo", true).order("sort_order"),
        supabase.from("cv_calc_config" as never).select("valor_minimo, sangria_adesivo_mm, sangria_lona_mm, sangria_chapa_mm, sangria_outro_mm").maybeSingle(),
      ]);
      setMidias((m.data as never) ?? []);
      setImpressoes((i.data as never) ?? []);
      setAcabamentos((a.data as never) ?? []);
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
      setLoading(false);
    })();
  }, []);

  const midia = useMemo(() => midias.find((m) => m.id === midiaId) ?? null, [midias, midiaId]);
  const tipo = midia?.tipo_midia ?? null;

  const impressoesCompat = useMemo(
    () => (tipo ? impressoes.filter((i) => i.tipos_midia_compativeis.includes(tipo)) : impressoes),
    [impressoes, tipo],
  );
  const acabamentosCompat = useMemo(
    () => (tipo ? acabamentos.filter((a) => a.tipos_midia_compativeis.includes(tipo)) : acabamentos),
    [acabamentos, tipo],
  );

  useEffect(() => {
    if (impressaoId && !impressoesCompat.some((i) => i.id === impressaoId)) setImpressaoId("");
    if (acabamentoId && !acabamentosCompat.some((a) => a.id === acabamentoId)) setAcabamentoId("");
  }, [impressaoId, acabamentoId, impressoesCompat, acabamentosCompat]);

  const impressao = impressoesCompat.find((i) => i.id === impressaoId) ?? null;
  const acabamento = acabamentosCompat.find((a) => a.id === acabamentoId) ?? null;

  const result = useMemo(
    () => calcular({
      largura_cm: largura, altura_cm: altura, quantidade,
      midia, impressao, acabamento,
      acabamentos_pool: acabamentos,
      valor_minimo: valorMinimo,
    }),
    [largura, altura, quantidade, midia, impressao, acabamento, acabamentos, valorMinimo],
  );

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Entradas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" /> Dados da peça
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="lg">Largura (cm)</Label>
              <Input id="lg" type="number" min={0} value={largura}
                onChange={(e) => setLargura(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label htmlFor="al">Altura (cm)</Label>
              <Input id="al" type="number" min={0} value={altura}
                onChange={(e) => setAltura(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label htmlFor="qt">Quantidade</Label>
              <Input id="qt" type="number" min={1} value={quantidade}
                onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </div>

          <div>
            <Label>Mídia</Label>
            <Select value={midiaId} onValueChange={setMidiaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a mídia" /></SelectTrigger>
              <SelectContent>
                {midias.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Impressão</Label>
            <Select value={impressaoId} onValueChange={setImpressaoId} disabled={!midia}>
              <SelectTrigger>
                <SelectValue placeholder={midia ? "Selecione a impressão" : "Escolha a mídia primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {impressoesCompat.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {result.emenda_impressao && (
              <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Largura excede o limite da impressora — será necessária emenda de impressão.</span>
              </div>
            )}
          </div>

          <div>
            <Label>Acabamento</Label>
            <Select value={acabamentoId} onValueChange={setAcabamentoId} disabled={!midia}>
              <SelectTrigger>
                <SelectValue placeholder={midia ? "Selecione o acabamento (opcional)" : "Escolha a mídia primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {acabamentosCompat.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {result.info_bastao && (
              <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <span>
                  Bastão escolhido: <strong className="text-foreground">{result.info_bastao.escolhido}</strong>
                  {result.info_bastao.tipo === "emenda" && (
                    <Badge variant="destructive" className="ml-2 text-[10px]">
                      Emenda × {result.info_bastao.qtd}
                    </Badge>
                  )}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      <Card className="border-primary/30 lg:sticky lg:top-4 lg:self-start">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resultado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAdmin && (
            <>
              <DetailRow label="Área" value={`${result.area_m2.toFixed(2)} m²`} />
              <DetailRow label="Perímetro" value={`${result.perim_m.toFixed(2)} m`} />
              <DetailRow label="Mídia" value={formatBRL(result.preco_midia)} />
              <DetailRow label="Impressão" value={formatBRL(result.preco_impressao)} />
              <DetailRow label="Acabamento" value={formatBRL(result.preco_acabamento)} />
              <div className="border-t pt-2">
                <DetailRow label="Subtotal" value={formatBRL(result.subtotal)} bold />
              </div>
            </>
          )}

          <div className="rounded-md bg-primary/10 border border-primary/30 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {quantidade > 1 ? `Valor total (${quantidade}×)` : "Valor unitário"}
            </div>
            <div className="text-2xl font-bold text-primary">
              {formatBRL(quantidade > 1 ? result.valor_total : result.valor_unitario)}
            </div>
            {quantidade > 1 && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">Unitário: </span>
                <strong className="text-foreground">{formatBRL(result.valor_unitario)}</strong>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({
  label, value, bold, muted,
}: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
