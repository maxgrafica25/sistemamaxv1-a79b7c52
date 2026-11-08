// Pré-impressão → ferramenta "Numeração de talões e blocos".
// Arte em PDF (1 talão por página ou já montada) → PDF de impressão numerado em
// corte e empilha, um arquivo por via. Tudo no navegador.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileArchive, FileText, Loader2, Lock, Plus, RotateCw, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PT_POR_CM, detectarTipo } from "@/lib/preimpressao/margem";
import {
  FOLHAS_PADRAO,
  arteEmPe,
  calcularEncaixe,
  formatarNumero,
  gerarNumeracao,
  numeroNaPosicao,
  planejarNumeracao,
  tamanhoArte,
  type Celula,
  type ConfigNumeracao,
  type CorNumero,
  type Encaixe,
  type PosicaoNumero,
} from "@/lib/preimpressao/numeracao";
import { baixarBlob, baixarZip, renderizarPaginaPdf } from "@/lib/preimpressao/navegador";
import { Campo, Chave, Painel, Passo, Segmentado } from "./ui";

// ─── Configuração (guardada no navegador) ────────────────────────────

type Modo = "solto" | "montado";

interface Config {
  modo: Modo;
  folha: string; // a4 | a3 | sra3 | 33x48 | outra
  folhaW: string;
  folhaH: string;
  colunas: string;
  linhas: string;
  margem: string;
  espaco: string;
  marcasCorte: boolean;
  inicio: string;
  taloes: string;
  jogos: string;
  vias: number;
  digitos: string;
  prefixo: string;
  tamanho: string;
  cor: CorNumero;
  posicoes: PosicaoNumero[];
  ordemInvertida: boolean;
}

const CONFIG_KEY = "preimpressao.numeracao.config.v1";
const PADRAO: Config = {
  modo: "solto",
  folha: "a4",
  folhaW: "21",
  folhaH: "29,7",
  colunas: "2",
  linhas: "2",
  margem: "5",
  espaco: "0",
  marcasCorte: true,
  inicio: "1",
  taloes: "10",
  jogos: "50",
  vias: 2,
  digitos: "4",
  prefixo: "Nº ",
  tamanho: "12",
  cor: "vermelho",
  posicoes: [{ x: 0.85, y: 0.08, girar: false }],
  ordemInvertida: false,
};

function lerConfig(): Config {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return PADRAO;
    const c = { ...PADRAO, ...(JSON.parse(raw) as Partial<Config>) };
    if (!Array.isArray(c.posicoes) || !c.posicoes.length) c.posicoes = PADRAO.posicoes;
    return c;
  } catch {
    return PADRAO;
  }
}

const num = (s: string) => Number.parseFloat(String(s).replace(",", ".").trim());
const entre = (s: string, min: number, max: number, inteiro = false): number | null => {
  const v = num(s);
  if (!Number.isFinite(v) || v < min || v > max) return null;
  if (inteiro && !Number.isInteger(v)) return null;
  return v;
};

interface Validado {
  cfg: ConfigNumeracao | null;
  erros: Record<string, string>;
}

