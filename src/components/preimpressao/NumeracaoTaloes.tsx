// Pré-impressão → ferramenta "Numeração de talões e blocos".
// Arte em PDF (uma arte por página ou várias artes já montadas na página) → PDF de impressão numerado em
// corte e empilha, um arquivo por via. Tudo no navegador.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileArchive, FileText, Loader2, Lock, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PT_POR_CM, detectarTipo } from "@/lib/preimpressao/margem";
import {
  COR_PADRAO,
  CORES_PADRAO,
  FOLHAS_PADRAO,
  FOLHA_PADRAO,
  aproveitamento,
  arteEmPe,
  calcularEncaixe,
  cmykDaCor,
  corValida,
  formatarNumero,
  gerarNumeracao,
  numeroNaPosicao,
  planejarNumeracao,
  sangriaDoPdf,
  tamanhoArte,
  tamanhoFinal,
  type Celula,
  type ConfigNumeracao,
  type Encaixe,
  type PosicaoNumero,
} from "@/lib/preimpressao/numeracao";
import { baixarBlob, baixarZip, renderizarPaginaPdf } from "@/lib/preimpressao/navegador";
import { Campo, Chave, Dado, DuasColunas, Mini, Painel, Passo, Segmentado, SeletorCor, SeletorFolha, SoltarArquivo } from "./ui";

// ─── Configuração (guardada no navegador) ────────────────────────────

type Modo = "solto" | "montado";

interface Config {
  modo: Modo;
  folha: string; // a4 | sra3 | 32.8x47.8 (Formatão)
  colunas: string;
  linhas: string;
  /** Solto: borda da folha até a sangria. */
  margem: string;
  /** Montada: margem da página até a grade. */
  margemMontada: string;
  espaco: string;
  sangria: string;
  marcasCorte: boolean;
  inicio: string;
  taloes: string;
  jogos: string;
  vias: number;
  digitos: string;
  prefixo: string;
  tamanho: string;
  /** "#RRGGBB"; padrão preto. */
  cor: string;
  /** Um só lugar para o número. */
  posicao: PosicaoNumero;
  ordemInvertida: boolean;
}

// v2 (08/11): padrão da Max Gráfica — folha 32,8 × 47,8, sangria 3 mm, borda 0,6 mm
const CONFIG_KEY = "preimpressao.numeracao.config.v2";
const PADRAO: Config = {
  modo: "solto",
  folha: "32.8x47.8",
  colunas: "2",
  linhas: "2",
  margem: "0,6",
  margemMontada: "0",
  espaco: "0",
  sangria: "3",
  marcasCorte: true,
  inicio: "1",
  taloes: "10",
  jogos: "50",
  vias: 2,
  digitos: "4",
  prefixo: "Nº ",
  tamanho: "12",
  cor: COR_PADRAO,
  posicao: { x: 0.85, y: 0.08, girar: false },
  ordemInvertida: false,
};

function lerConfig(): Config {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return PADRAO;
    const salvo = JSON.parse(raw) as Partial<Config> & { posicoes?: PosicaoNumero[] };
    const c = { ...PADRAO, ...salvo };
    // Versões antigas guardavam até 3 lugares para o número (davam número repetido): fica só o primeiro
    const antigo = Array.isArray(salvo.posicoes) ? salvo.posicoes[0] : undefined;
    const p = salvo.posicao ?? antigo;
    c.posicao =
      p && typeof p.x === "number" && typeof p.y === "number"
        ? { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)), girar: p.girar === true }
        : PADRAO.posicao;
    // A cor antiga era "vermelho"/"preto" (texto); agora é "#RRGGBB" e o padrão é preto
    c.cor = corValida(salvo.cor) ?? COR_PADRAO;
    delete (c as { posicoes?: unknown }).posicoes;
    // Caminho principal sempre: enviar uma arte e o sistema monta. "Já montado" é exceção.
    c.modo = "solto";
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
  // Só A4, SRA3 e Formatão; valor antigo salvo (A3, 33×48, outra) cai no Formatão
  const folha = FOLHAS_PADRAO.find((f) => f.key === c.folha) ?? FOLHAS_PADRAO.find((f) => f.key === FOLHA_PADRAO)!;
  const folhaW = folha.wCm * PT_POR_CM;
  const folhaH = folha.hCm * PT_POR_CM;
  const cfg: ConfigNumeracao = {
    modo: c.modo,
    folhaW,
    folhaH,
    colunas: chk("colunas", entre(c.colunas, 1, 20, true), "1 a 20"),
    linhas: chk("linhas", entre(c.linhas, 1, 20, true), "1 a 20"),
    margemMm:
      c.modo === "solto"
        ? chk("margem", entre(c.margem, 0, 50), "0 a 50 mm")
        : chk("margemMontada", entre(c.margemMontada, 0, 50), "0 a 50 mm"),
    sangriaMm: c.modo === "solto" ? chk("sangria", entre(c.sangria, 0, 20), "0 a 20 mm") : 0,
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
    posicao: c.posicao,
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
  /** Sangria gravada no PDF (TrimBox), em mm. */
  sangriaPdf: number | null;
}

