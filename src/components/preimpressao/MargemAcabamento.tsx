// Pré-impressão → ferramenta "Margem de acabamento".
// Aumenta a página FORA da arte de banners/faixas de lona: área a mais em branco
// e uma linha K50 de 0,5 mm na borda de fora para marcar o corte.
// Tudo no navegador: os arquivos nunca saem do computador.

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Download, FileArchive, Loader2, Lock, Minus, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotaoRedondo, Campo, Chave, Mini, Segmentado } from "./ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LIMITE_ACROBAT_CM,
  detectarTipo,
  dpiEfetivo,
  formatarAntesDepois,
  imagemParaPdf,
  lerInfoImagem,
  margensPara,
  nomeResultado,
  planejarImagem,
  posicoesIlhos,
  processarPdf,
  type Ilhos,
  type InfoImagem,
  type Peca,
  type TipoArquivo,
} from "@/lib/preimpressao/margem";
import { baixarBlob, baixarZip, imagemMesmoFormato, miniaturaImagem, miniaturaPdf } from "@/lib/preimpressao/navegador";

// ─── Configuração (guardada no navegador) ────────────────────────────

type Saida = "mesmo" | "pdf";

interface Config {
  peca: Peca;
  cm: string;
  saida: Saida;
  /** Marcar a posição dos ilhós sobre a arte. */
  ilhos: boolean;
  ilhosEspaco: string;
  ilhosRecuo: string;
}

const CONFIG_KEY = "preimpressao.margem-acabamento.config.v1";
const CONFIG_PADRAO: Config = { peca: "banner", cm: "10", saida: "mesmo", ilhos: false, ilhosEspaco: "30", ilhosRecuo: "2,5" };

function lerConfig(): Config {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return CONFIG_PADRAO;
    const c = JSON.parse(raw) as Partial<Config>;
    return {
      peca: PECAS_UI.some((p) => p.key === c.peca) ? (c.peca as Peca) : CONFIG_PADRAO.peca,
      cm: typeof c.cm === "string" && c.cm.trim() ? c.cm : CONFIG_PADRAO.cm,
      saida: c.saida === "pdf" ? "pdf" : "mesmo",
      ilhos: c.ilhos === true,
      ilhosEspaco: typeof c.ilhosEspaco === "string" && c.ilhosEspaco.trim() ? c.ilhosEspaco : CONFIG_PADRAO.ilhosEspaco,
      ilhosRecuo: typeof c.ilhosRecuo === "string" && c.ilhosRecuo.trim() ? c.ilhosRecuo : CONFIG_PADRAO.ilhosRecuo,
    };
  } catch {
    return CONFIG_PADRAO;
  }
}

function numero(s: string): number {
  return Number.parseFloat(s.replace(",", ".").trim());
}

const MAX_CM = 500;
function faixa(s: string, min: number, max: number): number | null {
  const v = numero(s);
  return Number.isFinite(v) && v >= min && v <= max ? v : null;
}

function cmValido(s: string): number | null {
  const v = numero(s);
  return Number.isFinite(v) && v > 0 && v <= MAX_CM ? v : null;
}

// ─── Itens da lista ──────────────────────────────────────────────────

type Status = "processando" | "pronto" | "falta_medida" | "erro";

interface Item {
  id: string;
  nome: string;
  file: File;
  tipo: TipoArquivo;
  bytes?: Uint8Array;
  info?: InfoImagem;
  /** Largura real digitada pelo usuário (texto do campo). */
  larguraCm: string;
  status: Status;
  erro?: string;
  avisos: string[];
  medidas?: string;
  paginas?: number;
  resultado?: { blob: Blob; nome: string };
  thumb?: string;
}

const MSG_CDR =
  "Arquivo do Corel (.cdr) não pode ser lido aqui. No CorelDRAW use Arquivo → Exportar… → PDF e envie o PDF.";