function validar(c: Config): Validado {
  const erros: Record<string, string> = {};
  const chk = (campo: string, v: number | null, msg: string) => {
    if (v === null) erros[campo] = msg;
    return v ?? 0;
  };
  let folhaW = 0;
  let folhaH = 0;
  const padrao = FOLHAS_PADRAO.find((f) => f.key === c.folha);
  if (padrao) {
    folhaW = padrao.wCm * PT_POR_CM;
    folhaH = padrao.hCm * PT_POR_CM;
  } else {
    folhaW = chk("folhaW", entre(c.folhaW, 5, 200), "5 a 200 cm") * PT_POR_CM;
    folhaH = chk("folhaH", entre(c.folhaH, 5, 200), "5 a 200 cm") * PT_POR_CM;
  }
  const cfg: ConfigNumeracao = {
    modo: c.modo,
    folhaW,
    folhaH,
    colunas: chk("colunas", entre(c.colunas, 1, 20, true), "1 a 20"),
    linhas: chk("linhas", entre(c.linhas, 1, 20, true), "1 a 20"),
    margemMm: chk("margem", entre(c.margem, 0, 50), "0 a 50 mm"),
    espacoMm: chk("espaco", entre(c.espaco, 0, 50), "0 a 50 mm"),
    marcasCorte: c.marcasCorte,
    inicio: chk("inicio", entre(c.inicio, 0, 99_999_999, true), "Número inteiro"),
    taloes: chk("taloes", entre(c.taloes, 1, 100_000, true), "Pelo menos 1"),
    jogos: chk("jogos", entre(c.jogos, 1, 10_000, true), "Pelo menos 1"),
    vias: c.vias,
    digitos: chk("digitos", entre(c.digitos, 1, 10, true), "1 a 10"),
    prefixo: c.prefixo,
    tamanhoPt: chk("tamanho", entre(c.tamanho, 4, 72), "4 a 72 pt"),
    cor: c.cor,
    posicoes: c.posicoes,
    ordemInvertida: c.ordemInvertida,
  };
  return { cfg: Object.keys(erros).length ? null : cfg, erros };
}

// ─── Arte carregada ──────────────────────────────────────────────────

interface Arte {
  nome: string;
  emPe: Uint8Array;
  w: number;
  h: number;
  paginas: number;
  imagem: string;
}

interface Resultado {
  arquivos: { nome: string; blob: Blob }[];
  folhas: number;
  porFolha: number;
  faixa: string;
  vazias: number;
  amostra?: string;
}

const MAX_POSICOES = 3;

