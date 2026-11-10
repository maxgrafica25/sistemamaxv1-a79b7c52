// Pré-impressão → ferramenta "Livreto".
// PDF com as páginas na ordem de leitura → folhas na ordem certa para imprimir
// frente e verso, dobrar ao meio e grampear. Tudo no navegador.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PT_POR_CM } from "@/lib/preimpressao/margem";
import { FOLHAS_PADRAO, FOLHA_PADRAO, abrirArte, formatarCm, type ArteAberta } from "@/lib/preimpressao/folha";
import { gerarLivreto, type ConfigLivreto, type ResultadoLivreto } from "@/lib/preimpressao/livreto";
import { baixarBlob, converterEps } from "@/lib/preimpressao/navegador";
import { Campo, Chave, Dado, DuasColunas, Mini, NotaPrivacidade, Painel, PreviaPdf, SoltarArquivo } from "./ui";
import { numeroEntre, useConfigSalva } from "./uteis";

interface Config {
  /** Chave de FOLHAS_PADRAO ou "medida" = folha do tamanho do livreto aberto. */
  folha: string;
  sangria: string;
  marcas: boolean;
  ajustar: boolean;
}

const PADRAO: Config = { folha: FOLHA_PADRAO, sangria: "0", marcas: true, ajustar: false };
const FOLHAS = [...FOLHAS_PADRAO.map((f) => ({ key: f.key, rotulo: f.rotulo, detalhe: f.detalhe })), { key: "medida", rotulo: "Sob medida", detalhe: undefined }];

