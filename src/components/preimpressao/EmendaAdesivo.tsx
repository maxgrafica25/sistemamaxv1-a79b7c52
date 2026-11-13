// Pré-impressão → ferramenta "Emenda de adesivo" (grande formato).
// Solta a arte inteira, escolhe (ou deixa o sistema sugerir) o rolo e ele fatia a arte em partes com
// sobreposição para colar uma sobre a outra, respeitando a margem de borda do rolo. Tudo no navegador.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Download, FileArchive, Loader2, Plus, X, XCircle } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MARGEM_ROLO_PADRAO_CM,
  ROLOS_PADRAO_CM,
  SOBREPOSICAO_PADRAO_CM,
  compararRolos,
  conferirEmenda,
  formatarCm,
  gerarEmenda,
  melhorCorte,
  tamanhoFinal,
  type ArteEmenda,
  type EmendaGerada,
  type PlanoEmenda,
} from "@/lib/preimpressao/emenda";
import { PT_POR_CM, detectarTipo, dpiEfetivo, lerInfoImagem, normalizarRotacao, type InfoImagem } from "@/lib/preimpressao/margem";
import { baixarBlob, baixarZip, converterEps } from "@/lib/preimpressao/navegador";
import { Campo, Chave, DuasColunas, NotaPrivacidade, Painel, Passo, PreviaPdf, Segmentado, SoltarArquivo } from "./ui";
import { useConfigSalva } from "./uteis";

interface Config {
  /** Rolos cadastrados (largura em cm) e os que o atendente desligou. */
  rolos: number[];
  desligados: number[];
  margemRolo: string;
  sobreposicao: string;
  escala: string;
  guias: boolean;
}

const PADRAO: Config = { rolos: ROLOS_PADRAO_CM, desligados: [], margemRolo: String(MARGEM_ROLO_PADRAO_CM), sobreposicao: String(SOBREPOSICAO_PADRAO_CM), escala: "100", guias: true };

interface ArteLida {
  nome: string;
  tipo: "pdf" | "imagem";
  bytes: Uint8Array;
  imagem?: "png" | "jpg";
  info?: InfoImagem;
  /** PDF: tamanho da página 1 em cm. */
  pdfCm?: { w: number; h: number };
  paginas?: number;
}

const num = (s: string) => Number.parseFloat(s.replace(",", ".").trim());
const valida = (s: string, min: number, max: number) => {
  const v = num(s);
  return Number.isFinite(v) && v >= min && v <= max ? v : null;
};

async function lerArte(file: File): Promise<ArteLida> {
  let bytes = new Uint8Array(await file.arrayBuffer());
  let tipo = detectarTipo(bytes, file.name);
  if (tipo === "cdr") throw new Error("Arquivo do Corel (.cdr) não pode ser lido aqui. No CorelDRAW use Arquivo → Exportar… → PDF e envie o PDF.");
  if (tipo === "desconhecido") throw new Error("Formato não suportado. Envie PDF, PNG, JPG ou EPS.");
  if (tipo === "eps") {
    bytes = await converterEps(bytes);
    tipo = "pdf";
  }
  if (tipo === "pdf") {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const page = doc.getPages()[0];
    if (!page) throw new Error("O PDF não tem páginas.");
    const { width: w, height: h } = page.getCropBox();
    const gira = normalizarRotacao(page.getRotation().angle) % 180 === 90;
    return { nome: file.name, tipo: "pdf", bytes, pdfCm: { w: (gira ? h : w) / PT_POR_CM, h: (gira ? w : h) / PT_POR_CM }, paginas: doc.getPageCount() };
  }
  return { nome: file.name, tipo: "imagem", bytes, imagem: tipo, info: lerInfoImagem(bytes, tipo) };
}

const CORES = ["#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#14b8a6"];