let seq = 0;
const novoId = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`;

async function prepararItem(file: File): Promise<Item> {
  const base: Item = { id: novoId(), nome: file.name, file, tipo: "desconhecido", larguraCm: "", status: "processando", avisos: [] };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const tipo = detectarTipo(bytes, file.name);
    if (tipo === "cdr") return { ...base, tipo, status: "erro", erro: MSG_CDR };
    if (tipo === "desconhecido")
      return { ...base, tipo, status: "erro", erro: "Formato não suportado. Envie PDF, PNG ou JPG." };
    if (tipo === "pdf") return { ...base, tipo, bytes };
    const info = lerInfoImagem(bytes, tipo);
    return { ...base, tipo, bytes, info };
  } catch (e) {
    return { ...base, status: "erro", erro: e instanceof Error ? e.message : "Não consegui ler o arquivo." };
  }
}

/** Processa um item com a configuração atual. Retorna só os campos que mudam. */
async function processarItem(item: Item, cfg: { peca: Peca; cm: number; saida: Saida; ilhos: Ilhos | null }): Promise<Partial<Item>> {
  const m = margensPara(cfg.peca, cfg.cm);
  const avisos: string[] = [];
  const limite = `Passa de ${LIMITE_ACROBAT_CM} cm de lado: o Acrobat não abre páginas maiores (o RIP pode abrir).`;

  if (item.tipo === "pdf" && item.bytes) {
    const r = await processarPdf(item.bytes, m, cfg.ilhos);
    if (r.passaLimite) avisos.push(limite);
    const blob = new Blob([r.bytes], { type: "application/pdf" });
    const thumb = await miniaturaPdf(r.bytes).catch(() => undefined);
    return {
      status: "pronto",
      erro: undefined,
      avisos,
      medidas: formatarAntesDepois(r.paginas[0].antes, r.paginas[0].depois),
      paginas: r.paginas.length,
      resultado: { blob, nome: nomeResultado(item.nome, "pdf") },
      thumb,
    };
  }

  const info = item.info;
  if (!info || !item.bytes) throw new Error("Arquivo não carregado.");
  const largura = item.larguraCm.trim() ? numero(item.larguraCm) : null;
  if (largura !== null && !(largura > 0)) {
    return { status: "falta_medida", erro: "Digite a largura real do banner em cm.", resultado: undefined, medidas: undefined, thumb: undefined, avisos };
  }
  const dpi = dpiEfetivo(info, largura);
  if (!dpi) {
    return {
      status: "falta_medida",
      erro: "O arquivo não informa o tamanho (sem DPI). Digite a largura real do banner em cm.",
      resultado: undefined,
      medidas: undefined,
      thumb: undefined,
      avisos,
    };
  }
  const plano = planejarImagem(info, m, dpi);
  const medidas = formatarAntesDepois(plano.antes, plano.depois);
  if (plano.depois.w > LIMITE_ACROBAT_CM || plano.depois.h > LIMITE_ACROBAT_CM) avisos.push(limite);

  const emPdf = cfg.saida === "pdf" || info.cmyk;
  if (info.cmyk && cfg.saida !== "pdf") avisos.push("JPG em CMYK: salvo como PDF para manter as cores.");

  if (emPdf) {
    const r = await imagemParaPdf(item.bytes, info, m, dpi, cfg.ilhos);
    const blob = new Blob([r.bytes], { type: "application/pdf" });
    const thumb = await miniaturaPdf(r.bytes).catch(() => undefined);
    return { status: "pronto", erro: undefined, avisos, medidas, paginas: 1, resultado: { blob, nome: nomeResultado(item.nome, "pdf") }, thumb };
  }

  const blob = await imagemMesmoFormato(item.file, info, plano, cfg.ilhos);
  const thumb = await miniaturaImagem(blob, plano.larguraFinalPx, plano.alturaFinalPx).catch(() => undefined);
  return { status: "pronto", erro: undefined, avisos, medidas, paginas: 1, resultado: { blob, nome: nomeResultado(item.nome) }, thumb };
}

// ─── Componente ──────────────────────────────────────────────────────

export default function MargemAcabamento() {
  const [config, setConfig] = useState<Config>(lerConfig);
  const [items, setItems] = useState<Item[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [zipando, setZipando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Itens atuais (para os processamentos assíncronos lerem o estado mais novo)
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  // Versão por item: resultado de um processamento antigo é descartado
  const versoes = useRef(new Map<string, number>());
  // Fila: um arquivo de cada vez, para não estourar a memória com lonas enormes
  const fila = useRef<Promise<void>>(Promise.resolve());

  const cmNum = cmValido(config.cm);
  // Medida "assentada" (espera o usuário parar de digitar)
  const [cmAplicado, setCmAplicado] = useState<number | null>(cmNum);
  useEffect(() => {
    const t = setTimeout(() => setCmAplicado(cmNum), 400);
    return () => clearTimeout(t);
  }, [cmNum]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      /* navegador sem localStorage */
    }
  }, [config]);

  const atualizar = useCallback((id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  // Ilhós: medidas válidas (espaçamento 5–200 cm, recuo 0,5–20 cm); inválidas = não processa
  const ilhosEspaco = faixa(config.ilhosEspaco, 5, 200);
  const ilhosRecuo = faixa(config.ilhosRecuo, 0.5, 20);
  const ilhosInvalido = config.ilhos && (ilhosEspaco === null || ilhosRecuo === null);
  const ilhosChave = config.ilhos && !ilhosInvalido ? `${ilhosEspaco}|${ilhosRecuo}` : "";
  const [ilhosAplicado, setIlhosAplicado] = useState(ilhosChave);
  useEffect(() => {
    const t = setTimeout(() => setIlhosAplicado(ilhosChave), 400);
    return () => clearTimeout(t);
  }, [ilhosChave]);
  const ilhosCfg: Ilhos | null = ilhosAplicado
    ? { espacamentoCm: Number(ilhosAplicado.split("|")[0]), recuoCm: Number(ilhosAplicado.split("|")[1]) }
    : null;

  const cfgRef = useRef({ peca: config.peca, cm: cmAplicado, saida: config.saida, ilhos: ilhosCfg });
  cfgRef.current = { peca: config.peca, cm: cmAplicado, saida: config.saida, ilhos: ilhosCfg };

  const agendar = useCallback(
    (id: string) => {
      const versao = (versoes.current.get(id) ?? 0) + 1;
      versoes.current.set(id, versao);
      const atual = itemsRef.current.find((i) => i.id === id);
      if (!atual || !atual.bytes) return;
      if (cfgRef.current.cm === null) return;
      atualizar(id, { status: "processando" });
      fila.current = fila.current.then(async () => {
        if (versoes.current.get(id) !== versao) return; // já tem pedido mais novo
        const item = itemsRef.current.find((i) => i.id === id);
        const cfg = cfgRef.current;
        if (!item || cfg.cm === null) return;
        let patch: Partial<Item>;
        try {
          patch = await processarItem(item, { peca: cfg.peca, cm: cfg.cm, saida: cfg.saida, ilhos: cfg.ilhos });
        } catch (e) {
          patch = {
            status: "erro",
            erro: e instanceof Error ? e.message : "Erro ao processar o arquivo.",
            resultado: undefined,
            thumb: undefined,
          };
        }
        if (versoes.current.get(id) === versao) atualizar(id, patch);
      });
    },
    [atualizar],
  );

  // Mudou a configuração → reprocessa tudo que já está carregado
  useEffect(() => {
    for (const it of itemsRef.current) agendar(it.id);
  }, [config.peca, config.saida, cmAplicado, ilhosAplicado, agendar]);

  const adicionar = useCallback(
    async (files: FileList | File[]) => {
      const lista = Array.from(files);
      if (!lista.length) return;
      const novos = await Promise.all(lista.map(prepararItem));
      itemsRef.current = [...itemsRef.current, ...novos];
      setItems((prev) => [...prev, ...novos]);
      for (const n of novos) if (n.status !== "erro") agendar(n.id);
    },
    [agendar],
  );

  const remover = (id: string) => {
    versoes.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const mudarLargura = (id: string, valor: string) => {
    itemsRef.current = itemsRef.current.map((i) => (i.id === id ? { ...i, larguraCm: valor } : i));
    atualizar(id, { larguraCm: valor });
  };

  // Largura digitada → reprocessa aquele arquivo depois de uma pausa
  const timersLargura = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const aoDigitarLargura = (id: string, valor: string) => {
    mudarLargura(id, valor);
    const t = timersLargura.current.get(id);
    if (t) clearTimeout(t);
    timersLargura.current.set(
      id,
      setTimeout(() => agendar(id), 500),
    );
  };

  const prontos = items.filter((i) => i.status === "pronto" && i.resultado);

  const baixarTodos = async () => {
    setZipando(true);
    try {
      await baixarZip(
        prontos.map((i) => ({ nome: i.resultado!.nome, blob: i.resultado!.blob })),
        "margem_acabamento.zip",
      );
    } finally {
      setZipando(false);
    }
  };


  const carregando = items.some((i) => i.status === "processando");
  const mudarCm = (delta: number) =>
    setConfig((c) => {
      const atual = cmValido(c.cm) ?? 0;
      const novo = Math.min(MAX_CM, Math.max(0.5, Math.round((atual + delta) * 10) / 10));
      return { ...c, cm: String(novo).replace(".", ",") };
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr] items-start">
      {/* ── Ajustes ───────────────────────────────────────────── */}
      <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm space-y-6 lg:sticky lg:top-4">
        <PreviaMargem peca={config.peca} cm={cmNum} ilhos={config.ilhos} />

        <Campo titulo="Peça" ajuda={PECAS_UI.find((p) => p.key === config.peca)?.ajuda}>
          <Segmentado
            valor={config.peca}
            opcoes={PECAS_UI.map((p) => ({ valor: p.key, rotulo: p.titulo }))}
            onChange={(v) => setConfig((c) => ({ ...c, peca: v }))}
          />
        </Campo>

        <Campo titulo="Medida da área a mais">
          <div className="flex items-center gap-2">
            <BotaoRedondo rotulo="Diminuir 1 cm" onClick={() => mudarCm(-1)}>
              <Minus className="h-4 w-4" />
            </BotaoRedondo>
            <div
              className={cn(
                "flex h-11 flex-1 items-center justify-center rounded-full bg-muted/60 px-4 ring-1 ring-transparent focus-within:ring-primary/40",
                cmNum === null && "ring-destructive/60",
              )}
            >
              <input
                id="margem-cm"
                aria-label="Medida em centímetros"
                inputMode="decimal"
                className="w-16 bg-transparent text-center text-lg font-semibold tabular-nums outline-none"
                value={config.cm}
                onChange={(e) => setConfig((c) => ({ ...c, cm: e.target.value }))}
              />
              <span className="text-sm text-muted-foreground">cm</span>
            </div>
            <BotaoRedondo rotulo="Aumentar 1 cm" onClick={() => mudarCm(1)}>
              <Plus className="h-4 w-4" />
            </BotaoRedondo>
          </div>
          {cmNum === null && <p className="mt-2 text-xs text-destructive">Digite uma medida entre 0 e {MAX_CM} cm.</p>}
        </Campo>

        <Campo titulo="Salvar como">
          <Segmentado
            valor={config.saida}
            opcoes={[
              { valor: "mesmo" as Saida, rotulo: "Mesmo formato" },
              { valor: "pdf" as Saida, rotulo: "Sempre PDF" },
            ]}
            onChange={(v) => setConfig((c) => ({ ...c, saida: v }))}
          />
        </Campo>

        <div className="space-y-3">
          <Chave ligado={config.ilhos} onChange={(v) => setConfig((c) => ({ ...c, ilhos: v }))}>
            <span className="font-medium">Marcar ilhós</span>
            <span className="block text-xs text-muted-foreground">Pontinhos sobre a arte, em toda a volta, onde furar.</span>
          </Chave>
          {config.ilhos && (
            <div className="grid grid-cols-2 gap-3">
              <Mini
                rotulo="Um a cada (cm)"
                valor={config.ilhosEspaco}
                onChange={(v) => setConfig((c) => ({ ...c, ilhosEspaco: v }))}
                erro={ilhosEspaco === null ? "5 a 200 cm" : undefined}
                ajuda="No máximo; divide por igual"
              />
              <Mini
                rotulo="Distância da borda (cm)"
                valor={config.ilhosRecuo}
                onChange={(v) => setConfig((c) => ({ ...c, ilhosRecuo: v }))}
                erro={ilhosRecuo === null ? "0,5 a 20 cm" : undefined}
                ajuda="Da borda da arte ao centro"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3">
          <span className="relative h-8 w-8 shrink-0 rounded-lg bg-background ring-1 ring-border" aria-hidden>
            <span className="absolute inset-x-1 top-1 h-[2px] rounded-full bg-[#808080]" />
            <span className="absolute inset-x-1 bottom-1 h-[2px] rounded-full bg-[#808080]" />
          </span>
          <div className="text-xs leading-relaxed">
            <p className="font-medium text-foreground">Linha de corte K50 · 0,5 mm</p>
            <p className="text-muted-foreground">Na borda de fora. A área a mais fica em branco.</p>
          </div>
        </div>
      </section>

      {/* ── Arquivos ──────────────────────────────────────────── */}
      <section className="space-y-4 min-w-0">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            void adicionar(e.dataTransfer.files);
          }}
          className={cn(
            "rounded-3xl border-2 border-dashed text-center transition-all duration-200",
            items.length ? "px-6 py-6" : "px-6 py-16",
            arrastando ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/70 bg-muted/30 hover:bg-muted/50",
          )}
        >
          <div
            className={cn(
              "mx-auto flex items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border/60",
              items.length ? "h-10 w-10" : "h-14 w-14",
            )}
          >
            <Upload className={cn("text-primary", items.length ? "h-4 w-4" : "h-6 w-6")} />
          </div>
          <p className={cn("mt-4 font-semibold tracking-tight", items.length ? "text-base" : "text-xl")}>
            {items.length ? "Solte mais arquivos aqui" : "Solte os arquivos do banner ou da faixa"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">PDF, PNG ou JPG no tamanho final (1:1). Vários de uma vez.</p>
          <Button type="button" className="mt-5 rounded-full px-6" onClick={() => inputRef.current?.click()}>
            Escolher arquivos
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.cdr,application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void adicionar(e.target.files);
              e.target.value = "";
            }}
          />
          {!items.length && (
            <div className="mx-auto mt-8 max-w-md space-y-1 text-xs text-muted-foreground">
              <p>Arquivo do Corel (.cdr)? Exporte como PDF antes (Arquivo → Exportar… → PDF).</p>
              <p className="flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" /> Tudo é feito aqui no seu computador. Nada é enviado para a internet.
              </p>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap px-1">
              <p className="text-sm text-muted-foreground">
                {carregando && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                <span className="font-medium text-foreground">{prontos.length}</span> de {items.length}{" "}
                {items.length === 1 ? "arquivo pronto" : "arquivos prontos"}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setItems([])}>
                  Limpar
                </Button>
                {prontos.length > 1 && (
                  <Button size="sm" className="rounded-full" onClick={baixarTodos} disabled={zipando}>
                    {zipando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                    Baixar todos (.zip)
                  </Button>
                )}
              </div>
            </div>
            <ul className="space-y-3">
              {items.map((it) => (
                <LinhaArquivo
                  key={it.id}
                  item={it}
                  onLargura={(v) => aoDigitarLargura(it.id, v)}
                  onRemover={() => remover(it.id)}
                />
              ))}
            </ul>
            <p className="flex items-center justify-center gap-1 pt-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Tudo é feito aqui no seu computador. Nada é enviado para a internet.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Peças de interface ─────────────────────────────────────────────

const PECAS_UI: { key: Peca; titulo: string; ajuda: string }[] = [
  { key: "banner", titulo: "Banner", ajuda: "Área a mais em cima e embaixo." },
  { key: "faixa", titulo: "Faixa", ajuda: "Área a mais nas laterais." },
  { key: "todos", titulo: "Todos os lados", ajuda: "Área a mais em volta toda." },
];

/** Desenho ao vivo: onde entra a área a mais e a linha de corte (fora de escala). */
function PreviaMargem({ peca, cm, ilhos }: { peca: Peca; cm: number | null; ilhos?: boolean }) {
  const arte = peca === "faixa" ? { w: 150, h: 54 } : peca === "banner" ? { w: 92, h: 112 } : { w: 92, h: 88 };
  const m = 16;
  const mt = peca === "faixa" ? 0 : m;
  const ml = peca === "banner" ? 0 : m;
  const W = arte.w + 2 * ml;
  const H = arte.h + 2 * mt;
  const x0 = (200 - W) / 2;
  const y0 = (160 - H) / 2;
  const t = { transition: "all 300ms cubic-bezier(.2,.8,.2,1)" } as const;
  const linha = "#808080";
  const rotulo = cm === null ? "?" : `${String(cm).replace(".", ",")} cm`;
  return (
    <div className="rounded-2xl bg-gradient-to-b from-muted/60 to-muted/20 p-3">
      <svg viewBox="0 0 200 160" className="mx-auto w-full max-w-[320px] h-auto" role="img" aria-label="Prévia da área a mais e da linha de corte">
        {/* página final */}
        <rect x={x0} y={y0} width={W} height={H} rx="2" fill="#fff" style={{ ...t, filter: "drop-shadow(0 1px 2px rgb(0 0 0 / .12))" }} />
        {/* arte */}
        <rect x={x0 + ml} y={y0 + mt} width={arte.w} height={arte.h} rx="1" className="fill-primary/20 stroke-primary/40" strokeWidth="0.75" style={t} />
        <text x={100} y={y0 + mt + arte.h / 2 + 4} textAnchor="middle" className="fill-primary text-[11px] font-semibold" style={t}>
          Arte
        </text>
        {/* marcas de ilhós sobre a arte */}
        {ilhos &&
          posicoesIlhos(arte.w, arte.h, 26, 7).map((p, i) => (
            <circle key={i} cx={x0 + ml + p.x} cy={y0 + mt + p.y} r="2.2" fill="#fff" stroke="#111" strokeWidth="0.7" style={t} />
          ))}
        {/* linhas de corte na borda de fora */}
        {mt > 0 && (
          <>
            <rect x={x0} y={y0} width={W} height={1.6} fill={linha} style={t} />
            <rect x={x0} y={y0 + H - 1.6} width={W} height={1.6} fill={linha} style={t} />
          </>
        )}
        {ml > 0 && (
          <>
            <rect x={x0} y={y0} width={1.6} height={H} fill={linha} style={t} />
            <rect x={x0 + W - 1.6} y={y0} width={1.6} height={H} fill={linha} style={t} />
          </>
        )}
        {/* cota da medida */}
        {mt > 0 ? (
          <g style={t}>
            <line x1={x0 + W + 7} y1={y0} x2={x0 + W + 7} y2={y0 + mt} stroke="currentColor" className="text-muted-foreground" strokeWidth="0.75" />
            <text x={x0 + W + 11} y={y0 + mt / 2 + 3} className="fill-muted-foreground text-[8px] font-medium">{rotulo}</text>
          </g>
        ) : (
          <g style={t}>
            <line x1={x0} y1={y0 + H + 7} x2={x0 + ml} y2={y0 + H + 7} stroke="currentColor" className="text-muted-foreground" strokeWidth="0.75" />
            <text x={x0} y={y0 + H + 17} className="fill-muted-foreground text-[8px] font-medium">{rotulo}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

function StatusPonto({ status }: { status: Status }) {
  const mapa: Record<Status, { cor: string; texto: string }> = {
    processando: { cor: "bg-muted-foreground animate-pulse", texto: "Processando" },
    pronto: { cor: "bg-emerald-500", texto: "Pronto" },
    falta_medida: { cor: "bg-amber-500", texto: "Falta a medida" },
    erro: { cor: "bg-destructive", texto: "Erro" },
  };
  const s = mapa[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", s.cor)} />
      {s.texto}
    </span>
  );
}

function LinhaArquivo({ item, onLargura, onRemover }: { item: Item; onLargura: (v: string) => void; onRemover: () => void }) {
  const imagem = item.tipo === "png" || item.tipo === "jpg";
  const info = item.info;
  const larguraArquivo = info?.dpi ? (info.larguraPx / info.dpi) * 2.54 : null;
  const [antes, depois] = item.medidas ? item.medidas.split(" → ") : [];
  return (
    <li className="group flex flex-wrap sm:flex-nowrap items-start gap-3 sm:gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div
        className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 ring-border/60"
        style={{ background: "repeating-conic-gradient(hsl(var(--muted)) 0 25%, transparent 0 50%) 0 0 / 12px 12px" }}
      >
        {item.thumb ? (
          <img src={item.thumb} alt="" className="max-h-full max-w-full object-contain drop-shadow-sm" />
        ) : item.status === "processando" ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">{item.tipo === "desconhecido" ? "?" : item.tipo}</span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="truncate text-sm font-semibold tracking-tight max-w-full" title={item.nome}>{item.nome}</span>
          <StatusPonto status={item.status} />
        </div>
        {antes && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm tabular-nums">
            <span className="text-muted-foreground">{antes}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{depois}</span>
            {item.paginas && item.paginas > 1 && <span className="text-muted-foreground">· {item.paginas} páginas</span>}
          </p>
        )}
        {info && (
          <p className="text-xs text-muted-foreground">
            {info.larguraPx} × {info.alturaPx} px · {info.dpi ? `${Math.round(info.dpi)} dpi` : "sem DPI no arquivo"}
            {info.cmyk && " · CMYK"}
          </p>
        )}
        {item.erro && (
          <p className={cn("text-xs", item.status === "erro" ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>{item.erro}</p>
        )}
        {item.avisos.map((a) => (
          <p key={a} className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {a}
          </p>
        ))}
        {imagem && info && (
          <label className="flex w-fit items-center gap-2 pt-1 text-xs text-muted-foreground">
            {info.dpi ? "Corrigir largura real" : "Largura real do banner"}
            <span
              className={cn(
                "flex h-8 items-center rounded-full bg-muted/60 pr-3 ring-1 ring-transparent focus-within:ring-primary/40",
                item.status === "falta_medida" && "ring-amber-500",
              )}
            >
              <Input
                inputMode="decimal"
                className="h-8 w-20 border-0 bg-transparent text-center text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder={larguraArquivo ? larguraArquivo.toFixed(1).replace(".", ",") : "ex.: 90"}
                value={item.larguraCm}
                onChange={(e) => onLargura(e.target.value)}
              />
              cm
            </span>
          </label>
        )}
      </div>

      <div className="flex w-full sm:w-auto shrink-0 items-center justify-end gap-1">
        {item.status !== "erro" && (
        <Button
          size="sm"
          className="rounded-full"
          disabled={item.status !== "pronto" || !item.resultado}
          onClick={() => item.resultado && baixarBlob(item.resultado.blob, item.resultado.nome)}
        >
          <Download className="h-4 w-4" /> Baixar
        </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-full text-muted-foreground opacity-70 hover:opacity-100"
          onClick={onRemover}
          aria-label={`Remover ${item.nome}`}
        >
          {item.status === "erro" ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </li>
  );
}