export default function Livreto() {
  const [config, set] = useConfigSalva("preimpressao.livreto.config.v1", PADRAO);
  const [arte, setArte] = useState<ArteAberta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroArte, setErroArte] = useState<string | null>(null);
  const [saida, setSaida] = useState<ResultadoLivreto | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroGerar, setErroGerar] = useState<string | null>(null);

  const carregar = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      setCarregando(true);
      setErroArte(null);
      try {
        const a = await abrirArte(new Uint8Array(await f.arrayBuffer()), f.name, converterEps);
        set("sangria", a.sangriaPdf !== null ? String(a.sangriaPdf).replace(".", ",") : "0");
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
  const folha = FOLHAS_PADRAO.find((f) => f.key === config.folha) ?? null;
  const cfg: ConfigLivreto | null = useMemo(
    () =>
      sangria === null
        ? null
        : {
            folhaW: folha ? folha.wCm * PT_POR_CM : null,
            folhaH: folha ? folha.hCm * PT_POR_CM : null,
            sangriaMm: sangria,
            marcas: config.marcas,
            ajustar: config.ajustar,
          },
    [sangria, folha, config.marcas, config.ajustar],
  );

  useEffect(() => {
    setErroGerar(null);
    if (!arte || !cfg) {
      setSaida(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(async () => {
      try {
        const r = await gerarLivreto(arte.emPe, cfg);
        if (vivo) setSaida(r);
      } catch (e) {
        if (vivo) {
          setSaida(null);
          setErroGerar(e instanceof Error ? e.message : "Erro ao montar o livreto.");
        }
      } finally {
        if (vivo) setGerando(false);
      }
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [arte, cfg]);

  return (
    <DuasColunas
      esquerda={
        <Painel className="space-y-6">
          <Campo titulo="Envie o PDF">
            <SoltarArquivo
              titulo="Solte o PDF do livreto"
              dica="Páginas na ordem de leitura (1, 2, 3…), uma por página."
              arquivo={arte ? { nome: arte.nome, detalhe: `${formatarCm(arte.w, arte.h)} · ${arte.paginas} ${arte.paginas === 1 ? "página" : "páginas"}` } : null}
              carregando={carregando}
              erro={erroArte}
              onArquivos={(f) => void carregar(f)}
            />
          </Campo>

          <Campo
            titulo="Folha de impressão"
            ajuda={config.folha === "medida" ? "A folha sai do tamanho exato do livreto aberto." : "O livreto aberto fica centralizado na folha, com marcas de corte e de dobra."}
          >
            <div className="flex flex-wrap gap-2">
              {FOLHAS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={config.folha === f.key}
                  onClick={() => set("folha", f.key)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    config.folha === f.key ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.rotulo}
                  {f.detalhe && <span className="ml-1 text-xs opacity-70">{f.detalhe}</span>}
                </button>
              ))}
            </div>
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Mini
              rotulo="Sangria das páginas (mm)"
              valor={config.sangria}
              onChange={(v) => set("sangria", v)}
              erro={sangria === null ? "0 a 20 mm" : undefined}
              ajuda={arte?.sangriaPdf != null ? "Lida do PDF" : "0 se o PDF não tem sangria"}
            />
          </div>

          <Chave ligado={config.marcas} onChange={(v) => set("marcas", v)}>
            <span className="font-medium">Marcas de corte e de dobra</span>
            <span className="block text-xs text-muted-foreground">Cantos do livreto aberto e tracejado no meio, onde dobrar.</span>
          </Chave>
          {config.folha !== "medida" && (
            <Chave ligado={config.ajustar} onChange={(v) => set("ajustar", v)}>
              <span className="font-medium">Ajustar para caber</span>
              <span className="block text-xs text-muted-foreground">Diminui o livreto se ele for maior que a folha. Desligado = tamanho real.</span>
            </Chave>
          )}
        </Painel>
      }
      direita={
        <>
          <Painel className="space-y-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Pré-visualização</h3>
              <p className="text-xs text-muted-foreground">{arte ? "Cada imagem é um lado de uma folha, como vai sair na impressora." : "Envie o PDF para ver as folhas montadas."}</p>
            </div>
            <PreviaPdf
              bytes={saida?.bytes ?? null}
              paginas={saida ? saida.lados.length : 0}
              ocupado={gerando}
              rotulos={(i) => `Folha ${Math.floor(i / 2) + 1} · ${i % 2 === 0 ? "frente" : "verso"}`}
            />
          </Painel>

          <Painel className="space-y-4">
            {arte && saida ? (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm xl:grid-cols-3">
                  <Dado rotulo="Páginas do livreto" valor={`${arte.paginas}${saida.emBranco ? ` + ${saida.emBranco} em branco` : ""}`} />
                  <Dado rotulo="Folhas (frente e verso)" valor={saida.folhas} />
                  <Dado rotulo="Tamanho fechado" valor={formatarCm(saida.fechado.w, saida.fechado.h)} />
                  <Dado rotulo="Tamanho aberto" valor={formatarCm(saida.fechado.w * 2, saida.fechado.h)} />
                  <Dado rotulo="Folha" valor={formatarCm(saida.folha.w, saida.folha.h)} />
                  {saida.escala < 1 && <Dado rotulo="Reduzido para" valor={`${Math.round(saida.escala * 100)}%`} />}
                </dl>
                <div className="space-y-2 rounded-2xl bg-muted/40 px-4 py-3 text-xs">
                  <p className="font-medium text-foreground">Ordem das páginas em cada folha (esquerda | direita):</p>
                  <ol className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums text-muted-foreground">
                    {saida.lados.slice(0, 12).map((l, i) => (
                      <li key={i}>
                        <span className="font-semibold text-foreground">
                          {l.folha}
                          {l.lado === "frente" ? "F" : "V"}
                        </span>{" "}
                        {l.esquerda ?? "—"} | {l.direita ?? "—"}
                      </li>
                    ))}
                    {saida.lados.length > 12 && <li>…</li>}
                  </ol>
                  <p className="text-muted-foreground">
                    Imprima frente e verso <span className="font-medium text-foreground">virando pela borda curta</span>, empilhe as folhas na ordem, dobre ao meio e grampeie.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {!arte ? "Envie o PDF para ver quantas folhas o livreto usa." : !cfg ? "Confira o campo marcado em vermelho." : (erroGerar ?? "Montando…")}
              </p>
            )}
            {saida && erroGerar && <p className="text-sm text-destructive">{erroGerar}</p>}
            <NotaPrivacidade />
          </Painel>
        </>
      }
      rodape={
        <Button
          size="lg"
          className="w-full rounded-full"
          disabled={!saida || gerando}
          onClick={() => saida && arte && baixarBlob(new Blob([saida.bytes], { type: "application/pdf" }), arte.nome.replace(/\.pdf$/i, "") + "_livreto.pdf")}
        >
          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar livreto montado (PDF)
        </Button>
      }
    />
  );
}