/** Mapa do corte: a arte desenhada em escala, com as partes e as faixas de sobreposição. */
function MapaDeCortes({ art, plano, sobreposicao }: { art: { w: number; h: number }; plano: PlanoEmenda; sobreposicao: number }) {
  const MAXW = 560;
  const MAXH = 340;
  const esc = Math.min(MAXW / art.w, MAXH / art.h);
  const W = art.w * esc;
  const H = art.h * esc;
  const x0 = 20;
  const y0 = 28;
  const colunas = plano.corte === "colunas";
  return (
    <svg viewBox={`0 0 ${W + 2 * x0} ${H + y0 + 34}`} role="img" aria-label="Mapa do corte da arte" className="mx-auto h-auto w-full max-w-[640px]">
      <rect x={x0} y={y0} width={W} height={H} fill="#fff" stroke="#94a3b8" />
      {plano.faixas.map((f, k) => {
        const a = f.inicio * esc;
        const b = f.fim * esc;
        const cor = CORES[k % CORES.length];
        const x = colunas ? x0 + a : x0;
        const y = colunas ? y0 : y0 + a;
        const w = colunas ? b - a : W;
        const h = colunas ? H : b - a;
        return (
          <g key={k}>
            <rect x={x} y={y} width={w} height={h} fill={cor} fillOpacity={0.18} stroke={cor} strokeWidth={1.2} />
            <text x={x + w / 2} y={y + h / 2 - 2} textAnchor="middle" fontSize={Math.max(11, Math.min(20, Math.min(w, h) / 4))} fontWeight={700} fill={cor}>
              Parte {k + 1}
            </text>
            <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" fontSize={10} fill="#475569">
              {formatarCm(colunas ? f.fim - f.inicio : f.fim - f.inicio)}
            </text>
          </g>
        );
      })}
      {plano.faixas.slice(1).map((f, k) => {
        const a = f.inicio * esc;
        const o = sobreposicao * esc;
        return colunas ? (
          <rect key={`o${k}`} x={x0 + a} y={y0} width={o} height={H} fill="#ef4444" fillOpacity={0.35} />
        ) : (
          <rect key={`o${k}`} x={x0} y={y0 + a} width={W} height={o} fill="#ef4444" fillOpacity={0.35} />
        );
      })}
      <text x={x0 + W / 2} y={y0 - 10} textAnchor="middle" fontSize={11} fill="#334155">
        {formatarCm(art.w)}
      </text>
      <text x={x0 + W + 4} y={y0 + H / 2} fontSize={11} fill="#334155" transform={`rotate(90 ${x0 + W + 4} ${y0 + H / 2})`} textAnchor="middle">
        {formatarCm(art.h)}
      </text>
      <g transform={`translate(${x0} ${y0 + H + 22})`}>
        <rect width={14} height={10} fill="#ef4444" fillOpacity={0.35} />
        <text x={20} y={9} fontSize={11} fill="#475569">
          sobreposição de {formatarCm(sobreposicao)} (a parte seguinte cobre esta faixa)
        </text>
      </g>
    </svg>
  );
}

