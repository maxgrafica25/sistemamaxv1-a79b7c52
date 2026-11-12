// Pré-impressão → ferramenta "Miolo de agenda".
// Gera o miolo de uma agenda anual (A5, ou A4 com 2 miolos por folha) no padrão que a gráfica imprime,
// com feriados nacionais sempre e feriados regionais acrescentados pela pessoa. Tudo no navegador, sem custo.

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MESES, MESES_CURTOS, gerarMiolo, miolosEmA4, type Feriado, type Miolo } from "@/lib/preimpressao/agenda";
import { baixarBlob } from "@/lib/preimpressao/navegador";
import { Campo, Dado, DuasColunas, Mini, NotaPrivacidade, Painel, Passo, PreviaPdf, Segmentado } from "./ui";
import { numeroEntre, useConfigSalva } from "./uteis";

type Saida = "a5" | "a4";

interface Config {
  ano: number;
  capa: string;
  regionais: Feriado[];
  total: string;
  saida: Saida;
}

/** Ano da próxima agenda: a partir de setembro já se prepara o ano seguinte. */
function anoPadrao() {
  const h = new Date();
  return h.getFullYear() + (h.getMonth() >= 8 ? 1 : 0);
}

const PADRAO: Config = { ano: anoPadrao(), capa: "AGENDA", regionais: [], total: "", saida: "a5" };

const SUGESTOES: Feriado[] = [{ dia: 20, mes: 9, nome: "Revolução Farroupilha (RS)" }];
const MAX_REGIONAIS = 12;

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** "20/09" → { dia, mes }; null se não for uma data. */
function lerDiaMes(t: string): { dia: number; mes: number } | null {
  const m = /^\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*$/.exec(t);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > new Date(Date.UTC(2024, mes, 0)).getUTCDate()) return null;
  return { dia, mes };
}

