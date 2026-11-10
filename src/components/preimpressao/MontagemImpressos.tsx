// Pré-impressão → ferramenta "Montagem de impressos".
// Uma arte em PDF (com sangria) → folha de impressão montada com quantas couberem,
// marcas de corte e verso alinhado. Tudo no navegador.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PT_POR_CM } from "@/lib/preimpressao/margem";
import {
  FOLHAS_PADRAO,
  FOLHA_PADRAO,
  PT_POR_MM,
  abrirArte,
  aproveitamento,
  formatarCm,
  tamanhoFinal,
  type ArteAberta,
} from "@/lib/preimpressao/folha";
import {
  encaixeMontagem,
  gerarMontagem,
  planejarDiferentes,
  planejarMontagem,
  type ConfigMontagem,
  type Conteudo,
  type Ordem,
  type Virada,
} from "@/lib/preimpressao/montagem";
import { baixarBlob } from "@/lib/preimpressao/navegador";
import {
  Campo,
  Chave,
  Dado,
  DuasColunas,
  Mini,
  NotaPrivacidade,
  Painel,
  PreviaPdf,
 
  Segmentado,
  SeletorFolha,
  SoltarArquivo,
} from "./ui";
import { numeroEntre, useConfigSalva } from "./uteis";

interface Config {
  folha: string;
  sangria: string;
  margem: string;
  espaco: string;
  marcasCorte: boolean;
  frenteVerso: boolean;
  virada: Virada;
  quantidade: string;
  /** "repetir" = a mesma arte enche a folha; "diferentes" = cada página do PDF é uma peça. */
  conteudo: Conteudo;
  ordem: Ordem;
}

// Padrão da Max: Formatão, sangria 3 mm, borda 0,6 mm, sangrias encostadas
const PADRAO: Config = {
  folha: FOLHA_PADRAO,
  sangria: "3",
  margem: "0,6",
  espaco: "0",
  marcasCorte: true,
  frenteVerso: true,
  virada: "lateral",
  quantidade: "1000",
  conteudo: "repetir",
  ordem: "folha",
};