export default function EmendaAdesivo() {
  const [salvo, set] = useConfigSalva<Config>("preimpressao.emenda.config.v1", PADRAO);
  const cfg = useMemo<Config>(() => ({ ...PADRAO, ...salvo }), [salvo]);
  const [arte, setArte] = useState<ArteLida | null>(null);
  const [erroArte, setErroArte] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [larguraReal, setLarguraReal] = useState("");
  const [novoRolo, setNovoRolo] = useState("");
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const [aba, setAba] = useState<"mapa" | "pdf">("mapa");
  const [pdf, setPdf] = useState<EmendaGerada | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);
  const [acao, setAcao] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);

  const margem = valida(cfg.margemRolo, 0, 20);
  const sobre = valida(cfg.sobreposicao, 0.5, 20);
  const escalaPct = valida(cfg.escala, 1, 1000);
  const ativos = useMemo(() => cfg.rolos.filter((r) => !cfg.desligados.includes(r)), [cfg.rolos, cfg.desligados]);

  // Tamanho da arte a 100%
  const medidas = useMemo(() => {
    if (!arte) return null;
    if (arte.tipo === "pdf" && arte.pdfCm) return { w: arte.pdfCm.w, h: arte.pdfCm.h, falta: false };
    const info = arte.info;
    if (!info) return null;
    const dpi = dpiEfetivo(info, valida(larguraReal, 1, 5000));
    if (!dpi) return { w: 0, h: 0, falta: true };
    return { w: (info.larguraPx / dpi) * 2.54, h: (info.alturaPx / dpi) * 2.54, falta: false };
  }, [arte, larguraReal]);

  const artEmenda: ArteEmenda | null = useMemo(() => {
    if (!arte || !medidas || medidas.falta) return null;
    return { tipo: arte.tipo, bytes: arte.bytes, imagem: arte.imagem, wCm: medidas.w, hCm: medidas.h };
  }, [arte, medidas]);

  const art = useMemo(() => (artEmenda && escalaPct ? tamanhoFinal(artEmenda, escalaPct) : null), [artEmenda, escalaPct]);
  const pronto = !!art && margem !== null && sobre !== null && ativos.length > 0;
  const comparacao = useMemo(() => (art && margem !== null && sobre !== null ? compararRolos(art, ativos, margem, sobre) : []), [art, margem, sobre, ativos]);
  const sugerido = comparacao[0] ?? null;
  const plano: PlanoEmenda | null = useMemo(() => {
    if (!art || margem === null || sobre === null) return null;
    if (escolhido !== null && ativos.includes(escolhido)) return melhorCorte(art, escolhido, margem, sobre);
    return sugerido;
  }, [art, margem, sobre, escolhido, ativos, sugerido]);

  const receber = async (files: File[]) => {
    if (!files[0]) return;
    setLendo(true);
    try {
      setArte(await lerArte(files[0]));
      setErroArte(null);
      setLarguraReal("");
      setEscolhido(null);
    } catch (e) {
      setErroArte(e instanceof Error ? e.message : "Não consegui abrir o arquivo.");
    } finally {
      setLendo(false);
    }
  };

  // PDF das partes (refeito sozinho a cada ajuste)
  useEffect(() => {
    if (!pronto || !artEmenda || !plano || sobre === null || escalaPct === null) {
      setPdf(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(() => {
      gerarEmenda(artEmenda, plano, { escalaPct, sobreposicaoCm: sobre, guias: cfg.guias })
        .then((r) => {
          if (!vivo) return;
          setPdf(r);
          setErroPdf(null);
        })
        .catch((e) => vivo && setErroPdf(e instanceof Error ? e.message : "Não foi possível montar as partes."))
        .finally(() => vivo && setGerando(false));
    }, 500);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [pronto, artEmenda, plano, sobre, escalaPct, cfg.guias]);

  const conferencia = useMemo(() => {
    if (!art || !plano || margem === null || sobre === null || escalaPct === null) return [];
    const itens = conferirEmenda(art, plano, { escalaPct, sobreposicaoCm: sobre, margemRolo: margem });
    if (arte?.tipo === "pdf" && (arte.paginas ?? 1) > 1) itens.push({ nivel: "atencao", texto: `O PDF tem ${arte.paginas} páginas: só a 1ª foi usada.` });
    if (arte?.tipo === "imagem" && arte.info?.dpi == null && !valida(larguraReal, 1, 5000)) itens.push({ nivel: "atencao", texto: "A imagem não informa o tamanho: digite a largura real." });
    return itens;
  }, [art, plano, margem, sobre, escalaPct, arte, larguraReal]);

  const nomeBase = (arte?.nome ?? "arte").replace(/\.[a-z0-9]{2,5}$/i, "");

  const executar = async (nome: string, fn: () => Promise<void>) => {
    setAcao(nome);
    setErroPdf(null);
    try {
      await fn();
    } catch (e) {
      setErroPdf(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setAcao(null);
    }
  };

  const baixarPartes = () =>
    executar("zip", async () => {
      if (!artEmenda || !plano || sobre === null || escalaPct === null) return;
      const arquivos: { nome: string; blob: Blob }[] = [];
      for (let k = 0; k < plano.partes; k++) {
        setAcao(`zip ${k + 1}/${plano.partes}`);
        const r = await gerarEmenda(artEmenda, plano, { escalaPct, sobreposicaoCm: sobre, guias: cfg.guias }, [k]);
        arquivos.push({ nome: `${nomeBase}_parte_${k + 1}_de_${plano.partes}.pdf`, blob: new Blob([r.bytes], { type: "application/pdf" }) });
      }
      await baixarZip(arquivos, `${nomeBase}_partes.zip`);
    });

  const adicionarRolo = () => {
    const v = valida(novoRolo, 20, 400);
    if (v === null) return;
    const r = Math.round(v * 10) / 10;
    if (!cfg.rolos.includes(r)) set("rolos", [...cfg.rolos, r].sort((a, b) => a - b));
    set("desligados", cfg.desligados.filter((d) => d !== r));
    setNovoRolo("");
  };

  const esquerda = (
    <Painel className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Emenda de adesivo</h2>
        <p className="text-sm text-muted-foreground">Solte a arte inteira. O sistema fatia em partes que cabem no rolo, com sobreposição para colar, e sugere o rolo que melhor aproveita.</p>
      </div>
      <NotaPrivacidade />

      <Campo titulo="1. Arte inteira" ajuda="PDF, PNG, JPG ou EPS no tamanho final (1:1), ou em escala (use o campo “Escala” abaixo).">
        <SoltarArquivo
          titulo="Solte a arte aqui"
          dica="PDF, PNG, JPG ou EPS"
          arquivo={arte ? { nome: arte.nome, detalhe: medidas && !medidas.falta ? `${formatarCm(medidas.w)} × ${formatarCm(medidas.h)}` : arte.tipo === "pdf" ? "PDF" : "falta o tamanho" } : null}
          aceita=".pdf,.png,.jpg,.jpeg,.eps,application/pdf,image/png,image/jpeg,application/postscript"
          carregando={lendo}
          erro={erroArte}
          onArquivos={(f) => void receber(f)}
        />
        {arte?.tipo === "imagem" && arte.info && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-muted-foreground">
              {arte.info.dpi ? `Imagem de ${arte.info.larguraPx} × ${arte.info.alturaPx} px a ${Math.round(arte.info.dpi)} dpi.` : `Imagem de ${arte.info.larguraPx} × ${arte.info.alturaPx} px, sem tamanho no arquivo.`} Se o tamanho estiver errado, digite a largura real:
            </p>
            <input
              inputMode="decimal"
              value={larguraReal}
              onChange={(e) => setLarguraReal(e.target.value)}
              placeholder="largura real em cm (ex.: 250)"
              aria-label="Largura real da arte em centímetros"
              className="h-10 w-full rounded-full bg-muted/60 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
        )}
        <div className="mt-4">
          <p className="mb-1 text-xs text-muted-foreground">Escala da arte (100% = a arte já está no tamanho final)</p>
          <Passo valor={cfg.escala} onChange={(v) => set("escala", v)} passo={10} min={1} max={1000} sufixo="%" rotulo="escala da arte" invalido={escalaPct === null} />
          <div className="mt-2 flex flex-wrap gap-2">
            {["100", "50", "25", "10"].map((p) => (
              <button key={p} type="button" onClick={() => set("escala", p === "100" ? "100" : String(Math.round(10000 / Number(p))))} className="rounded-full bg-muted/70 px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                {p === "100" ? "1:1" : `arte em 1:${100 / Number(p)} → ${Math.round(10000 / Number(p))}%`}
              </button>
            ))}
          </div>
        </div>
      </Campo>

      <Campo titulo="2. Rolos cadastrados" ajuda="Clique para ligar ou desligar. O sistema só compara os ligados. A lista fica salva neste computador.">
        <div className="flex flex-wrap gap-2">
          {cfg.rolos.map((r) => {
            const on = !cfg.desligados.includes(r);
            return (
              <span key={r} className={cn("flex items-center rounded-full text-sm font-medium ring-1 ring-border/60", on ? "bg-foreground text-background" : "bg-background text-muted-foreground line-through")}>
                <button type="button" className="rounded-l-full py-1.5 pl-3 pr-2" onClick={() => set("desligados", on ? [...cfg.desligados, r] : cfg.desligados.filter((d) => d !== r))} aria-pressed={on}>
                  {r} cm
                </button>
                <button type="button" aria-label={`Apagar o rolo de ${r} cm`} className="rounded-r-full py-1.5 pl-1 pr-2 opacity-70 hover:opacity-100" onClick={() => set("rolos", cfg.rolos.filter((x) => x !== r))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            inputMode="decimal"
            value={novoRolo}
            onChange={(e) => setNovoRolo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarRolo()}
            placeholder="Largura do rolo (cm)"
            aria-label="Largura do novo rolo em centímetros"
            className="h-10 min-w-0 flex-1 rounded-full bg-muted/60 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <Button className="rounded-full" onClick={adicionarRolo} disabled={valida(novoRolo, 20, 400) === null}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar
          </Button>
        </div>
        <Button size="sm" variant="ghost" className="mt-2 rounded-full" onClick={() => setConfigPadrao()}>
          Voltar à lista padrão
        </Button>
      </Campo>

      <Campo titulo="3. Margem e sobreposição" ajuda={margem !== null ? `Exemplo: rolo de 107 cm − ${formatarCm(margem)} de borda = ${formatarCm(107 - margem)} de área de impressão.` : undefined}>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Margem de borda do rolo (total, somando os dois lados)</p>
            <Passo valor={cfg.margemRolo} onChange={(v) => set("margemRolo", v)} passo={0.5} min={0} max={20} sufixo="cm" rotulo="margem de borda do rolo" invalido={margem === null} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Sobreposição entre as partes</p>
            <Passo valor={cfg.sobreposicao} onChange={(v) => set("sobreposicao", v)} passo={0.5} min={0.5} max={20} sufixo="cm" rotulo="sobreposição" invalido={sobre === null} />
          </div>
          <Chave ligado={cfg.guias} onChange={(v) => set("guias", v)}>
            <span className="font-medium">Guia e número da parte na sobreposição</span>
            <span className="block text-xs text-muted-foreground">Uma linha pontilhada e “PARTE 1/3” em cinza 50%, só na faixa que a parte seguinte cobre (some depois de colar).</span>
          </Chave>
        </div>
      </Campo>
    </Painel>
  );

  function setConfigPadrao() {
    set("rolos", ROLOS_PADRAO_CM);
    set("desligados", []);
  }

  const direita = (
    <>
      <Painel className="space-y-4">
        <Segmentado
          valor={aba}
          opcoes={[
            { valor: "mapa" as const, rotulo: "Mapa do corte" },
            { valor: "pdf" as const, rotulo: "Partes (PDF)" },
          ]}
          onChange={(v) => setAba(v)}
        />
        {!pronto || !plano || !art ? (
          <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-muted/30 px-6 text-center text-sm text-muted-foreground">
            {medidas?.falta ? "Digite a largura real da imagem para continuar." : ativos.length === 0 ? "Ligue pelo menos um rolo." : "Solte a arte para ver o corte."}
          </div>
        ) : aba === "mapa" ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-muted/30 p-4">
              <MapaDeCortes art={art} plano={plano} sobreposicao={sobre ?? 0} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { t: "Rolo", v: `${plano.rolo} cm` },
                { t: "Partes", v: plano.partes === 1 ? "1 (sem emenda)" : `${plano.partes} · ${plano.emendas} emenda${plano.emendas > 1 ? "s" : ""}` },
                { t: "Rolo gasto", v: `${plano.metrosLineares.toFixed(2).replace(".", ",")} m` },
                { t: "Aproveitamento", v: `${Math.round(plano.aproveitamento * 100)}%` },
              ].map((d) => (
                <div key={d.t} className="rounded-2xl bg-muted/40 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{d.t}</p>
                  <p className="text-sm font-semibold">{d.v}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <PreviaPdf bytes={pdf?.bytes ?? null} paginas={pdf?.paginas ?? 0} rotulos={(n) => `Parte ${n + 1} de ${plano.partes}`} pagina={pagina} onPagina={setPagina} ocupado={gerando} vazio="Montando as partes…" />
        )}
      </Painel>

      {comparacao.length > 0 && (
        <Painel className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Qual rolo rende mais?</p>
            {escolhido !== null && (
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setEscolhido(null)}>
                Usar o sugerido
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            {comparacao.map((c, n) => {
              const atual = plano?.rolo === c.rolo;
              return (
                <button
                  key={c.rolo}
                  type="button"
                  onClick={() => setEscolhido(c.rolo)}
                  className={cn("flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/60", atual ? "bg-primary/10 ring-1 ring-primary/40" : "bg-muted/30")}
                >
                  <span className="font-semibold">
                    Rolo de {c.rolo} cm
                    {n === 0 && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">sugerido</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c.partes === 1 ? "sem emenda" : `${c.partes} partes de ${formatarCm(c.larguraParte)}`} · {c.metrosLineares.toFixed(2).replace(".", ",")} m de rolo · {Math.round(c.aproveitamento * 100)}% aproveitado
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Menos rolo gasto vem primeiro; em empate, menos emendas. Clique em um rolo para usar esse.</p>
        </Painel>
      )}

      {conferencia.length > 0 && (
        <Painel className="space-y-3">
          <p className="text-sm font-medium">Conferência</p>
          <ul className="space-y-1.5">
            {conferencia.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                {c.nivel === "ok" ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : c.nivel === "atencao" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}
                <span className={c.nivel === "ok" ? "text-muted-foreground" : "text-foreground"}>{c.texto}</span>
              </li>
            ))}
          </ul>
          {erroPdf && <p className="text-xs text-destructive">{erroPdf}</p>}
        </Painel>
      )}

      {plano && plano.partes > 1 && (
        <Painel className="space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Como colar</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Imprima as partes no rolo de {plano.rolo} cm, sem escala, e numere pelo nome do arquivo ou pela página.</li>
            <li>Cole a parte 1. A parte 2 vai <span className="font-medium text-foreground">por cima</span>, cobrindo a faixa de {formatarCm(sobre ?? 2)} da parte 1 (onde está a linha pontilhada).</li>
            <li>Siga assim até a última parte. A arte da faixa coberta é a mesma da parte de cima, então a emenda fecha sem falha.</li>
            {plano.corte === "linhas" && <li>Neste rolo as partes são faixas da arte (a arte sai girada 90° em cada página): cole da parte 1 (topo da arte) para baixo.</li>}
          </ol>
        </Painel>
      )}
    </>
  );

  const rodape = (
    <div className="flex flex-wrap items-center gap-2">
      <Button className="rounded-full" onClick={() => pdf && baixarBlob(new Blob([pdf.bytes], { type: "application/pdf" }), `${nomeBase}_emenda.pdf`)} disabled={!pdf || gerando || !!acao}>
        {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Baixar PDF das partes ({pdf?.paginas ?? 0})
      </Button>
      {plano && plano.partes > 1 && (
        <Button variant="secondary" className="rounded-full" onClick={() => void baixarPartes()} disabled={!!acao || gerando}>
          {acao?.startsWith("zip") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileArchive className="mr-2 h-4 w-4" />}
          {acao?.startsWith("zip") ? `Gerando ${acao.slice(4)}` : "Uma parte por arquivo (.zip)"}
        </Button>
      )}
    </div>
  );

  return <DuasColunas esquerda={esquerda} direita={direita} rodape={rodape} />;
}