const fmtCm = (pt: number) => (pt / PT_POR_CM).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default function NumeracaoTaloes() {
  const [config, setConfig] = useState<Config>(lerConfig);
  const [arte, setArte] = useState<Arte | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroArte, setErroArte] = useState<string | null>(null);
  const [ativa, setAtiva] = useState(0);
  const [gerando, setGerando] = useState(false);
  const [erroGerar, setErroGerar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      /* sem localStorage */
    }
  }, [config]);

  // Qualquer mudança invalida o PDF já gerado
  useEffect(() => {
    setResultado(null);
    setErroGerar(null);
  }, [config, arte]);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));

  const { cfg, erros } = useMemo(() => validar(config), [config]);

  const encaixe: Encaixe | null = useMemo(() => {
    if (!arte || !cfg) return null;
    const e = calcularEncaixe(cfg, arte);
    return e.celulas.length && e.celulas[0].w > 0 && e.celulas[0].h > 0 ? e : null;
  }, [arte, cfg]);

  const plano = useMemo(
    () => (encaixe && cfg ? planejarNumeracao(encaixe.celulas.length, cfg.taloes, cfg.jogos, cfg.inicio) : null),
    [encaixe, cfg],
  );

  const carregar = useCallback(async (files: FileList | File[]) => {
    const f = Array.from(files)[0];
    if (!f) return;
    setCarregando(true);
    setErroArte(null);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const tipo = detectarTipo(bytes, f.name);
      if (tipo === "cdr") throw new Error("Arquivo do Corel (.cdr): no CorelDRAW use Arquivo → Exportar… → PDF e envie o PDF.");
      if (tipo !== "pdf") throw new Error("Envie a arte do talão em PDF.");
      const emPe = await arteEmPe(bytes);
      const t = await tamanhoArte(emPe);
      const imagem = await renderizarPaginaPdf(emPe, 0, 1400);
      setArte({ nome: f.name, emPe, w: t.w, h: t.h, paginas: t.paginas, imagem });
    } catch (e) {
      setArte(null);
      setErroArte(e instanceof Error ? e.message : "Não consegui abrir o arquivo.");
    } finally {
      setCarregando(false);
    }
  }, []);

  const moverPosicao = (i: number, pos: Partial<PosicaoNumero>) =>
    setConfig((c) => ({ ...c, posicoes: c.posicoes.map((p, k) => (k === i ? { ...p, ...pos } : p)) }));

  const adicionarPosicao = () => {
    setConfig((c) => ({ ...c, posicoes: [...c.posicoes, { x: 0.5, y: 0.5, girar: false }] }));
    setAtiva(config.posicoes.length);
  };

  const removerPosicao = (i: number) => {
    setConfig((c) => ({ ...c, posicoes: c.posicoes.filter((_, k) => k !== i) }));
    setAtiva(0);
  };

  const gerar = async () => {
    if (!arte || !cfg) return;
    setGerando(true);
    setErroGerar(null);
    try {
      // deixa a tela mostrar o "Gerando…" antes do trabalho pesado
      await new Promise((r) => setTimeout(r, 30));
      const r = await gerarNumeracao(arte.emPe, cfg);
      const base = arte.nome.replace(/\.pdf$/i, "");
      const arquivos = r.vias.map((bytes, i) => ({
        nome: r.vias.length > 1 ? `${base}_numerado_via${i + 1}.pdf` : `${base}_numerado.pdf`,
        blob: new Blob([bytes], { type: "application/pdf" }),
      }));
      const amostra = await renderizarPaginaPdf(r.vias[0], 0, 900).catch(() => undefined);
      setResultado({
        arquivos,
        folhas: r.plano.folhas,
        porFolha: r.porFolha,
        faixa: `${formatarNumero(r.plano.primeiro, cfg.digitos, cfg.prefixo)} a ${formatarNumero(r.plano.ultimo, cfg.digitos, cfg.prefixo)}`,
        vazias: r.plano.posicoesVazias,
        amostra,
      });
    } catch (e) {
      setErroGerar(e instanceof Error ? e.message : "Erro ao gerar o PDF.");
    } finally {
      setGerando(false);
    }
  };

  const amostraNumero = cfg ? formatarNumero(cfg.inicio, cfg.digitos, cfg.prefixo) : "Nº 0001";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(320px,400px)_1fr] items-start">
      {/* ── Ajustes ───────────────────────────────────────────── */}
      <div className="space-y-6">
        <Painel className="space-y-6">
          <Campo titulo="Arte do talão">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                void carregar(e.dataTransfer.files);
              }}
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 border-dashed p-4 transition-colors",
                arrastando ? "border-primary bg-primary/5" : "border-border/70 bg-muted/30",
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border/60">
                {carregando ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : arte ? <FileText className="h-4 w-4 text-primary" /> : <Upload className="h-4 w-4 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                {arte ? (
                  <>
                    <p className="truncate text-sm font-semibold" title={arte.nome}>{arte.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtCm(arte.w)} × {fmtCm(arte.h)} cm · {arte.paginas} {arte.paginas === 1 ? "página" : "páginas"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">Solte o PDF aqui</p>
                    <p className="text-xs text-muted-foreground">Se o PDF tiver uma página por via, cada via usa a sua.</p>
                  </>
                )}
              </div>
              <Button size="sm" variant={arte ? "ghost" : "default"} className="rounded-full" onClick={() => inputRef.current?.click()}>
                {arte ? "Trocar" : "Escolher"}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf,.cdr"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void carregar(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {erroArte && <p className="mt-2 text-xs text-destructive">{erroArte}</p>}
          </Campo>

          <Campo
            titulo="Como a arte chegou"
            ajuda={config.modo === "solto" ? "O sistema monta quantos talões couberem na folha." : "A página já tem vários talões; informe a grade."}
          >
            <Segmentado
              valor={config.modo}
              opcoes={[
                { valor: "solto" as Modo, rotulo: "1 talão por página" },
                { valor: "montado" as Modo, rotulo: "Já montada" },
              ]}
              onChange={(v) => set("modo", v)}
            />
          </Campo>

          {config.modo === "solto" ? (
            <Campo titulo="Folha de impressão">
              <div className="flex flex-wrap gap-2">
                {[...FOLHAS_PADRAO.map((f) => ({ key: f.key, rotulo: f.rotulo })), { key: "outra", rotulo: "Outra" }].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => set("folha", f.key)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      config.folha === f.key ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.rotulo}
                  </button>
                ))}
              </div>
              {config.folha === "outra" && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Mini rotulo="Largura (cm)" valor={config.folhaW} onChange={(v) => set("folhaW", v)} erro={erros.folhaW} />
                  <Mini rotulo="Altura (cm)" valor={config.folhaH} onChange={(v) => set("folhaH", v)} erro={erros.folhaH} />
                </div>
              )}
            </Campo>
          ) : (
            <Campo titulo="Grade da arte montada">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Colunas</p>
                  <Passo rotulo="colunas" valor={config.colunas} onChange={(v) => set("colunas", v)} min={1} max={20} invalido={!!erros.colunas} largura="w-8" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Linhas</p>
                  <Passo rotulo="linhas" valor={config.linhas} onChange={(v) => set("linhas", v)} min={1} max={20} invalido={!!erros.linhas} largura="w-8" />
                </div>
              </div>
            </Campo>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Mini rotulo={config.modo === "solto" ? "Margem da folha (mm)" : "Margem da página (mm)"} valor={config.margem} onChange={(v) => set("margem", v)} erro={erros.margem} />
            <Mini rotulo="Espaço entre talões (mm)" valor={config.espaco} onChange={(v) => set("espaco", v)} erro={erros.espaco} />
          </div>

          {config.modo === "solto" && (
            <Chave ligado={config.marcasCorte} onChange={(v) => set("marcasCorte", v)}>
              <span className="font-medium">Marcas de corte</span>
              <span className="block text-xs text-muted-foreground">Tracinhos na margem da folha, onde passar a guilhotina.</span>
            </Chave>
          )}
        </Painel>

        <Painel className="space-y-6">
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            <Mini rotulo="Começa no número" valor={config.inicio} onChange={(v) => set("inicio", v)} erro={erros.inicio} />
            <Mini rotulo="Quantidade de talões" valor={config.taloes} onChange={(v) => set("taloes", v)} erro={erros.taloes} />
            <Mini rotulo="Jogos por talão" valor={config.jogos} onChange={(v) => set("jogos", v)} erro={erros.jogos} ajuda="Números em cada talão" />
            <Mini rotulo="Dígitos" valor={config.digitos} onChange={(v) => set("digitos", v)} erro={erros.digitos} ajuda={`Ex.: ${amostraNumero}`} />
          </div>

          <Campo titulo="Vias de cada número">
            <Segmentado
              valor={String(config.vias)}
              opcoes={["1", "2", "3", "4"].map((v) => ({ valor: v, rotulo: v === "1" ? "1 via" : `${v} vias` }))}
              onChange={(v) => set("vias", Number(v))}
            />
          </Campo>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Mini rotulo="Texto antes" valor={config.prefixo} onChange={(v) => set("prefixo", v)} ajuda='Ex.: "Nº " ou vazio' texto />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Tamanho da letra</p>
              <Passo rotulo="tamanho da letra" valor={config.tamanho} onChange={(v) => set("tamanho", v)} min={4} max={72} sufixo="pt" invalido={!!erros.tamanho} largura="w-8" />
            </div>
          </div>

          <Campo titulo="Cor do número">
            <Segmentado
              valor={config.cor}
              opcoes={[
                { valor: "vermelho" as CorNumero, rotulo: "Vermelho" },
                { valor: "preto" as CorNumero, rotulo: "Preto" },
              ]}
              onChange={(v) => set("cor", v)}
            />
          </Campo>

          <Chave ligado={config.ordemInvertida} onChange={(v) => set("ordemInvertida", v)}>
            <span className="font-medium">Ordem invertida</span>
            <span className="block text-xs text-muted-foreground">Começa pela última folha (para impressoras que empilham ao contrário).</span>
          </Chave>
        </Painel>
      </div>

      {/* ── Prévia e resultado ─────────────────────────────────── */}
      <div className="space-y-6 min-w-0">
        <Painel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Onde vai o número</h3>
              <p className="text-xs text-muted-foreground">
                {arte ? `Clique ou arraste na arte para posicionar o Número ${ativa + 1}.` : "Escolha a arte para ver a prévia."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {config.posicoes.map((p, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-xs font-medium transition-colors",
                    i === ativa ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground",
                  )}
                >
                  <button type="button" onClick={() => setAtiva(i)}>Número {i + 1}</button>
                  <button
                    type="button"
                    title="Girar (em pé / deitado)"
                    aria-label={`Girar número ${i + 1}`}
                    onClick={() => moverPosicao(i, { girar: !p.girar })}
                    className={cn("rounded-full p-1", p.girar && "bg-black/15")}
                  >
                    <RotateCw className="h-3 w-3" />
                  </button>
                  {config.posicoes.length > 1 && (
                    <button type="button" aria-label={`Remover número ${i + 1}`} onClick={() => removerPosicao(i)} className="rounded-full p-1">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {config.posicoes.length < MAX_POSICOES && (
                <button
                  type="button"
                  onClick={adicionarPosicao}
                  className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3" /> Outro lugar
                </button>
              )}
            </div>
          </div>

          {arte ? (
            <PreviaClicavel
              arte={arte}
              celulas={config.modo === "montado" && encaixe ? encaixe.celulas : [{ x: 0, y: 0, w: arte.w, h: arte.h, rot: 0 }]}
              textos={(j) => {
                if (!cfg) return amostraNumero;
                if (config.modo === "solto" || !plano) return amostraNumero;
                const n = numeroNaPosicao(plano, j, 0, cfg.taloes, cfg.jogos, cfg.inicio);
                return n === null ? null : formatarNumero(n, cfg.digitos, cfg.prefixo);
              }}
              posicoes={config.posicoes}
              ativa={ativa}
              tamanhoPt={cfg?.tamanhoPt ?? 12}
              cor={config.cor}
              onMover={(i, pos) => {
                setAtiva(i);
                moverPosicao(i, pos);
              }}
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-muted/30 text-sm text-muted-foreground">
              A prévia aparece aqui
            </div>
          )}
        </Painel>

        <Painel className="space-y-4">
          {arte && cfg && encaixe && plano ? (
            <>
              <div className="flex flex-wrap items-start gap-5">
                {config.modo === "solto" && <EsquemaFolha encaixe={encaixe} plano={plano} cfg={cfg} />}
                <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 text-sm min-w-[220px]">
                  <Dado rotulo="Talões por folha" valor={`${encaixe.celulas.length}${config.modo === "solto" ? ` (${encaixe.colunas} × ${encaixe.linhas})` : ""}`} />
                  <Dado rotulo="Folhas por via" valor={plano.folhas.toLocaleString("pt-BR")} />
                  <Dado rotulo="Numeração" valor={`${formatarNumero(plano.primeiro, cfg.digitos)} a ${formatarNumero(plano.ultimo, cfg.digitos)}`} />
                  <Dado rotulo="Total de folhas" valor={`${(plano.folhas * cfg.vias).toLocaleString("pt-BR")} (${cfg.vias} ${cfg.vias === 1 ? "via" : "vias"})`} />
                  {config.modo === "solto" && (
                    <Dado rotulo="Folha" valor={`${fmtCm(encaixe.folhaW)} × ${fmtCm(encaixe.folhaH)} cm${encaixe.celulas[0].rot ? " · arte deitada" : ""}`} />
                  )}
                  <Dado rotulo="Cada monte" valor={`${plano.taloesPorMonte} ${plano.taloesPorMonte === 1 ? "talão" : "talões"}`} />
                </dl>
              </div>
              {plano.espacosVazios > 0 && (
                <p className="flex items-start gap-1 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    {plano.espacosVazios} {plano.espacosVazios === 1 ? "espaço de talão fica" : "espaços de talão ficam"} em branco no fim
                    (a quantidade não divide certo pelos {encaixe.celulas.length} da folha). Com{" "}
                    <button type="button" className="font-semibold underline" onClick={() => set("taloes", String(cfg.taloes + plano.espacosVazios))}>
                      {cfg.taloes + plano.espacosVazios} talões
                    </button>{" "}
                    são as mesmas {plano.folhas.toLocaleString("pt-BR")} folhas.
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {!arte
                ? "Escolha a arte para ver quantas folhas vão ser impressas."
                : !cfg
                  ? "Confira os campos marcados em vermelho."
                  : config.modo === "solto"
                    ? "A arte não cabe na folha escolhida. Escolha uma folha maior ou diminua a margem."
                    : "Colunas, linhas ou margem não batem com a página."}
            </p>
          )}

          {erroGerar && <p className="text-sm text-destructive">{erroGerar}</p>}

          {!resultado ? (
            <Button size="lg" className="w-full rounded-full" disabled={!arte || !cfg || !encaixe || gerando} onClick={gerar}>
              {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {gerando ? "Gerando PDF…" : "Gerar PDF numerado"}
            </Button>
          ) : (
            <div className="space-y-3">
              {resultado.amostra && (
                <div className="rounded-2xl bg-muted/30 p-3">
                  <p className="mb-2 text-xs text-muted-foreground">Primeira folha da via 1</p>
                  <img src={resultado.amostra} alt="Primeira folha numerada" className="mx-auto max-h-[420px] rounded-md bg-white shadow-sm" />
                </div>
              )}
              <p className="text-sm">
                <span className="font-semibold">Pronto:</span> {resultado.faixa} · {resultado.folhas.toLocaleString("pt-BR")} folhas por via.
              </p>
              <div className="flex flex-wrap gap-2">
                {resultado.arquivos.map((a, i) => (
                  <Button key={a.nome} variant={resultado.arquivos.length > 1 ? "outline" : "default"} className="rounded-full" onClick={() => baixarBlob(a.blob, a.nome)}>
                    <Download className="h-4 w-4" /> {resultado.arquivos.length > 1 ? `Via ${i + 1}` : "Baixar PDF"}
                  </Button>
                ))}
                {resultado.arquivos.length > 1 && (
                  <Button className="rounded-full" onClick={() => void baixarZip(resultado.arquivos, `${resultado.arquivos[0].nome.replace(/_via1\.pdf$/, "")}.zip`)}>
                    <FileArchive className="h-4 w-4" /> Todas as vias (.zip)
                  </Button>
                )}
                <Button variant="ghost" className="rounded-full" onClick={() => setResultado(null)}>
                  <Trash2 className="h-4 w-4" /> Descartar
                </Button>
              </div>
              {resultado.arquivos.length > 1 && (
                <p className="text-xs text-muted-foreground">Um arquivo por via: imprima cada um no papel da sua cor.</p>
              )}
            </div>
          )}
          <p className="flex items-center justify-center gap-1 pt-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> Tudo é feito aqui no seu computador. Nada é enviado para a internet.
          </p>
        </Painel>
      </div>
    </div>
  );
}

// ─── Peças da tela ───────────────────────────────────────────────────

function Mini({
  rotulo,
  valor,
  onChange,
  erro,
  ajuda,
  texto,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  erro?: string;
  ajuda?: string;
  texto?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs text-muted-foreground">{rotulo}</span>
      <input
        inputMode={texto ? "text" : "decimal"}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 w-full rounded-full bg-muted/60 px-4 text-sm font-semibold tabular-nums outline-none ring-1 ring-transparent focus:ring-primary/40",
          erro && "ring-destructive/60",
        )}
      />
      {(erro || ajuda) && <span className={cn("mt-1 block text-[11px]", erro ? "text-destructive" : "text-muted-foreground")}>{erro ?? ajuda}</span>}
    </label>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

/** Desenho da folha com os talões e o primeiro número de cada monte. */
function EsquemaFolha({ encaixe, plano, cfg }: { encaixe: Encaixe; plano: ReturnType<typeof planejarNumeracao>; cfg: ConfigNumeracao }) {
  const escala = 150 / Math.max(encaixe.folhaW, encaixe.folhaH);
  const W = encaixe.folhaW * escala;
  const H = encaixe.folhaH * escala;
  return (
    <svg width={W + 2} height={H + 2} viewBox={`-1 -1 ${W + 2} ${H + 2}`} className="shrink-0" role="img" aria-label="Montagem da folha">
      <rect x={0} y={0} width={W} height={H} rx={2} fill="#fff" style={{ filter: "drop-shadow(0 1px 2px rgb(0 0 0 / .15))" }} />
      {encaixe.celulas.map((c, j) => {
        const cw = (c.rot ? c.h : c.w) * escala;
        const ch = (c.rot ? c.w : c.h) * escala;
        const x = c.x * escala;
        const y = H - c.y * escala - ch;
        const n = numeroNaPosicao(plano, j, 0, cfg.taloes, cfg.jogos, cfg.inicio);
        return (
          <g key={j}>
            <rect x={x} y={y} width={cw} height={ch} className={n === null ? "fill-muted" : "fill-primary/15 stroke-primary/40"} strokeWidth={0.6} />
            {n !== null && (
              <text x={x + cw / 2} y={y + ch / 2 + 3} textAnchor="middle" className="fill-primary text-[8px] font-semibold">
                {formatarNumero(n, cfg.digitos)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Arte na tela; clicar/arrastar posiciona o número ativo. Em arte montada, vale para todas as células. */
function PreviaClicavel({
  arte,
  celulas,
  textos,
  posicoes,
  ativa,
  tamanhoPt,
  cor,
  onMover,
}: {
  arte: Arte;
  celulas: Celula[];
  textos: (j: number) => string | null;
  posicoes: PosicaoNumero[];
  ativa: number;
  tamanhoPt: number;
  cor: CorNumero;
  onMover: (i: number, pos: Partial<PosicaoNumero>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const arrastando = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const escala = largura / arte.w; // px por pt
  const caixa = (c: Celula) => ({
    left: c.x * escala,
    top: (arte.h - c.y - c.h) * escala,
    width: c.w * escala,
    height: c.h * escala,
  });

  const posicionar = (ev: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !escala) return;
    const px = ev.clientX - r.left;
    const py = ev.clientY - r.top;
    // célula sob o ponteiro (ou a mais próxima)
    let melhor = celulas[0];
    let dist = Infinity;
    for (const c of celulas) {
      const b = caixa(c);
      const dx = Math.max(b.left - px, 0, px - (b.left + b.width));
      const dy = Math.max(b.top - py, 0, py - (b.top + b.height));
      const d = dx * dx + dy * dy;
      if (d < dist) {
        dist = d;
        melhor = c;
      }
    }
    const b = caixa(melhor);
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    onMover(ativa, { x: clamp((px - b.left) / b.width), y: clamp((py - b.top) / b.height) });
  };

  const corTexto = cor === "vermelho" ? "#e30613" : "#111";

  return (
    <div
      ref={ref}
      className="relative mx-auto cursor-crosshair touch-none select-none overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border/60"
      style={{ aspectRatio: `${arte.w} / ${arte.h}`, width: `min(100%, calc(65vh * ${(arte.w / arte.h).toFixed(4)}))` }}
      onPointerDown={(e) => {
        arrastando.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        posicionar(e);
      }}
      onPointerMove={(e) => arrastando.current && posicionar(e)}
      onPointerUp={() => (arrastando.current = false)}
      onPointerCancel={() => (arrastando.current = false)}
    >
      <img src={arte.imagem} alt="Arte do talão" draggable={false} className="absolute inset-0 h-full w-full" />
      {celulas.length > 1 &&
        celulas.map((c, j) => <div key={`g${j}`} className="pointer-events-none absolute border border-dashed border-primary/50" style={caixa(c)} />)}
      {largura > 0 &&
        celulas.map((c, j) => {
          const t = textos(j);
          if (t === null) return null;
          const b = caixa(c);
          return posicoes.map((p, i) => (
            <span
              key={`${j}-${i}`}
              className={cn(
                "pointer-events-none absolute whitespace-nowrap font-bold leading-none",
                i === ativa && "rounded-[3px] outline outline-2 outline-offset-2 outline-primary/70",
              )}
              style={{
                left: b.left + p.x * b.width,
                top: b.top + p.y * b.height,
                fontSize: Math.max(4, tamanhoPt * escala),
                fontFamily: "Helvetica, Arial, sans-serif",
                color: corTexto,
                transform: `translate(-50%, -50%)${p.girar ? " rotate(-90deg)" : ""}`,
              }}
            >
              {t}
            </span>
          ));
        })}
    </div>
  );
}