export default function MioloAgenda() {
  const [config, set] = useConfigSalva("preimpressao.agenda.config.v1", PADRAO);
  const [miolo, setMiolo] = useState<Miolo | null>(null);
  const [saidaA4, setSaidaA4] = useState<Uint8Array | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [novaData, setNovaData] = useState("");
  const [novoNome, setNovoNome] = useState("");

  const ano = numeroEntre(String(config.ano), 2000, 2200, true);
  const total = config.total.trim() === "" ? null : numeroEntre(config.total, 2, 2000, true);
  const totalInvalido = config.total.trim() !== "" && total === null;
  const dataLida = lerDiaMes(novaData);
  const nomeOk = novoNome.trim().length > 0;

  // Dados que mudam o PDF: o texto de "regionais" vira chave para não refazer à toa
  const chave = JSON.stringify([ano, config.capa, config.regionais, total]);

  useEffect(() => {
    setErro(null);
    if (ano === null || totalInvalido) {
      setMiolo(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(async () => {
      try {
        const m = await gerarMiolo({ ano, capa: config.capa.trim() || "AGENDA", regionais: config.regionais, total });
        if (vivo) setMiolo(m);
      } catch (e) {
        if (vivo) {
          setMiolo(null);
          setErro(e instanceof Error ? e.message : "Não consegui gerar o miolo.");
        }
      } finally {
        if (vivo) setGerando(false);
      }
    }, 500);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  // A4 com 2 miolos por folha: derivado do A5 (só quando escolhido)
  useEffect(() => {
    setSaidaA4(null);
    if (!miolo || config.saida !== "a4") return;
    let vivo = true;
    miolosEmA4(miolo.bytes)
      .then((b) => vivo && setSaidaA4(b))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não consegui montar o A4."));
    return () => {
      vivo = false;
    };
  }, [miolo, config.saida]);

  const bytes = config.saida === "a4" ? saidaA4 : (miolo?.bytes ?? null);
  const paginas = miolo?.plano.paginas.length ?? 0;
  const atual = Math.min(pagina, Math.max(0, paginas - 1));

  const atalhos = useMemo(() => {
    if (!miolo) return [];
    return [
      { rotulo: "Capa", pagina: 0 },
      { rotulo: "Dados", pagina: 2 },
      { rotulo: "Calendário", pagina: 3 },
      ...miolo.plano.paginaDoMes.map((p, i) => ({ rotulo: MESES_CURTOS[i], pagina: p })),
    ];
  }, [miolo]);

  const adicionar = (f: Feriado) => {
    if (config.regionais.length >= MAX_REGIONAIS) return;
    if (config.regionais.some((x) => x.dia === f.dia && x.mes === f.mes && x.nome === f.nome)) return;
    set("regionais", [...config.regionais, f].sort((a, b) => a.mes - b.mes || a.dia - b.dia));
  };

  const sugestoesLivres = SUGESTOES.filter((s) => !config.regionais.some((x) => x.dia === s.dia && x.mes === s.mes));

  return (
    <DuasColunas
      esquerda={
        <Painel className="space-y-6">
          <Campo titulo="Ano da agenda">
            <Passo valor={String(config.ano)} onChange={(v) => set("ano", Number.parseInt(v, 10) || config.ano)} passo={1} min={2000} max={2200} rotulo="ano" invalido={ano === null} largura="w-20" />
          </Campo>

          <Campo titulo="Palavra da capa" ajuda="Aparece na borda da capa, junto com o ano.">
            <Mini rotulo="Texto" valor={config.capa} onChange={(v) => set("capa", v.slice(0, 12))} texto ajuda="Até 12 letras. Padrão: AGENDA" />
          </Campo>

          <Campo titulo="Feriados" ajuda="Os feriados nacionais, o Carnaval, a Sexta-feira Santa, a Páscoa e o Corpus Christi entram sempre, já com as datas do ano. Acrescente os da sua região ou cidade abaixo.">
            {config.regionais.length > 0 && (
              <ul className="mb-3 space-y-2">
                {config.regionais.map((f) => (
                  <li key={`${f.mes}-${f.dia}-${f.nome}`} className="flex items-center gap-2 rounded-2xl bg-muted/40 px-3 py-2 text-sm">
                    <span className="tabular-nums text-muted-foreground">
                      {doisDigitos(f.dia)} {MESES_CURTOS[f.mes - 1]}
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={f.nome}>
                      {f.nome}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remover ${f.nome}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => set("regionais", config.regionais.filter((x) => x !== f))}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {config.regionais.length < MAX_REGIONAIS ? (
              <div className="space-y-3">
                <div className="grid grid-cols-[6.5rem_1fr] gap-x-3">
                  <Mini rotulo="Dia/mês" valor={novaData} onChange={setNovaData} texto erro={novaData && !dataLida ? "Ex.: 20/09" : undefined} />
                  <Mini rotulo="Nome do feriado" valor={novoNome} onChange={(v) => setNovoNome(v.slice(0, 28))} texto />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  disabled={!dataLida || !nomeOk}
                  onClick={() => {
                    if (!dataLida) return;
                    adicionar({ ...dataLida, nome: novoNome.trim() });
                    setNovaData("");
                    setNovoNome("");
                  }}
                >
                  <Plus className="h-4 w-4" /> Adicionar feriado
                </Button>
                {sugestoesLivres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {sugestoesLivres.map((s) => (
                      <button
                        key={`${s.mes}-${s.dia}`}
                        type="button"
                        onClick={() => adicionar(s)}
                        className="rounded-full bg-muted/70 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        + {doisDigitos(s.dia)}/{doisDigitos(s.mes)} {s.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Máximo de {MAX_REGIONAIS} feriados acrescentados.</p>
            )}
          </Campo>

          <Campo titulo="Total de páginas" ajuda={miolo ? `O miolo precisa de ${miolo.plano.minimo} páginas. Se você pedir mais, o resto vira páginas de anotações no final.` : "Deixe vazio para só o necessário."}>
            <Mini rotulo="Número de páginas (opcional)" valor={config.total} onChange={(v) => set("total", v)} erro={totalInvalido ? "Número inteiro" : undefined} />
            <div className="mt-2 flex flex-wrap gap-2">
              {[{ r: "Só o necessário", v: "" }, { r: "350", v: "350" }, { r: "382", v: "382" }].map((c) => (
                <button
                  key={c.r}
                  type="button"
                  onClick={() => set("total", c.v)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    config.total === c.v ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.r}
                </button>
              ))}
            </div>
          </Campo>

          <Campo titulo="Arquivo para imprimir" ajuda={config.saida === "a5" ? "Um miolo por folha A5. Imprima com a folha já cortada em A5." : "Dois miolos por folha A4 deitada: depois de imprimir, corte ao meio na guilhotina."}>
            <Segmentado
              valor={config.saida}
              opcoes={[
                { valor: "a5" as Saida, rotulo: "A5" },
                { valor: "a4" as Saida, rotulo: "A4 · 2 por folha" },
              ]}
              onChange={(v) => set("saida", v)}
            />
          </Campo>
        </Painel>
      }
      direita={
        <>
          <Painel className="space-y-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Pré-visualização</h3>
              <p className="text-xs text-muted-foreground">É o PDF que vai ser baixado. Use as setas ou os atalhos para passear pelo miolo.</p>
            </div>
            {atalhos.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {atalhos.map((a) => (
                  <button
                    key={a.rotulo}
                    type="button"
                    onClick={() => setPagina(a.pagina)}
                    className="rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {a.rotulo}
                  </button>
                ))}
              </div>
            )}
            <PreviaPdf bytes={bytes} paginas={paginas} ocupado={gerando} pagina={atual} onPagina={setPagina} vazio={gerando ? "Montando o miolo…" : "Confira os campos marcados em vermelho"} />
          </Painel>

          <Painel className="space-y-4">
            {miolo ? (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm xl:grid-cols-3">
                  <Dado rotulo="Páginas" valor={miolo.plano.paginas.length.toLocaleString("pt-BR")} />
                  <Dado rotulo={config.saida === "a5" ? "Folhas A5 (frente e verso)" : "Folhas A4 (frente e verso)"} valor={(miolo.plano.paginas.length / 2).toLocaleString("pt-BR")} />
                  <Dado rotulo="Feriados no ano" valor={miolo.feriados.length} />
                </dl>
                {config.saida === "a4" && <p className="text-xs text-muted-foreground">Cada folha A4 rende 2 miolos.</p>}
                <div className="space-y-2 rounded-2xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Como imprimir</p>
                  {config.saida === "a5" ? (
                    <p>Papel já cortado em A5. Impressão em frente e verso (duplex), página em pé, <span className="font-medium text-foreground">virando pela borda longa</span>.</p>
                  ) : (
                    <p>Papel A4. Impressão em frente e verso (duplex), página deitada, <span className="font-medium text-foreground">virando pela borda curta</span>. Depois, corte ao meio na guilhotina: saem 2 miolos.</p>
                  )}
                  <p>Imprima em <span className="font-medium text-foreground">tamanho real</span> (não ajuste o formato). Sem duplex: imprima as páginas ímpares e depois as pares; teste com poucas páginas.</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{gerando ? "Montando o miolo…" : "Confira os campos marcados em vermelho."}</p>
            )}
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <NotaPrivacidade />
          </Painel>
        </>
      }
      rodape={
        <Button
          size="lg"
          className="w-full rounded-full"
          disabled={!bytes || gerando}
          onClick={() => bytes && baixarBlob(new Blob([bytes], { type: "application/pdf" }), `Miolo_Agenda_${ano}_${config.saida === "a5" ? "A5" : "A4"}.pdf`)}
        >
          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar miolo {config.saida === "a5" ? "A5" : "A4 (2 por folha)"}
        </Button>
      }
    />
  );
}
