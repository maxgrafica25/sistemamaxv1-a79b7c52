// Crachás → "Arte pronta".
// A arte já vem pronta (do cliente, do Canva ou do Corel, em PDF, PNG ou JPG): o sistema só coloca no
// tamanho do cartão CR80 da Fargo C50, confere, repete as cópias e gera o PDF da frente e o do verso.
// Vários arquivos = um cartão para cada um; um PDF de várias páginas = um cartão por página.
// Tudo no navegador, sem custo.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Download, Loader2, Minus, Plus, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gerarCartaoDeTeste, gerarProva, type Orientacao } from "@/lib/preimpressao/cracha";
import { lerArtePronta } from "@/lib/preimpressao/crachaNavegador";
import { MAX_COPIAS_PRONTA, conferirProntas, gerarProntas, listarCartoes, orientacaoSugerida, type ArtePronta, type EncaixePronta, type ModoVerso, type ProntasGeradas } from "@/lib/preimpressao/crachaPronta";
import { baixarBlob } from "@/lib/preimpressao/navegador";
import { CrachaVersoGuia } from "./CrachaVersoGuia";
import { Campo, Chave, DuasColunas, NotaPrivacidade, Painel, PreviaPdf, SeletorCor, Segmentado, SoltarArquivo } from "./ui";
import { useConfigSalva } from "./uteis";

interface ConfigPronta {
  orientacao: "auto" | Orientacao;
  encaixe: EncaixePronta;
  corFundo: string;
  modoVerso: ModoVerso;
  girarVerso: boolean;
}

const PADRAO: ConfigPronta = { orientacao: "auto", encaixe: "preencher", corFundo: "#ffffff", modoVerso: "nenhum", girarVerso: false };

const FUNDOS = [
  { nome: "Branco", hex: "#ffffff" },
  { nome: "Cinza claro", hex: "#f1f5f9" },
  { nome: "Preto", hex: "#111827" },
  { nome: "Azul escuro", hex: "#0f2a5c" },
];

