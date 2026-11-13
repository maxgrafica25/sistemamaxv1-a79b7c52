// Pré-impressão → ferramenta "Crachás" (dados variáveis para a Fargo C50).
// Cola a lista do Excel (nome, cargo, setor, matrícula), solta as fotos e o sistema monta um cartão
// por pessoa no tamanho exato do CR80 (85,6 × 54 mm), com faixa de cor por setor, QR Code, verso,
// prova em A4 e cartão de teste. Tudo no navegador, sem custo.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, Download, Loader2, Save, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FontesExternas } from "@/lib/preimpressao/agenda";
import { carregarFontes } from "@/lib/preimpressao/agendaNavegador";
import {
  AJUSTE_PADRAO,
  ELEMENTOS_CRACHA,
  LISTA_DE_EXEMPLO,
  acharFoto,
  aspectoDaFoto,
  conferirCrachas,
  configCrachaPadrao,
  corDoSetor,
  elementosPadrao,
  gerarCartaoDeTeste,
  gerarCartoes,
  gerarProva,
  gerarVerso,
  lerTabela,
  ordenarPessoas,
  pessoasDaTabela,
  setoresDaLista,
  type AjusteFoto,
  type CartoesGerados,
  type ConfigCracha,
  type ElementoCracha,
  type Fundo,
  type OrdemLista,
  type Orientacao,
  type Pessoa,
} from "@/lib/preimpressao/cracha";
import { arteParaModelo, ehImagem, fundoDeModelo, lerArte, lerFoto, recortarFoto, type ArteLida } from "@/lib/preimpressao/crachaNavegador";
import type { Imagem } from "@/lib/preimpressao/agenda";
import { baixarBlob, baixarZip } from "@/lib/preimpressao/navegador";
import { nomeDeArquivo } from "./agendaConfig";
import { CrachaFotoAjuste } from "./CrachaFotoAjuste";
import { CrachaPrevia } from "./CrachaPrevia";
import { CrachaVersoGuia } from "./CrachaVersoGuia";
import { Campo, Chave, DuasColunas, NotaPrivacidade, Painel, Passo, PreviaPdf, SeletorCor, Segmentado, SoltarArquivo } from "./ui";
import { useConfigSalva } from "./uteis";

type FotoLida = Awaited<ReturnType<typeof lerFoto>>;

interface ConfigUI extends ConfigCracha {
  ordem: OrdemLista;
  girarVerso: boolean;
  corVerso: string;
  mostrarFuro: boolean;
}

const PADRAO: ConfigUI = { ...configCrachaPadrao("pe"), ordem: "lista", girarVerso: false, corVerso: "#ffffff", mostrarFuro: true };

const FUNDOS = [
  { nome: "Branco", hex: "#ffffff" },
  { nome: "Cinza claro", hex: "#f1f5f9" },
  { nome: "Azul escuro", hex: "#0f2a5c" },
  { nome: "Preto", hex: "#111827" },
  { nome: "Verde escuro", hex: "#14532d" },
  { nome: "Vinho", hex: "#7f1d1d" },
];
const TEXTOS = [
  { nome: "Preto", hex: "#111827" },
  { nome: "Cinza", hex: "#4b5563" },
  { nome: "Branco", hex: "#ffffff" },
  { nome: "Azul", hex: "#1d4ed8" },
  { nome: "Vermelho", hex: "#dc2626" },
];

const MODELOS_CHAVE = "preimpressao.cracha.modelos.v1";

interface ModeloSalvo {
  cfg: ConfigUI;
  fundo: { dataUrl: string; tipo: "png" | "jpg"; w: number; h: number } | null;
  verso: { dataUrl: string; tipo: "png" | "jpg"; w: number; h: number } | null;
}

function lerModelos(): Record<string, ModeloSalvo> {
  try {
    return JSON.parse(window.localStorage.getItem(MODELOS_CHAVE) ?? "{}") as Record<string, ModeloSalvo>;
  } catch {
    return {};
  }
}

function gravarModelos(m: Record<string, ModeloSalvo>): boolean {
  try {
    window.localStorage.setItem(MODELOS_CHAVE, JSON.stringify(m));
    return true;
  } catch {
    return false;
  }
}

function Bloco({ titulo, resumo, children, aberto: inicial = false }: { titulo: string; resumo: string; children: ReactNode; aberto?: boolean }) {
  const [aberto, setAberto] = useState(inicial);
  return (
    <div className="rounded-2xl bg-muted/50">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="min-w-0">
          <span className="font-medium">{titulo}</span>
          <span className="block truncate text-xs text-muted-foreground">{resumo}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} />
      </button>
      {aberto && <div className="space-y-6 px-4 pb-5 pt-1">{children}</div>}
    </div>
  );
}