export default function MontagemImpressos() {
  const [config, set] = useConfigSalva("preimpressao.montagem.config.v1", PADRAO);
  const [arte, setArte] = useState<ArteAberta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroArte, setErroArte] = useState<string | null>(null);
  const [saida, setSaida] = useState<{ bytes: Uint8Array; paginas: number } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroGerar, setErroGerar] = useState<string | null>(null);

  const carregar = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      setCarregando(true);
      setErroArte(null);
      try {
        const a = await abrirArte(new Uint8Array(await f.arrayBuffer()), f.name);
        if (a.sangriaPdf !== null) set("sangria", String(a.sangriaPdf).replace(".", ","));
        setArte(a);
      } catch (e) {
        setArte(null);
        setErroArte(e instanceof Error ? e.message : "Não consegui abrir o arquivo.");
      } finally {
        setCarregando(false);
      }
    },
    [set],
  );

  const sangria = numeroEntre(config.sangria, 0, 20);
  const margem = numeroEntre(config.margem, 0, 50);
  const espaco = numeroEntre(config.espaco, 0, 50);
  const quantidade = numeroEntre(config.quantidade, 1, 10_000_000, true);
  const folha = FOLHAS_PADRAO.find((f) => f.key === config.folha) ?? FOLHAS_PADRAO.find((f) => f.key === FOLHA_PADRAO)!;
  const temVerso = !!arte && arte.paginas >= 2;
  const diferentes = temVerso && config.conteudo === "diferentes";
  const frenteVerso = temVerso && config.frenteVerso;

  const cfg: ConfigMontagem | null = useMemo(
    () =>
      sangria === null || margem === null || espaco === null
        ? null
        : {
            folhaW: folha.wCm * PT_POR_CM,
            folhaH: folha.hCm * PT_POR_CM,
            margemMm: margem,
            espacoMm: espaco,
            sangriaMm: sangria,
            marcasCorte: config.marcasCorte,
            frenteVerso,
            virada: config.virada,
            conteudo: diferentes ? "diferentes" : "repetir",
            ordem: config.ordem,
          },
    [sangria, margem, espaco, folha, config.marcasCorte, config.virada, frenteVerso, diferentes, config.ordem],
  );

  const encaixe = useMemo(() => (arte && cfg ? encaixeMontagem(cfg, arte) : null), [arte, cfg]);
  const cabe = !!encaixe && encaixe.celulas.length > 0;
  const plano = !diferentes && cabe && arte && quantidade !== null ? planejarMontagem(encaixe.celulas.length, quantidade, arte.paginas, frenteVerso) : null;
  const planoDif = diferentes && cabe && arte ? planejarDiferentes(encaixe.celulas.length, arte.paginas, frenteVerso) : null;

  // A folha é leve de gerar: refaz sozinha a cada ajuste, depois de uma pausa
  useEffect(() => {
    setErroGerar(null);
    if (!arte || !cfg || !cabe) {
      setSaida(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(async () => {
      try {
        const r = await gerarMontagem(arte.emPe, cfg);
        if (vivo) setSaida({ bytes: r.bytes, paginas: r.paginasSaida });
      } catch (e) {
        if (vivo) {
          setSaida(null);
          setErroGerar(e instanceof Error ? e.message : "Erro ao montar a folha.");
        }
      } finally {
        if (vivo) setGerando(false);
      }
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [arte, cfg, cabe]);

  const sangriaPt = (sangria ?? 0) * PT_POR_MM;
  const final = arte ? tamanhoFinal(arte, sangriaPt) : null;

  return (
    <DuasColunas
      esquerda={
        <>
          <Painel className="space-y-6">
            <Campo titulo="Envie a arte">
              <SoltarArquivo
                titulo="Solte o PDF de uma arte"
                dica="Com sangria. Várias páginas: você escolhe se é frente e verso ou peças diferentes."
                arquivo={arte ? { nome: arte.nome, detalhe: `${formatarCm(arte.w, arte.h)} · ${arte.paginas} ${arte.paginas === 1 ? "página" : "páginas"}` } : null}
                carregando={carregando}
                erro={erroArte}
                onArquivos={(f) => void carregar(f)}
              />
            </Campo>

            <Campo titulo="Folha de impressão" ajuda="O sistema calcula quantas cabem e monta a folha sozinho.">
              <SeletorFolha valor={folha.key} onChange={(k) => set("folha", k)} />
            </Campo>

            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <Mini
                rotulo="Sangria da arte (mm)"
                valor={config.sangria}
                onChange={(v) => set("sangria", v)}
                erro={sangria === null ? "0 a 20 mm" : undefined}
                ajuda={arte?.sangriaPdf != null ? "Lida do PDF" : "Já incluída no PDF, por lado"}
              />
              <Mini rotulo="Borda da folha (mm)" valor={config.margem} onChange={(v) => set("margem", v)} erro={margem === null ? "0 a 50 mm" : undefined} ajuda="Da beirada até a sangria" />
              <Mini rotulo="Espaço entre artes (mm)" valor={config.espaco} onChange={(v) => set("espaco", v)} erro={espaco === null ? "0 a 50 mm" : undefined} ajuda="0 = sangrias encostadas" />
              {!diferentes && (
                <Mini rotulo="Quantidade (unidades)" valor={config.quantidade} onChange={(v) => set("quantidade", v)} erro={quantidade === null ? "Número inteiro" : undefined} ajuda="Para calcular as folhas" />
              )}
            </div>

            <Chave ligado={config.marcasCorte} onChange={(v) => set("marcasCorte", v)}>
              <span className="font-medium">Marcas de corte</span>
              <span className="block text-xs text-muted-foreground">Tracinhos na linha de corte, onde sobrar espaço na beirada da folha.</span>
            </Chave>
          </Painel>

          {temVerso && (
            <Painel className="space-y-6">
              <Campo
                titulo="O que tem no PDF"
                ajuda={diferentes ? "Cada página (ou par de páginas) ocupa um lugar da folha, sem repetir." : "A mesma arte se repete até encher a folha."}
              >
                <Segmentado
                  valor={config.conteudo}
                  opcoes={[
                    { valor: "repetir" as Conteudo, rotulo: "Mesma arte repetida" },
                    { valor: "diferentes" as Conteudo, rotulo: "Páginas diferentes" },
                  ]}
                  onChange={(v) => set("conteudo", v)}
                />
              </Campo>
              {diferentes && (
                <Campo
                  titulo="Ordem na folha"
                  ajuda={config.ordem === "folha" ? "Folha 1: páginas 1, 2, 3… Folha 2: as seguintes." : "Depois de cortar a pilha, cada monte já sai em sequência."}
                >
                  <Segmentado
                    valor={config.ordem}
                    opcoes={[
                      { valor: "folha" as Ordem, rotulo: "Em sequência" },
                      { valor: "empilha" as Ordem, rotulo: "Corte e empilha" },
                    ]}
                    onChange={(v) => set("ordem", v)}
                  />
                </Campo>
              )}
              <Chave ligado={config.frenteVerso} onChange={(v) => set("frenteVerso", v)}>
                <span className="font-medium">Frente e verso</span>
                <span className="block text-xs text-muted-foreground">
                  {config.frenteVerso
                    ? diferentes
                      ? "Páginas em pares: 1ª = frente, 2ª = verso de cada peça."
                      : "Página 1 = frente, página 2 = verso (e assim por diante)."
                    : diferentes
                      ? "Desligado: cada página é uma peça só frente."
                      : "Desligado: cada página do PDF é um modelo diferente, só frente."}
                </span>
              </Chave>
              {config.frenteVerso && (
                <Campo
                  titulo="Como a folha vira na impressora"
                  ajuda={config.virada === "lateral" ? "Como página de livro: o lado esquerdo vai para a direita." : "De baixo para cima, como bloco de calendário."}
                >
                  <Segmentado
                    valor={config.virada}
                    opcoes={[
                      { valor: "lateral" as Virada, rotulo: "Pelos lados" },
                      { valor: "vertical" as Virada, rotulo: "De baixo para cima" },
                    ]}
                    onChange={(v) => set("virada", v)}
                  />
                </Campo>
              )}
            </Painel>
          )}
        </>
      }
      direita={
        <>
          <Painel className="space-y-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Pré-visualização</h3>
              <p className="text-xs text-muted-foreground">{arte ? "É exatamente a folha que vai ser baixada." : "Envie a arte para ver a folha montada."}</p>
            </div>
            <PreviaPdf
              bytes={saida?.bytes ?? null}
              paginas={saida?.paginas ?? 0}
              ocupado={gerando}
              rotulos={frenteVerso ? (i) => (i % 2 === 0 ? "Frente" : "Verso") : undefined}
              vazio={arte && !cabe ? "A arte não cabe nesta folha" : "A pré-visualização aparece aqui"}
            />
          </Painel>

          <Painel className="space-y-4">
            {arte && cfg && encaixe && cabe && final ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm xl:grid-cols-3">
                <Dado rotulo="Artes por folha" valor={`${encaixe.celulas.length} (${encaixe.colunas} × ${encaixe.linhas})`} />
                <Dado rotulo="Aproveitamento da folha" valor={`${Math.round(aproveitamento(encaixe, sangriaPt) * 100)}%`} />
                <Dado rotulo="Tamanho final" valor={formatarCm(final.w, final.h)} />
                <Dado rotulo="Folha" valor={`${formatarCm(encaixe.folhaW, encaixe.folhaH)}${encaixe.celulas[0].rot ? " · arte deitada" : ""}`} />
                {planoDif && (
                  <>
                    <Dado rotulo="Peças no PDF" valor={planoDif.pecas.toLocaleString("pt-BR")} />
                    <Dado rotulo="Folhas a imprimir" valor={`${planoDif.folhas.toLocaleString("pt-BR")}${frenteVerso ? " (frente e verso)" : ""}`} />
                    <Dado rotulo="Lugares em branco" valor={planoDif.vazias.toLocaleString("pt-BR")} />
                  </>
                )}
                {plano && (
                  <>
                    <Dado
                      rotulo={plano.modelos > 1 ? "Folhas por modelo" : "Folhas a imprimir"}
                      valor={`${plano.folhasPorModelo.toLocaleString("pt-BR")}${frenteVerso ? " (frente e verso)" : ""}`}
                    />
                    <Dado rotulo="Sobra" valor={`${plano.sobra.toLocaleString("pt-BR")} un.`} />
                    {plano.modelos > 1 && <Dado rotulo="Modelos no PDF" valor={plano.modelos} />}
                  </>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                {!arte
                  ? "Envie a arte para ver quantas cabem na folha."
                  : !cfg
                    ? "Confira os campos marcados em vermelho."
                    : "A arte não cabe na folha escolhida. Escolha uma folha maior ou diminua a borda."}
              </p>
            )}
            {erroGerar && <p className="text-sm text-destructive">{erroGerar}</p>}
            <NotaPrivacidade />
          </Painel>
        </>
      }
      rodape={
        <Button
          size="lg"
          className="w-full rounded-full"
          disabled={!saida || gerando}
          onClick={() => saida && arte && baixarBlob(new Blob([saida.bytes], { type: "application/pdf" }), arte.nome.replace(/\.pdf$/i, "") + "_montado.pdf")}
        >
          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar folha montada (PDF)
        </Button>
      }
    />
  );
}