interface Resultado {
  arquivos: { nome: string; blob: Blob }[];
  folhas: number;
  porFolha: number;
  faixa: string;
  vazias: number;
  amostra?: string;
}


const fmtCm = (pt: number) => (pt / PT_POR_CM).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default function NumeracaoTaloes() {
  const [config, setConfig] = useState<Config>(lerConfig);
  const [arte, setArte] = useState<Arte | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroArte, setErroArte] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroGerar, setErroGerar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

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
      const sangriaPdf = await sangriaDoPdf(bytes);
      if (sangriaPdf !== null) setConfig((c) => ({ ...c, sangria: String(sangriaPdf).replace(".", ",") }));
      setArte({ nome: f.name, emPe, w: t.w, h: t.h, paginas: t.paginas, imagem, sangriaPdf });
    } catch (e) {
      setArte(null);
      setErroArte(e instanceof Error ? e.message : "Não consegui abrir o arquivo.");
    } finally {
      setCarregando(false);
    }
  }, []);

  const moverPosicao = (pos: Partial<PosicaoNumero>) => setConfig((c) => ({ ...c, posicao: { ...c.posicao, ...pos } }));

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
    <DuasColunas
      esquerda={
        <>
        <Painel className="space-y-6">
          <Campo titulo={config.modo === "solto" ? "Envie a arte" : "Envie o PDF montado"}>
            <SoltarArquivo
              titulo={config.modo === "solto" ? "Solte o PDF de uma arte" : "Solte o PDF montado"}
              dica={`${config.modo === "solto" ? "Um talão só, com sangria." : "Folha pronta, com marcas de corte."} Pode ter uma página por via.`}
              arquivo={arte ? { nome: arte.nome, detalhe: `${fmtCm(arte.w)} × ${fmtCm(arte.h)} cm · ${arte.paginas} ${arte.paginas === 1 ? "página" : "páginas"}` } : null}
              carregando={carregando}
              erro={erroArte}
              onArquivos={(f) => void carregar(f)}
            />
          </Campo>

          {config.modo === "solto" ? (
            <>
              <Campo titulo="Folha de impressão">
                <SeletorFolha valor={FOLHAS_PADRAO.some((f) => f.key === config.folha) ? config.folha : FOLHA_PADRAO} onChange={(k) => set("folha", k)} />
                <p className="mt-2 text-xs text-muted-foreground">O sistema calcula quantas cabem e monta a folha sozinho.</p>
              </Campo>

              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                <Mini
                  rotulo="Sangria da arte (mm)"
                  valor={config.sangria}
                  onChange={(v) => set("sangria", v)}
                  erro={erros.sangria}
                  ajuda={arte?.sangriaPdf != null ? "Lida do PDF" : "Já incluída no PDF, por lado"}
                />
                <Mini rotulo="Borda da folha (mm)" valor={config.margem} onChange={(v) => set("margem", v)} erro={erros.margem} ajuda="Da beirada até a sangria" />
                <Mini
                  rotulo="Espaço entre artes (mm)"
                  valor={config.espaco}
                  onChange={(v) => set("espaco", v)}
                  erro={erros.espaco}
                  ajuda="0 = sangrias encostadas"
                />
              </div>

              <Chave ligado={config.marcasCorte} onChange={(v) => set("marcasCorte", v)}>
                <span className="font-medium">Marcas de corte</span>
                <span className="block text-xs text-muted-foreground">
                  Tracinhos na linha de corte, onde sobrar espaço na beirada da folha.
                </span>
              </Chave>
            </>
          ) : (
            <div className="space-y-4 rounded-2xl bg-muted/40 p-4">
              <div>
                <p className="text-sm font-semibold">PDF já montado: só numerar</p>
                <p className="text-xs text-muted-foreground">
                  A folha é usada do jeito que veio (com as suas marcas de corte). Informe quantas artes tem nela.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Colunas</p>
                  <Passo rotulo="colunas" valor={config.colunas} onChange={(v) => set("colunas", v)} min={1} max={20} invalido={!!erros.colunas} largura="w-8" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Linhas</p>
                  <Passo rotulo="linhas" valor={config.linhas} onChange={(v) => set("linhas", v)} min={1} max={20} invalido={!!erros.linhas} largura="w-8" />
                </div>
                <Mini rotulo="Margem da página (mm)" valor={config.margemMontada} onChange={(v) => set("margemMontada", v)} erro={erros.margemMontada} />
                <Mini rotulo="Espaço entre artes (mm)" valor={config.espaco} onChange={(v) => set("espaco", v)} erro={erros.espaco} />
              </div>
            </div>
          )}

          {/* Opção secundária: PDF já montado */}
          <button
            type="button"
            onClick={() => set("modo", config.modo === "solto" ? "montado" : "solto")}
            className="w-full text-center text-xs font-medium text-primary hover:underline"
          >
            {config.modo === "solto"
              ? "Já tenho o PDF montado na folha e só quero numerar"
              : "← Voltar: enviar uma arte e o sistema monta a folha"}
          </button>
        </Painel>

        <Painel className="space-y-6">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              <Mini rotulo="Começa no número" valor={config.inicio} onChange={(v) => set("inicio", v)} erro={erros.inicio} ajuda="Primeiro número impresso" />
              <Mini rotulo="Dígitos" valor={config.digitos} onChange={(v) => set("digitos", v)} erro={erros.digitos} ajuda={`Ex.: ${amostraNumero}`} />
              <Mini rotulo="Quantidade de talões" valor={config.taloes} onChange={(v) => set("taloes", v)} erro={erros.taloes} ajuda="Quantos blocos vão ser feitos" />
              <Mini rotulo="Jogos por talão" valor={config.jogos} onChange={(v) => set("jogos", v)} erro={erros.jogos} ajuda="Números (folhas) em cada bloco" />
            </div>
            {cfg && (
              <p className="rounded-2xl bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
                {cfg.taloes.toLocaleString("pt-BR")} {cfg.taloes === 1 ? "talão" : "talões"} × {cfg.jogos.toLocaleString("pt-BR")} jogos ={" "}
                <span className="font-semibold text-foreground">{(cfg.taloes * cfg.jogos).toLocaleString("pt-BR")} números</span>, de{" "}
                <span className="font-semibold text-foreground tabular-nums">{formatarNumero(cfg.inicio, cfg.digitos, cfg.prefixo)}</span> a{" "}
                <span className="font-semibold text-foreground tabular-nums">{formatarNumero(cfg.inicio + cfg.taloes * cfg.jogos - 1, cfg.digitos, cfg.prefixo)}</span>
              </p>
            )}
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
            <SeletorCor
              valor={config.cor}
              sugestoes={CORES_PADRAO}
              onChange={(hex) => set("cor", hex)}
              tinta={(() => {
                const [c, m, y, k] = cmykDaCor(config.cor);
                return `Tinta: C ${c} · M ${m} · Y ${y} · K ${k}`;
              })()}
            />
          </Campo>

          <Campo titulo="Posição do número" ajuda="Clique ou arraste na pré-visualização para escolher onde fica o número.">
            <Chave ligado={config.posicao.girar} onChange={(v) => moverPosicao({ girar: v })}>
              <span className="font-medium">Número em pé</span>
              <span className="block text-xs text-muted-foreground">Gira o número para ler de lado (bom para canhoto).</span>
            </Chave>
          </Campo>

          <Chave ligado={config.ordemInvertida} onChange={(v) => set("ordemInvertida", v)}>
            <span className="font-medium">Ordem invertida</span>
            <span className="block text-xs text-muted-foreground">Começa pela última folha (para impressoras que empilham ao contrário).</span>
          </Chave>
        </Painel>
        </>
      }
      direita={
        <>
        <Painel className="space-y-4">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Pré-visualização</h3>
            <p className="text-xs text-muted-foreground">
              {arte ? "Clique ou arraste na arte para escolher onde fica o número." : "Envie a arte para ver a pré-visualização."}
            </p>
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
              posicao={config.posicao}
              tamanhoPt={cfg?.tamanhoPt ?? 12}
              cor={config.cor}
              onMover={moverPosicao}
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
                {config.modo === "solto" && <EsquemaFolha encaixe={encaixe} plano={plano} cfg={cfg} sangriaPt={cfg.sangriaMm * (PT_POR_CM / 10)} />}
                <dl className="grid flex-1 grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3 text-sm min-w-[220px]">
                  <Dado rotulo="Artes por folha" valor={`${encaixe.celulas.length}${config.modo === "solto" ? ` (${encaixe.colunas} × ${encaixe.linhas})` : ""}`} />
                  <Dado rotulo="Folhas por via" valor={plano.folhas.toLocaleString("pt-BR")} />
                  <Dado rotulo="Numeração" valor={`${formatarNumero(plano.primeiro, cfg.digitos)} a ${formatarNumero(plano.ultimo, cfg.digitos)}`} />
                  <Dado rotulo="Total de folhas" valor={`${(plano.folhas * cfg.vias).toLocaleString("pt-BR")} (${cfg.vias} ${cfg.vias === 1 ? "via" : "vias"})`} />
                  {config.modo === "solto" && (
                    <>
                      <Dado rotulo="Folha" valor={`${fmtCm(encaixe.folhaW)} × ${fmtCm(encaixe.folhaH)} cm${encaixe.celulas[0].rot ? " · arte deitada" : ""}`} />
                      <Dado
                        rotulo="Tamanho final do talão"
                        valor={(() => {
                          const f = tamanhoFinal(arte, cfg.sangriaMm * (PT_POR_CM / 10));
                          return `${fmtCm(f.w)} × ${fmtCm(f.h)} cm`;
                        })()}
                      />
                      <Dado
                        rotulo="Aproveitamento da folha"
                        valor={`${Math.round(aproveitamento(encaixe, cfg.sangriaMm * (PT_POR_CM / 10)) * 100)}%`}
                      />
                    </>
                  )}
                  <Dado rotulo="Cada monte" valor={`${plano.folhas.toLocaleString("pt-BR")} números`} />
                </dl>
              </div>
              <Montes plano={plano} porFolha={encaixe.celulas.length} cfg={cfg} />
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

          <p className="flex items-center justify-center gap-1  text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> Tudo é feito aqui no seu computador. Nada é enviado para a internet.
          </p>
          {resultado && (
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
        </Painel>
        </>
      }
      rodape={
        !resultado ? (
              <Button size="lg" className="w-full rounded-full" disabled={!arte || !cfg || !encaixe || gerando} onClick={gerar}>
                {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {gerando ? "Gerando PDF…" : "Gerar PDF numerado"}
              </Button>
            
        ) : undefined
      }
    />
  );
}

// ─── Peças da tela ───────────────────────────────────────────────────

/** Lista dos montes (posições da folha) com a faixa de números de cada um. */
function Montes({ plano, porFolha, cfg }: { plano: ReturnType<typeof planejarNumeracao>; porFolha: number; cfg: ConfigNumeracao }) {
  const montes: string[] = [];
  for (let j = 0; j < porFolha; j++) {
    const ini = numeroNaPosicao(plano, j, 0, cfg.taloes, cfg.jogos, cfg.inicio);
    if (ini === null) break;
    const fim = Math.min(plano.ultimo, ini + plano.folhas - 1);
    montes.push(`${formatarNumero(ini, cfg.digitos)}–${formatarNumero(fim, cfg.digitos)}`);
  }
  return (
    <div className="space-y-2 rounded-2xl bg-muted/40 px-4 py-3 text-xs">
      <p className="font-medium text-foreground">Depois de cortar a pilha, cada monte fica assim:</p>
      <ol className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums text-muted-foreground">
        {montes.map((m, i) => (
          <li key={i}>
            <span className="font-semibold text-foreground">{i + 1}.</span> {m}
          </li>
        ))}
      </ol>
      {plano.talaoDividido && (
        <p className="text-muted-foreground">
          Empilhe os montes na ordem (1 em cima do 2, e assim por diante) e separe os talões a cada {cfg.jogos} folhas.
        </p>
      )}
      {plano.espacosVazios > 0 && (
        <p className="flex items-start gap-1 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {plano.espacosVazios} {plano.espacosVazios === 1 ? "espaço fica" : "espaços ficam"} em branco nas últimas folhas (sobra da divisão).
        </p>
      )}
    </div>
  );
}

/** Desenho da folha com os talões e o primeiro número de cada monte. */
function EsquemaFolha({
  encaixe,
  plano,
  cfg,
  sangriaPt,
}: {
  encaixe: Encaixe;
  plano: ReturnType<typeof planejarNumeracao>;
  cfg: ConfigNumeracao;
  sangriaPt: number;
}) {
  const escala = 120 / Math.max(encaixe.folhaW, encaixe.folhaH);
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
            <rect x={x} y={y} width={cw} height={ch} className={n === null ? "fill-muted" : "fill-primary/10"} />
            {sangriaPt > 0 && cw > 2 * sangriaPt * escala && (
              <rect
                x={x + sangriaPt * escala}
                y={y + sangriaPt * escala}
                width={cw - 2 * sangriaPt * escala}
                height={ch - 2 * sangriaPt * escala}
                className={n === null ? "fill-none stroke-muted-foreground/30" : "fill-primary/15 stroke-primary/50"}
                strokeWidth={0.5}
              />
            )}
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
  posicao,
  tamanhoPt,
  cor,
  onMover,
}: {
  arte: Arte;
  celulas: Celula[];
  textos: (j: number) => string | null;
  posicao: PosicaoNumero;
  tamanhoPt: number;
  cor: string;
  onMover: (pos: Partial<PosicaoNumero>) => void;
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
    onMover({ x: clamp((px - b.left) / b.width), y: clamp((py - b.top) / b.height) });
  };

  const corTexto = corValida(cor) ?? COR_PADRAO;

  return (
    <div
      ref={ref}
      className="relative mx-auto cursor-crosshair touch-none select-none overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border/60"
      style={{ aspectRatio: `${arte.w} / ${arte.h}`, width: `min(100%, calc(42vh * ${(arte.w / arte.h).toFixed(4)}))` }}
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
          return (
            <span
              key={j}
              className="pointer-events-none absolute whitespace-nowrap rounded-[3px] font-bold leading-none outline outline-2 outline-offset-2 outline-primary/60"
              style={{
                left: b.left + posicao.x * b.width,
                top: b.top + posicao.y * b.height,
                fontSize: Math.max(4, tamanhoPt * escala),
                fontFamily: "Helvetica, Arial, sans-serif",
                color: corTexto,
                transform: `translate(-50%, -50%)${posicao.girar ? " rotate(-90deg)" : ""}`,
              }}
            >
              {t}
            </span>
          );
        })}
    </div>
  );
}