const num = (v: string, atual: number, min: number, max: number) => {
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : atual;
};

export default function Crachas() {
  const [cfg, set] = useConfigSalva<ConfigUI>("preimpressao.cracha.config.v1", PADRAO);
  const [texto, setTexto] = useState("");
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [fotos, setFotos] = useState<FotoLida[]>([]);
  const [ajustes, setAjustes] = useState<Record<string, AjusteFoto>>({});
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [arte, setArte] = useState<ArteLida | null>(null);
  const [arteVerso, setArteVerso] = useState<ArteLida | null>(null);
  const [erroArte, setErroArte] = useState<string | null>(null);
  const [erroFotos, setErroFotos] = useState<string | null>(null);
  const [sel, setSel] = useState<ElementoCracha>("nome");
  const [idx, setIdx] = useState(0);
  const [aba, setAba] = useState<"frente" | "verso" | "prova">("frente");
  const [externas, setExternas] = useState<FontesExternas | null>(null);
  const [recortes, setRecortes] = useState<Map<string, Imagem>>(new Map());
  const [completo, setCompleto] = useState<CartoesGerados | null>(null);
  const [previa, setPrevia] = useState<Uint8Array | null>(null);
  const [versoBytes, setVersoBytes] = useState<Uint8Array | null>(null);
  const [provaBytes, setProvaBytes] = useState<Uint8Array | null>(null);
  const [gerando, setGerando] = useState(false);
  const [acao, setAcao] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modelos, setModelos] = useState<Record<string, ModeloSalvo>>(() => lerModelos());
  const [nomeModelo, setNomeModelo] = useState("");
  const [avisoModelo, setAvisoModelo] = useState<string | null>(null);
  const cacheRecortes = useRef(new Map<string, Imagem>());
  const arquivoLista = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void carregarFontes().then(setExternas);
  }, []);

  // ─── Pessoas ────────────────────────────────────────────────────
  const lista = useMemo(() => pessoasDaTabela(lerTabela(texto)), [texto]);
  const ordenadas = useMemo(() => ordenarPessoas(lista.pessoas, cfg.ordem), [lista.pessoas, cfg.ordem]);
  const incluidas = useMemo(() => ordenadas.filter((p) => !excluidos.has(p.id)), [ordenadas, excluidos]);
  const ordemSetores = useMemo(() => setoresDaLista(lista.pessoas).map((s) => s.chave), [lista.pessoas]);
  const setores = useMemo(() => setoresDaLista(lista.pessoas), [lista.pessoas]);
  const fotoDe = useMemo(() => {
    const m = new Map<string, FotoLida>();
    for (const p of lista.pessoas) {
      const f = acharFoto(p, fotos) as FotoLida | null;
      if (f) m.set(p.id, f);
    }
    return m;
  }, [lista.pessoas, fotos]);
  const atual = incluidas[Math.min(idx, Math.max(0, incluidas.length - 1))] as Pessoa | undefined;

  useEffect(() => {
    setExcluidos(new Set());
    setAjustes({});
    setIdx(0);
  }, [texto]);

  const fundo: Fundo | null = arte?.fundo ?? null;
  const fundoVerso: Fundo | null = arteVerso?.fundo ?? null;

  // ─── Recorte das fotos (cada pessoa, no tamanho da moldura) ──────
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      const aspecto = aspectoDaFoto(cfg.forma);
      const novo = new Map<string, Imagem>();
      for (const p of incluidas) {
        const f = fotoDe.get(p.id);
        if (!f) continue;
        const aj = ajustes[p.id] ?? AJUSTE_PADRAO;
        const chave = `${p.id}|${f.nome}|${f.bytes.length}|${aspecto}|${aj.zoom}|${aj.x}|${aj.y}`;
        let img = cacheRecortes.current.get(chave);
        if (!img) {
          try {
            img = await recortarFoto(f, aspecto, aj);
          } catch {
            continue;
          }
          cacheRecortes.current.set(chave, img);
        }
        if (!vivo) return;
        novo.set(p.id, img);
      }
      if (vivo) setRecortes(novo);
    }, 200);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [incluidas, fotoDe, ajustes, cfg.forma]);

  const cfgPdf: ConfigCracha = useMemo(
    () => ({ orientacao: cfg.orientacao, corFundo: cfg.corFundo, forma: cfg.forma, elementos: cfg.elementos, faixa: cfg.faixa, coresSetor: cfg.coresSetor }),
    [cfg.orientacao, cfg.corFundo, cfg.forma, cfg.elementos, cfg.faixa, cfg.coresSetor],
  );

  // ─── Prévia da pessoa escolhida (rápida) ─────────────────────────
  useEffect(() => {
    if (!atual) return setPrevia(null);
    let vivo = true;
    const t = setTimeout(() => {
      gerarCartoes({ cfg: cfgPdf, pessoas: [atual], fotos: recortes, fundo, externas, ordemSetores })
        .then((r) => vivo && setPrevia(r.bytes))
        .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível desenhar o crachá."));
    }, 80);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [atual, cfgPdf, recortes, fundo, externas, ordemSetores]);

  // ─── Todos os cartões (para baixar e para a conferência) ─────────
  useEffect(() => {
    if (!incluidas.length) {
      setCompleto(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(() => {
      gerarCartoes({ cfg: cfgPdf, pessoas: incluidas, fotos: recortes, fundo, externas, ordemSetores })
        .then((r) => {
          if (!vivo) return;
          setCompleto(r);
          setErro(null);
        })
        .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível montar os crachás."))
        .finally(() => vivo && setGerando(false));
    }, 700);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [incluidas, cfgPdf, recortes, fundo, externas, ordemSetores]);

  // ─── Verso e prova ──────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    gerarVerso({ orientacao: cfg.orientacao, corFundo: cfg.corVerso, fundo: fundoVerso, copias: 1, girar: cfg.girarVerso })
      .then((b) => vivo && setVersoBytes(b))
      .catch(() => vivo && setVersoBytes(null));
    return () => {
      vivo = false;
    };
  }, [cfg.orientacao, cfg.corVerso, cfg.girarVerso, fundoVerso]);

  useEffect(() => {
    if (aba !== "prova" || !completo) return;
    let vivo = true;
    gerarProva(completo.bytes, cfg.orientacao)
      .then((b) => vivo && setProvaBytes(b))
      .catch(() => vivo && setProvaBytes(null));
    return () => {
      vivo = false;
    };
  }, [aba, completo, cfg.orientacao]);

  // ─── Conferência ────────────────────────────────────────────────
  const conferencia = useMemo(() => {
    const fotosInfo = new Map<string, { w: number; h: number; ajuste: AjusteFoto }>();
    for (const p of incluidas) {
      const f = fotoDe.get(p.id);
      if (f) fotosInfo.set(p.id, { w: f.w, h: f.h, ajuste: ajustes[p.id] ?? AJUSTE_PADRAO });
    }
    return conferirCrachas({
      cfg: cfgPdf,
      pessoas: incluidas,
      fotos: fotosInfo,
      avisosDeDesenho: completo?.avisos,
      arte: arte ? { aspecto: arte.aspecto, px: arte.px } : null,
    });
  }, [incluidas, fotoDe, ajustes, cfgPdf, completo, arte]);

  // ─── Ações ──────────────────────────────────────────────────────
  const setElemento = (chave: ElementoCracha, p: Partial<ConfigCracha["elementos"][ElementoCracha]>) => set("elementos", { ...cfg.elementos, [chave]: { ...cfg.elementos[chave], ...p } });

  /** Troca a cor de todos os textos de uma vez (útil quando a arte de fundo é escura). */
  const textosTodos = (cor: string) => {
    const e = { ...cfg.elementos };
    for (const k of ["nome", "cargo", "matricula"] as const) e[k] = { ...e[k], cor };
    set("elementos", e);
  };

  const trocarOrientacao = (o: Orientacao) => {
    if (o === cfg.orientacao) return;
    set("orientacao", o);
    // muda só as posições e tamanhos: as cores que a pessoa escolheu ficam
    const novo = elementosPadrao(o);
    for (const k of Object.keys(novo) as ElementoCracha[]) novo[k] = { ...novo[k], cor: cfg.elementos[k].cor, ativo: cfg.elementos[k].ativo };
    set("elementos", novo);
    set("faixa", { ...cfg.faixa, mm: o === "pe" ? 10 : 8 });
  };

  const receberFotos = async (files: File[]) => {
    const imagens = files.filter((f) => ehImagem(f.name) || f.type.startsWith("image/"));
    if (!imagens.length) return setErroFotos("Envie fotos em JPG, PNG ou WebP.");
    setErroFotos(null);
    const lidas: FotoLida[] = [];
    let falhas = 0;
    for (const f of imagens) {
      try {
        lidas.push(await lerFoto(f));
      } catch {
        falhas++;
      }
    }
    setFotos((prev) => {
      const mapa = new Map(prev.map((x) => [x.nome.toLowerCase(), x]));
      for (const l of lidas) mapa.set(l.nome.toLowerCase(), l);
      return [...mapa.values()];
    });
    if (falhas) setErroFotos(`${falhas} arquivo(s) não abriram como foto.`);
  };

  const receberArte = async (files: File[], verso: boolean) => {
    if (!files[0]) return;
    try {
      const a = await lerArte(files[0]);
      if (verso) setArteVerso(a);
      else setArte(a);
      setErroArte(null);
    } catch (e) {
      setErroArte(e instanceof Error ? e.message : "Não consegui abrir a arte.");
    }
  };

  const lerArquivoLista = async (f: File | undefined) => {
    if (f) setTexto(await f.text());
  };

  const executar = async (nome: string, fn: () => Promise<void>) => {
    setAcao(nome);
    setErro(null);
    try {
      await fn();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setAcao(null);
    }
  };

  const baixarPdf = () => completo && baixarBlob(new Blob([completo.bytes], { type: "application/pdf" }), "Crachas.pdf");

  const baixarIndividuais = () =>
    executar("zip", async () => {
      const arquivos: { nome: string; blob: Blob }[] = [];
      for (const [i, p] of incluidas.entries()) {
        setAcao(`zip ${i + 1}/${incluidas.length}`);
        const r = await gerarCartoes({ cfg: cfgPdf, pessoas: [p], fotos: recortes, fundo, externas, ordemSetores });
        arquivos.push({ nome: `Cracha_${String(i + 1).padStart(3, "0")}_${nomeDeArquivo(p.nome || "sem nome")}.pdf`, blob: new Blob([r.bytes], { type: "application/pdf" }) });
      }
      await baixarZip(arquivos, "Crachas_individuais.zip");
    });

  const baixarVersos = () =>
    executar("verso", async () => {
      const b = await gerarVerso({ orientacao: cfg.orientacao, corFundo: cfg.corVerso, fundo: fundoVerso, copias: Math.max(1, incluidas.length), girar: cfg.girarVerso });
      baixarBlob(new Blob([b], { type: "application/pdf" }), "Versos_dos_crachas.pdf");
    });

  const baixarTeste = () =>
    executar("teste", async () => {
      const b = await gerarCartaoDeTeste(cfg.orientacao, cfg.girarVerso);
      baixarBlob(new Blob([b], { type: "application/pdf" }), "Cartao_de_teste_Fargo.pdf");
    });

  const baixarProva = () =>
    executar("prova", async () => {
      const b = provaBytes ?? (completo ? await gerarProva(completo.bytes, cfg.orientacao) : null);
      if (b) baixarBlob(new Blob([b], { type: "application/pdf" }), "Prova_dos_crachas.pdf");
    });

  const salvarModelo = async () => {
    const n = nomeModelo.trim();
    if (!n) return;
    const m: ModeloSalvo = { cfg, fundo: fundo ? await arteParaModelo(fundo) : null, verso: fundoVerso ? await arteParaModelo(fundoVerso) : null };
    const novo = { ...modelos, [n]: m };
    if (!gravarModelos(novo)) return setAvisoModelo("Não coube no navegador. Apague um modelo ou use uma arte menor.");
    setModelos(novo);
    setNomeModelo("");
    setAvisoModelo(`Modelo "${n}" salvo (sem as fotos e a lista).`);
  };

  const abrirModelo = (n: string) => {
    const m = modelos[n];
    if (!m) return;
    (Object.keys(PADRAO) as (keyof ConfigUI)[]).forEach((k) => set(k, (m.cfg[k] ?? PADRAO[k]) as never));
    const comoArte = (a: ModeloSalvo["fundo"], nome: string): ArteLida | null => (a ? { nome, fundo: fundoDeModelo(a), aspecto: a.w / a.h, px: { w: a.w, h: a.h } } : null);
    setArte(comoArte(m.fundo, "arte do modelo"));
    setArteVerso(comoArte(m.verso, "verso do modelo"));
    setAvisoModelo(`Modelo "${n}" aberto.`);
  };

  const apagarModelo = (n: string) => {
    const { [n]: _t, ...resto } = modelos;
    void _t;
    gravarModelos(resto);
    setModelos(resto);
    setAvisoModelo(null);
  };

  const nomesModelos = Object.keys(modelos).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const el = cfg.elementos[sel];
  const unidade = ELEMENTOS_CRACHA.find((e) => e.chave === sel)?.unidade ?? "pt";
  const ajustandoPessoa = ajustando ? lista.pessoas.find((p) => p.id === ajustando) : undefined;

  // ─── Tela ───────────────────────────────────────────────────────
  const esquerda = (
    <>
      <Painel className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Crachás</h2>
          <p className="text-sm text-muted-foreground">Cole a lista, solte as fotos e imprima na Fargo C50. Um cartão CR80 (85,6 × 54 mm) por pessoa.</p>
        </div>
        <NotaPrivacidade />

        <Bloco titulo="1. Lista de pessoas" resumo={lista.pessoas.length ? `${incluidas.length} de ${lista.pessoas.length} no lote · ${fotoDe.size} foto(s) achada(s)` : "Cole do Excel ou abra um CSV"} aberto>
          <Campo titulo="Cole aqui" ajuda="Copie as colunas no Excel (Nome, Cargo, Setor, Matrícula, Foto) e cole. A 1ª linha pode ser o cabeçalho. A coluna Foto é opcional: sem ela, a foto é achada pelo nome da pessoa.">
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} placeholder={"Nome\tCargo\tSetor\tMatrícula"} className="rounded-2xl font-mono text-xs" />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setTexto(LISTA_DE_EXEMPLO)}>
                Usar lista de exemplo
              </Button>
              <Button size="sm" variant="secondary" className="rounded-full" onClick={() => arquivoLista.current?.click()}>
                Abrir CSV ou TXT
              </Button>
              {texto && (
                <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setTexto("")}>
                  Limpar
                </Button>
              )}
              <input ref={arquivoLista} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="hidden" onChange={(e) => { void lerArquivoLista(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            {lista.excedeu && <p className="mt-2 text-xs text-destructive">A lista passou de 1.000 pessoas: só as primeiras 1.000 entram.</p>}
          </Campo>

          <Campo titulo="Fotos" ajuda="Solte as fotos de uma vez. O nome do arquivo deve ser o da pessoa (Maria Silva.jpg) ou o que está na coluna Foto.">
            <SoltarArquivo
              titulo="Solte as fotos aqui"
              dica="JPG, PNG ou WebP, quantas quiser"
              arquivo={fotos.length ? { nome: `${fotos.length} foto(s)`, detalhe: `${fotoDe.size} combinam com a lista` } : null}
              aceita="image/*"
              multiplo
              erro={erroFotos}
              onArquivos={(f) => void receberFotos(f)}
            />
            {fotos.length > 0 && (
              <Button size="sm" variant="ghost" className="mt-2 rounded-full" onClick={() => setFotos([])}>
                Remover as fotos
              </Button>
            )}
          </Campo>

          {lista.pessoas.length > 0 && (
            <>
              <Campo titulo="Ordem">
                <Segmentado
                  valor={cfg.ordem}
                  opcoes={[
                    { valor: "lista" as const, rotulo: "Como está" },
                    { valor: "nome" as const, rotulo: "Nome" },
                    { valor: "setor" as const, rotulo: "Setor" },
                    { valor: "matricula" as const, rotulo: "Matrícula" },
                  ]}
                  onChange={(v) => set("ordem", v)}
                />
              </Campo>
              <Campo titulo="Quem entra no lote" ajuda="Desmarque quem não deve ser impresso agora. Clique no nome para ver o crachá na prévia.">
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-2xl bg-background p-2 ring-1 ring-border/60">
                  {ordenadas.slice(0, 300).map((p) => {
                    const foto = fotoDe.get(p.id);
                    const incl = !excluidos.has(p.id);
                    const pos = incluidas.findIndex((x) => x.id === p.id);
                    return (
                      <div key={p.id} className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm", atual?.id === p.id && "bg-primary/10")}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0"
                          checked={incl}
                          aria-label={`Imprimir ${p.nome || "linha sem nome"}`}
                          onChange={() =>
                            setExcluidos((prev) => {
                              const n = new Set(prev);
                              if (n.has(p.id)) n.delete(p.id);
                              else n.add(p.id);
                              return n;
                            })
                          }
                        />
                        <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => pos >= 0 && setIdx(pos)} title={p.nome}>
                          <span className={cn("font-medium", !p.nome && "text-destructive")}>{p.nome || "(sem nome)"}</span>
                          <span className="block truncate text-xs text-muted-foreground">{[p.cargo, p.setor].filter(Boolean).join(" · ") || "—"}</span>
                        </button>
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", foto ? "bg-emerald-500" : "bg-amber-400")} title={foto ? "Foto encontrada" : "Sem foto"} />
                        {foto && (
                          <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={() => setAjustando(p.id)}>
                            Ajustar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {ordenadas.length > 300 && <p className="px-2 py-1 text-xs text-muted-foreground">Mostrando 300 de {ordenadas.length}; todos entram no lote.</p>}
                </div>
              </Campo>
            </>
          )}
        </Bloco>

        <Bloco titulo="2. Modelo do crachá" resumo={`${cfg.orientacao === "pe" ? "Em pé" : "Deitado"} · foto ${cfg.forma === "circulo" ? "redonda" : cfg.forma === "arredondado" ? "arredondada" : "quadrada"}${arte ? " · com arte" : ""}`} aberto>
          <Campo titulo="Posição do cartão">
            <Segmentado
              valor={cfg.orientacao}
              opcoes={[
                { valor: "pe" as const, rotulo: "Em pé" },
                { valor: "deitado" as const, rotulo: "Deitado" },
              ]}
              onChange={trocarOrientacao}
            />
          </Campo>
          <Campo titulo="Arte de fundo" ajuda="Opcional. PDF, PNG ou JPG do crachá do cliente, na mesma proporção do cartão. Ela cobre o cartão inteiro, sem margem.">
            <SoltarArquivo
              titulo="Solte a arte do crachá"
              dica="PDF, PNG ou JPG"
              arquivo={arte ? { nome: arte.nome, detalhe: arte.px ? `${arte.px.w} × ${arte.px.h} px` : "PDF (vetor mantido)" } : null}
              aceita=".pdf,application/pdf,.png,.jpg,.jpeg,image/png,image/jpeg"
              erro={erroArte}
              onArquivos={(f) => void receberArte(f, false)}
            />
            {arte && (
              <Button size="sm" variant="ghost" className="mt-2 rounded-full" onClick={() => setArte(null)}>
                Tirar a arte
              </Button>
            )}
          </Campo>
          <Campo titulo="Cor de fundo">
            <SeletorCor valor={cfg.corFundo} sugestoes={FUNDOS} onChange={(v) => set("corFundo", v)} />
          </Campo>
          <Campo titulo="Forma da foto">
            <Segmentado
              valor={cfg.forma}
              opcoes={[
                { valor: "circulo" as const, rotulo: "Redonda" },
                { valor: "arredondado" as const, rotulo: "3 × 4" },
                { valor: "quadrado" as const, rotulo: "Quadrada" },
              ]}
              onChange={(v) => set("forma", v)}
            />
          </Campo>

          <Campo titulo="Elementos" ajuda="Escolha o elemento e clique ou arraste na prévia ao lado, ou use os botões. Desligue o que não precisa.">
            <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Elemento">
              {ELEMENTOS_CRACHA.map((e) => (
                <button
                  key={e.chave}
                  type="button"
                  role="radio"
                  aria-checked={sel === e.chave}
                  onClick={() => setSel(e.chave)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    sel === e.chave ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground",
                    !cfg.elementos[e.chave].ativo && "line-through opacity-60",
                  )}
                >
                  {e.rotulo}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <Chave ligado={el.ativo} onChange={(v) => setElemento(sel, { ativo: v })}>
                <span className="font-medium">Mostrar {ELEMENTOS_CRACHA.find((e) => e.chave === sel)?.rotulo.toLowerCase()}</span>
                {sel === "qr" && <span className="block text-xs text-muted-foreground">O QR Code leva a matrícula (ou o nome, se não houver matrícula).</span>}
              </Chave>
              {el.ativo && (
                <>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Da esquerda para a direita</p>
                    <Passo valor={String(Math.round(el.x))} onChange={(v) => setElemento(sel, { x: num(v, el.x, 0, 100) })} min={0} max={100} sufixo="%" rotulo="posição na horizontal" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">De cima para baixo</p>
                    <Passo valor={String(Math.round(el.y))} onChange={(v) => setElemento(sel, { y: num(v, el.y, 0, 100) })} min={0} max={100} sufixo="%" rotulo="posição na vertical" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">{unidade === "mm" ? "Tamanho (largura)" : "Tamanho da letra"}</p>
                    <Passo
                      valor={String(el.tam).replace(".", ",")}
                      onChange={(v) => setElemento(sel, { tam: num(v, el.tam, unidade === "mm" ? 8 : 4, unidade === "mm" ? 60 : 40) })}
                      passo={unidade === "mm" ? 1 : 0.5}
                      min={unidade === "mm" ? 8 : 4}
                      max={unidade === "mm" ? 60 : 40}
                      sufixo={unidade}
                      rotulo="tamanho"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">{sel === "foto" ? "Cor do contorno da foto" : sel === "qr" ? "Cor dos quadradinhos" : "Cor do texto"}</p>
                    <SeletorCor valor={el.cor} sugestoes={TEXTOS} onChange={(v) => setElemento(sel, { cor: v })} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setElemento(sel, { x: 50 })}>
                      Centralizar
                    </Button>
                    <Button size="sm" variant="secondary" className="rounded-full" onClick={() => textosTodos("#ffffff")}>
                      Todos os textos claros
                    </Button>
                    <Button size="sm" variant="secondary" className="rounded-full" onClick={() => textosTodos("#111827")}>
                      Todos escuros
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={() => set("elementos", elementosPadrao(cfg.orientacao))}>
                      Voltar ao padrão
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Campo>

          <Campo titulo="Faixa colorida do setor" ajuda="Uma faixa na cor do setor de cada pessoa (Staff, Visitante, Operações…). O texto do setor fica em cima dela.">
            <Segmentado
              valor={cfg.faixa.posicao}
              opcoes={[
                { valor: "base" as const, rotulo: "Embaixo" },
                { valor: "topo" as const, rotulo: "Em cima" },
                { valor: "nenhuma" as const, rotulo: "Sem faixa" },
              ]}
              onChange={(v) => set("faixa", { ...cfg.faixa, posicao: v })}
            />
            {cfg.faixa.posicao !== "nenhuma" && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Altura da faixa</p>
                  <Passo valor={String(cfg.faixa.mm).replace(".", ",")} onChange={(v) => set("faixa", { ...cfg.faixa, mm: num(v, cfg.faixa.mm, 3, 25) })} passo={1} min={3} max={25} sufixo="mm" rotulo="altura da faixa" />
                </div>
                {setores.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Cor de cada setor</p>
                    {setores.map((s) => (
                      <label key={s.chave} className="flex items-center gap-3 rounded-xl bg-background px-3 py-1.5 text-sm ring-1 ring-border/60">
                        <input
                          type="color"
                          aria-label={`Cor do setor ${s.nome}`}
                          value={corDoSetor(s.nome, cfg, ordemSetores)}
                          onChange={(e) => set("coresSetor", { ...cfg.coresSetor, [s.chave]: e.target.value.toLowerCase() })}
                          className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
                        />
                        <span className="truncate">{s.nome}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">As cores dos setores aparecem aqui quando a lista tiver a coluna Setor.</p>
                )}
              </div>
            )}
          </Campo>
          <Chave ligado={cfg.mostrarFuro} onChange={(v) => set("mostrarFuro", v)}>
            <span className="font-medium">Mostrar a região do furo do cordão</span>
            <span className="block text-xs text-muted-foreground">Guia só na prévia (não vai para o cartão): evite texto na área rosa.</span>
          </Chave>
        </Bloco>

        <Bloco titulo="3. Verso do cartão" resumo={arteVerso ? arteVerso.nome : "Opcional · como virar o cartão na Fargo"}>
          <Campo titulo="Arte do verso" ajuda="Igual para todos os cartões. A Fargo C50 imprime um lado por vez: o verso sai em um PDF separado.">
            <SoltarArquivo
              titulo="Solte a arte do verso"
              dica="PDF, PNG ou JPG"
              arquivo={arteVerso ? { nome: arteVerso.nome, detalhe: arteVerso.px ? `${arteVerso.px.w} × ${arteVerso.px.h} px` : "PDF (vetor mantido)" } : null}
              aceita=".pdf,application/pdf,.png,.jpg,.jpeg,image/png,image/jpeg"
              onArquivos={(f) => void receberArte(f, true)}
            />
            {arteVerso && (
              <Button size="sm" variant="ghost" className="mt-2 rounded-full" onClick={() => setArteVerso(null)}>
                Tirar a arte do verso
              </Button>
            )}
          </Campo>
          <Campo titulo="Cor de fundo do verso">
            <SeletorCor valor={cfg.corVerso} sugestoes={FUNDOS} onChange={(v) => set("corVerso", v)} />
          </Campo>
          <Chave ligado={cfg.girarVerso} onChange={(v) => set("girarVerso", v)}>
            <span className="font-medium">Girar o verso 180°</span>
            <span className="block text-xs text-muted-foreground">Ligue se, no teste, o verso sair de cabeça para baixo em relação à frente.</span>
          </Chave>
          <CrachaVersoGuia />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="rounded-full" onClick={() => void baixarTeste()} disabled={!!acao}>
              <Download className="mr-2 h-4 w-4" />
              Cartão de teste (frente e verso)
            </Button>
            <Button className="rounded-full" onClick={() => void baixarVersos()} disabled={!!acao || !incluidas.length}>
              <Download className="mr-2 h-4 w-4" />
              Baixar versos ({incluidas.length || 0})
            </Button>
          </div>
        </Bloco>

        <Bloco titulo="Modelos do cliente" resumo={nomesModelos.length ? `${nomesModelos.length} salvo(s) neste computador` : "Guarde o visual para o próximo lote"}>
          {nomesModelos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nomesModelos.map((n) => (
                <span key={n} className="flex items-center rounded-full bg-background text-xs font-medium ring-1 ring-border/60">
                  <button type="button" className="rounded-l-full py-1.5 pl-3 pr-2 hover:text-primary" onClick={() => abrirModelo(n)}>
                    {n}
                  </button>
                  <button type="button" aria-label={`Apagar o modelo ${n}`} className="rounded-r-full py-1.5 pl-1 pr-2 text-muted-foreground hover:text-destructive" onClick={() => apagarModelo(n)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={nomeModelo}
              onChange={(e) => setNomeModelo(e.target.value)}
              placeholder="Nome do modelo (ex.: Escola Alfa)"
              className="h-10 min-w-0 flex-1 rounded-full bg-background px-4 text-sm ring-1 ring-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <Button className="rounded-full" onClick={() => void salvarModelo()} disabled={!nomeModelo.trim()}>
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Guarda posições, cores, forma da foto e as artes (a arte em PDF fica como imagem). A lista de pessoas e as fotos não ficam salvas.</p>
          {avisoModelo && <p className="text-xs text-muted-foreground">{avisoModelo}</p>}
        </Bloco>
      </Painel>
    </>
  );

  const direita = (
    <>
      <Painel className="space-y-4">
        <Segmentado
          valor={aba}
          opcoes={[
            { valor: "frente" as const, rotulo: "Frente" },
            { valor: "verso" as const, rotulo: "Verso" },
            { valor: "prova" as const, rotulo: "Prova em A4" },
          ]}
          onChange={(v) => setAba(v)}
        />
        {aba === "frente" && (
          <CrachaPrevia
            bytes={previa}
            cfg={cfgPdf}
            selecionado={sel}
            onMover={(e, p) => setElemento(e, p)}
            ocupado={gerando}
            nome={atual?.nome ?? ""}
            indice={Math.min(idx, Math.max(0, incluidas.length - 1))}
            total={incluidas.length}
            onIndice={setIdx}
            mostrarFuro={cfg.mostrarFuro}
          />
        )}
        {aba === "verso" && <PreviaPdf bytes={versoBytes} paginas={1} vazio="O verso aparece aqui" />}
        {aba === "prova" && <PreviaPdf bytes={provaBytes} paginas={provaBytes ? 1 : 0} ocupado={gerando} vazio={incluidas.length ? "Montando a folha de prova…" : "Cole a lista para ver a prova"} />}
        {aba === "prova" && <p className="text-xs text-muted-foreground">Folha A4 com vários cartões e marcas de corte, para o cliente aprovar em papel comum antes de gastar cartão PVC e fita.</p>}
      </Painel>

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
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </Painel>

      <Painel className="space-y-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Como imprimir na Fargo C50</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>Abra o PDF e imprima no driver da Fargo, com o <span className="font-medium text-foreground">tamanho de papel CR80</span>, tamanho real (100%) e sem ajustar à página.</li>
          <li>Imprima primeiro o <span className="font-medium text-foreground">cartão de teste</span> e um cartão do lote antes de rodar tudo.</li>
          <li>Para o verso, vire o cartão (veja a arte no bloco 3) e imprima o PDF dos versos.</li>
        </ol>
      </Painel>
    </>
  );

  const rodape = (
    <div className="flex flex-wrap items-center gap-2">
      <Button className="rounded-full" onClick={baixarPdf} disabled={!completo || gerando || !!acao}>
        {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Baixar PDF dos crachás ({incluidas.length})
      </Button>
      <Button variant="secondary" className="rounded-full" onClick={() => void baixarIndividuais()} disabled={!incluidas.length || !!acao}>
        {acao?.startsWith("zip") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {acao?.startsWith("zip") ? `Gerando ${acao.slice(4)}` : "Um PDF por pessoa (.zip)"}
      </Button>
      <Button variant="secondary" className="rounded-full" onClick={() => void baixarProva()} disabled={!completo || !!acao}>
        Prova em A4
      </Button>
    </div>
  );

  return (
    <>
      <DuasColunas esquerda={esquerda} direita={direita} rodape={rodape} />
      <CrachaFotoAjuste
        aberto={!!ajustandoPessoa}
        nome={ajustandoPessoa?.nome ?? ""}
        foto={ajustandoPessoa ? (fotoDe.get(ajustandoPessoa.id) ?? null) : null}
        forma={cfg.forma}
        ajuste={ajustando ? (ajustes[ajustando] ?? AJUSTE_PADRAO) : AJUSTE_PADRAO}
        onFechar={() => setAjustando(null)}
        onSalvar={(a) => {
          if (ajustando) setAjustes((prev) => ({ ...prev, [ajustando]: a }));
          setAjustando(null);
        }}
      />
    </>
  );
}