export function CrachaProntaTela() {
  const [cfg, set] = useConfigSalva<ConfigPronta>("preimpressao.cracha.pronta.v1", PADRAO);
  const [artes, setArtes] = useState<ArtePronta[]>([]);
  const [versoArte, setVersoArte] = useState<ArtePronta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [aba, setAba] = useState<"frente" | "verso" | "prova">("frente");
  const [pdf, setPdf] = useState<ProntasGeradas | null>(null);
  const [prova, setProva] = useState<Uint8Array | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);
  const [acao, setAcao] = useState<string | null>(null);

  const orientacao: Orientacao = cfg.orientacao === "auto" ? orientacaoSugerida(artes[0]?.aspecto ?? 0.63) : cfg.orientacao;
  const entrada = useMemo(
    () => ({ orientacao, encaixe: cfg.encaixe, corFundo: cfg.corFundo, artes, modoVerso: cfg.modoVerso, versoArte, girarVerso: cfg.girarVerso }),
    [orientacao, cfg.encaixe, cfg.corFundo, artes, cfg.modoVerso, versoArte, cfg.girarVerso],
  );
  const { cartoes } = useMemo(() => listarCartoes(artes, cfg.modoVerso), [artes, cfg.modoVerso]);
  const conferencia = useMemo(() => conferirProntas(entrada), [entrada]);

  const receber = async (files: File[], verso: boolean) => {
    setLendo(true);
    const novas: ArtePronta[] = [];
    let mensagem: string | null = null;
    for (const f of files) {
      try {
        novas.push(await lerArtePronta(f));
      } catch (e) {
        mensagem = e instanceof Error ? e.message : "Não consegui abrir o arquivo.";
      }
    }
    setLendo(false);
    setErro(mensagem);
    if (!novas.length) return;
    if (verso) setVersoArte(novas[0]);
    else {
      setArtes((p) => [...p, ...novas]);
      if (cfg.modoVerso === "nenhum" && novas.some((a) => a.paginas === 2) && files.length === 1) setErro("Esse PDF tem 2 páginas. Se a 2ª é o verso, escolha “Frente e verso alternados” em Verso.");
    }
  };

  useEffect(() => {
    if (!artes.length) {
      setPdf(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(() => {
      gerarProntas(entrada)
        .then((r) => {
          if (!vivo) return;
          setPdf(r);
          setErroPdf(null);
        })
        .catch((e) => vivo && setErroPdf(e instanceof Error ? e.message : "Não foi possível montar os crachás."))
        .finally(() => vivo && setGerando(false));
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [entrada, artes.length]);

  useEffect(() => {
    if (aba !== "prova" || !pdf) return;
    let vivo = true;
    gerarProva(pdf.frente, orientacao)
      .then((b) => vivo && setProva(b))
      .catch(() => vivo && setProva(null));
    return () => {
      vivo = false;
    };
  }, [aba, pdf, orientacao]);

  const executar = async (nome: string, fn: () => Promise<void>) => {
    setAcao(nome);
    try {
      await fn();
    } catch (e) {
      setErroPdf(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setAcao(null);
    }
  };

  const mudarCopias = (id: string, v: number) => setArtes((p) => p.map((a) => (a.id === id ? { ...a, copias: Math.min(MAX_COPIAS_PRONTA, Math.max(1, v)) } : a)));

  const esquerda = (
    <Painel className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Arte pronta</h2>
        <p className="text-sm text-muted-foreground">A arte já está pronta (do cliente, do Canva ou do Corel). O sistema coloca no tamanho do cartão e prepara para a Fargo C50.</p>
      </div>
      <NotaPrivacidade />

      <Campo titulo="1. Arte do crachá" ajuda="Vários arquivos: um cartão para cada. PDF com várias páginas: um cartão por página. No Canva, baixe em PDF para impressão ou PNG; no Corel, exporte em PDF.">
        <SoltarArquivo
          titulo="Solte a arte aqui"
          dica="PDF, PNG ou JPG — pode soltar vários"
          arquivo={artes.length ? { nome: `${artes.length} arquivo(s)`, detalhe: `${cartoes.length} cartão(ões)` } : null}
          aceita=".pdf,application/pdf,.png,.jpg,.jpeg,image/png,image/jpeg"
          multiplo
          carregando={lendo}
          erro={erro}
          onArquivos={(f) => void receber(f, false)}
        />
        {artes.length > 0 && (
          <div className="mt-3 space-y-2">
            {artes.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-background p-3 ring-1 ring-border/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={a.nome}>
                    {a.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.tipo === "pdf" ? `PDF · ${a.paginas} página${a.paginas > 1 ? "s" : ""}` : `${a.px?.w} × ${a.px?.h} px`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Menos uma cópia" className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/70 hover:bg-muted" onClick={() => mudarCopias(a.id, a.copias - 1)}>
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-16 text-center text-sm font-semibold tabular-nums">
                    {a.copias} cópia{a.copias > 1 ? "s" : ""}
                  </span>
                  <button type="button" aria-label="Mais uma cópia" className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/70 hover:bg-muted" onClick={() => mudarCopias(a.id, a.copias + 1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button type="button" aria-label={`Tirar ${a.nome}`} className="text-muted-foreground hover:text-destructive" onClick={() => setArtes((p) => p.filter((x) => x.id !== a.id))}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setArtes([])}>
              Tirar todas
            </Button>
          </div>
        )}
      </Campo>

      <Campo titulo="2. Verso" ajuda="A Fargo C50 imprime um lado por vez: o verso sai em um PDF separado, na mesma ordem das frentes.">
        <div className="space-y-3">
          <Segmentado
            valor={cfg.modoVerso}
            opcoes={[
              { valor: "nenhum" as ModoVerso, rotulo: "Sem verso" },
              { valor: "igual" as ModoVerso, rotulo: "Mesmo verso" },
              { valor: "alternado" as ModoVerso, rotulo: "No PDF" },
            ]}
            onChange={(v: ModoVerso) => set("modoVerso", v)}
          />
          {cfg.modoVerso === "alternado" && <p className="text-xs text-muted-foreground">Frente e verso no mesmo PDF: a frente na página 1, o verso na 2, a frente do próximo na 3, e assim por diante.</p>}
          {cfg.modoVerso === "igual" && <p className="text-xs text-muted-foreground">O mesmo verso para todos os cartões (você solta a arte do verso abaixo).</p>}
          {cfg.modoVerso === "igual" && (
            <>
              <SoltarArquivo
                titulo="Solte a arte do verso"
                dica="PDF, PNG ou JPG"
                arquivo={versoArte ? { nome: versoArte.nome, detalhe: versoArte.tipo === "pdf" ? "PDF" : `${versoArte.px?.w} × ${versoArte.px?.h} px` } : null}
                aceita=".pdf,application/pdf,.png,.jpg,.jpeg,image/png,image/jpeg"
                onArquivos={(f) => void receber(f.slice(0, 1), true)}
              />
              {versoArte && (
                <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setVersoArte(null)}>
                  Tirar a arte do verso
                </Button>
              )}
            </>
          )}
          {cfg.modoVerso !== "nenhum" && (
            <>
              <Chave ligado={cfg.girarVerso} onChange={(v) => set("girarVerso", v)}>
                <span className="font-medium">Girar o verso 180°</span>
                <span className="block text-xs text-muted-foreground">Ligue se, no teste, o verso sair de cabeça para baixo em relação à frente.</span>
              </Chave>
              <CrachaVersoGuia />
            </>
          )}
        </div>
      </Campo>

      <Campo titulo="3. Tamanho no cartão" ajuda="Se a arte tem a mesma proporção do cartão (85,6 × 54 mm), nada é cortado. Se for diferente, escolha o que fazer.">
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Posição do cartão</p>
            <Segmentado
              valor={cfg.orientacao}
              opcoes={[
                { valor: "auto" as const, rotulo: "Automática" },
                { valor: "pe" as const, rotulo: "Em pé" },
                { valor: "deitado" as const, rotulo: "Deitado" },
              ]}
              onChange={(v) => set("orientacao", v)}
            />
            {cfg.orientacao === "auto" && artes.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Pela arte, o cartão fica {orientacao === "pe" ? "em pé" : "deitado"}.</p>}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Quando a proporção é diferente</p>
            <Segmentado
              valor={cfg.encaixe}
              opcoes={[
                { valor: "preencher" as EncaixePronta, rotulo: "Cobrir o cartão (corta)" },
                { valor: "inteira" as EncaixePronta, rotulo: "Arte inteira (bordas)" },
              ]}
              onChange={(v: EncaixePronta) => set("encaixe", v)}
            />
          </div>
          {cfg.encaixe === "inteira" && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Cor das bordas</p>
              <SeletorCor valor={cfg.corFundo} sugestoes={FUNDOS} onChange={(v) => set("corFundo", v)} />
            </div>
          )}
        </div>
      </Campo>
    </Painel>
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
        {aba === "frente" && <PreviaPdf bytes={pdf?.frente ?? null} paginas={pdf?.paginas ?? 0} rotulos={(n) => `Cartão ${n + 1}`} ocupado={gerando} vazio="Solte a arte para ver o cartão" />}
        {aba === "verso" && <PreviaPdf bytes={pdf?.verso ?? null} paginas={pdf?.verso ? pdf.paginas : 0} rotulos={(n) => `Verso ${n + 1}`} ocupado={gerando} vazio="Escolha o verso (passo 2) para ver aqui" />}
        {aba === "prova" && <PreviaPdf bytes={prova} paginas={prova ? 1 : 0} ocupado={gerando} vazio={artes.length ? "Montando a folha de prova…" : "Solte a arte para ver a prova"} />}
        {aba === "prova" && <p className="text-xs text-muted-foreground">Folha A4 com vários cartões e marcas de corte, para o cliente aprovar em papel comum antes de gastar cartão PVC e fita.</p>}
      </Painel>

      <Painel className="space-y-3">
        <p className="text-sm font-medium">Conferência</p>
        <ul className="space-y-1.5">
          {[...conferencia, ...(pdf?.avisos.map((t) => ({ nivel: "atencao" as const, texto: t })) ?? [])].map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              {c.nivel === "ok" ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : c.nivel === "atencao" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}
              <span className={c.nivel === "ok" ? "text-muted-foreground" : "text-foreground"}>{c.texto}</span>
            </li>
          ))}
        </ul>
        {erroPdf && <p className="text-xs text-destructive">{erroPdf}</p>}
      </Painel>

      <Painel className="space-y-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Como imprimir na Fargo C50</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>Abra o PDF e imprima no driver da Fargo, com o <span className="font-medium text-foreground">tamanho de papel CR80</span>, tamanho real (100%) e sem ajustar à página.</li>
          <li>Imprima primeiro o <span className="font-medium text-foreground">cartão de teste</span> e um cartão do lote antes de rodar tudo.</li>
        </ol>
      </Painel>
    </>
  );

  const rodape = (
    <div className="flex flex-wrap items-center gap-2">
      <Button className="rounded-full" onClick={() => pdf && baixarBlob(new Blob([pdf.frente], { type: "application/pdf" }), "Crachas.pdf")} disabled={!pdf || !pdf.paginas || gerando || !!acao}>
        {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Baixar PDF dos crachás ({pdf?.paginas ?? 0})
      </Button>
      {pdf?.verso && (
        <Button variant="secondary" className="rounded-full" onClick={() => baixarBlob(new Blob([pdf.verso as Uint8Array], { type: "application/pdf" }), "Versos_dos_crachas.pdf")}>
          Baixar versos ({pdf.paginas})
        </Button>
      )}
      <Button
        variant="secondary"
        className="rounded-full"
        onClick={() =>
          void executar("prova", async () => {
            const b = prova ?? (pdf ? await gerarProva(pdf.frente, orientacao) : null);
            if (b) baixarBlob(new Blob([b], { type: "application/pdf" }), "Prova_dos_crachas.pdf");
          })
        }
        disabled={!pdf || !pdf.paginas || !!acao}
      >
        Prova em A4
      </Button>
      <Button variant="ghost" className="rounded-full" onClick={() => void executar("teste", async () => baixarBlob(new Blob([await gerarCartaoDeTeste(orientacao, cfg.girarVerso)], { type: "application/pdf" }), "Cartao_de_teste_Fargo.pdf"))} disabled={!!acao}>
        Cartão de teste
      </Button>
    </div>
  );

  return <DuasColunas esquerda={esquerda} direita={direita} rodape={rodape} />;
}
