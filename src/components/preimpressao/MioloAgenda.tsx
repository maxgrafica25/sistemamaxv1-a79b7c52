// Pré-impressão → ferramenta "Miolo de agenda".
// Gera o miolo de uma agenda anual (A5, ou A4 com 2 miolos por folha) no padrão que a gráfica imprime,
// com feriados nacionais sempre e regionais acrescentados pela pessoa, logo e contato do cliente, marca-d'água,
// páginas do cliente, modelo semanal, capa e contracapa e modelos salvos. Tudo no navegador, sem custo.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Download, Loader2, Plus, X } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MESES_CURTOS, gerarCapas, gerarMiolo, miolosEmA4, type Feriado, type FontesExternas, type Imagem, type Miolo, type PosicaoExtra } from "@/lib/preimpressao/agenda";
import { bytesParaDataUrl, carregarFontes, corDeFundoDaLogo, dataUrlParaBytes, prepararImagem, silhuetaDaLogo } from "@/lib/preimpressao/agendaNavegador";
import { detectarTipo } from "@/lib/preimpressao/margem";
import { baixarBlob } from "@/lib/preimpressao/navegador";
import { AgendaExtras, type ExtraUI } from "./AgendaExtras";
import { AgendaIdentidade, AgendaLogo, AgendaMarcaDagua } from "./AgendaIdentidade";
import { AgendaModelos } from "./AgendaModelos";
import { configPadrao, type ConfigAgendaUI, type ModoAgenda, type Saida } from "./agendaConfig";
import { Campo, Chave, Dado, DuasColunas, Mini, NotaPrivacidade, Painel, Passo, PreviaPdf, SeletorCor, Segmentado } from "./ui";
import { numeroEntre, useConfigSalva } from "./uteis";

const SUGESTOES: Feriado[] = [{ dia: 20, mes: 9, nome: "Revolução Farroupilha (RS)" }];
const MAX_REGIONAIS = 12;
const MAX_EXTRAS = 6;
const MAX_PAGINAS_EXTRAS = 40;
const CORES_CAPA = [
  { nome: "Grafite", hex: "#1f1f1f" },
  { nome: "Azul-marinho", hex: "#16325c" },
  { nome: "Verde", hex: "#14532d" },
  { nome: "Vinho", hex: "#7a1f3d" },
  { nome: "Roxo", hex: "#62209a" },
  { nome: "Branco", hex: "#ffffff" },
];

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

let seq = 0;
const novoId = () => `x${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Bloco que abre e fecha (como "Ajustes da folha"), com um resumo na linha de baixo. */
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

function imagemDe(s: ConfigAgendaUI["logo"]): Imagem | null {
  return s ? { bytes: dataUrlParaBytes(s.dataUrl), tipo: s.tipo, w: s.w, h: s.h } : null;
}

export default function MioloAgenda() {
  const [config, set] = useConfigSalva("preimpressao.agenda.config.v2", configPadrao());
  const [modo, setModo] = useState<ModoAgenda>("miolo");
  const [extras, setExtras] = useState<ExtraUI[]>([]);
  const [erroExtras, setErroExtras] = useState<string | null>(null);
  const [lendoExtras, setLendoExtras] = useState(false);
  const [erroLogo, setErroLogo] = useState<string | null>(null);
  const [lendoLogo, setLendoLogo] = useState(false);
  const [fontes, setFontes] = useState<FontesExternas | null>(null);
  const [fontesProntas, setFontesProntas] = useState(false);
  const [marcaLogo, setMarcaLogo] = useState<Imagem | null>(null);
  const [miolo, setMiolo] = useState<Miolo | null>(null);
  const [capas, setCapas] = useState<Uint8Array | null>(null);
  const [saidaA4, setSaidaA4] = useState<Uint8Array | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [novaData, setNovaData] = useState("");
  const [novoNome, setNovoNome] = useState("");

  const ano = numeroEntre(String(config.ano), 2000, 2200, true);
  const total = config.total.trim() === "" ? null : numeroEntre(config.total, 2, 2000, true);
  const totalInvalido = config.total.trim() !== "" && total === null;
  const horasInvalidas = config.horaFim <= config.horaInicio;
  const dataLida = lerDiaMes(novaData);
  const nomeOk = novoNome.trim().length > 0;
  const logoImg = useMemo(() => imagemDe(config.logo), [config.logo]);

  useEffect(() => {
    let vivo = true;
    carregarFontes()
      .then((f) => vivo && setFontes(f))
      .finally(() => vivo && setFontesProntas(true));
    return () => {
      vivo = false;
    };
  }, []);

  // Marca-d'água com a logo: silhueta (só o desenho, em preto) ou a logo como está
  useEffect(() => {
    setMarcaLogo(null);
    if (!config.marcaAtiva || config.marcaTipo !== "logo" || !logoImg) return;
    if (!config.marcaSilhueta) {
      setMarcaLogo(logoImg);
      return;
    }
    let vivo = true;
    silhuetaDaLogo(logoImg)
      .then((s) => vivo && setMarcaLogo(s))
      .catch(() => vivo && setMarcaLogo(logoImg));
    return () => {
      vivo = false;
    };
  }, [config.marcaAtiva, config.marcaTipo, config.marcaSilhueta, logoImg]);

  const logoChave = config.logo ? `${config.logo.dataUrl.length}:${config.logo.dataUrl.slice(-32)}` : "";
  const chaveMiolo = JSON.stringify([
    ano,
    config.capa,
    config.regionais,
    total,
    config.modelo,
    config.estiloDia,
    config.horaInicio,
    config.horaFim,
    config.semanaComeca,
    config.luas,
    config.destaque,
    logoChave,
    config.rodape,
    config.logoNaCapa,
    config.logoNoVerso,
    config.rodapeEmTodas,
    config.marcaAtiva,
    config.marcaTipo,
    config.marcaTexto,
    config.marcaOpacidade,
    config.marcaEscala,
    config.marcaOnde,
    marcaLogo ? marcaLogo.bytes.length : 0,
    extras.map((e) => `${e.id}:${e.posicao}`),
    fontes ? 1 : 0,
  ]);

  // Miolo: refeito sozinho a cada ajuste, depois de uma pausa
  useEffect(() => {
    setErro(null);
    if (modo !== "miolo" || !fontesProntas || ano === null || totalInvalido || horasInvalidas) {
      if (modo === "miolo") setMiolo(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(async () => {
      try {
        const m = await gerarMiolo(
          {
            ano,
            capa: config.capa.trim() || "AGENDA",
            regionais: config.regionais,
            total,
            modelo: config.modelo,
            estiloDia: config.estiloDia,
            horaInicio: config.horaInicio,
            horaFim: config.horaFim,
            semanaComeca: config.semanaComeca,
            luas: config.luas,
            destaque: config.destaque,
            identidade: { logo: logoImg, rodape: config.rodape, logoNaCapa: config.logoNaCapa, logoNoVerso: config.logoNoVerso, rodapeEmTodas: config.rodapeEmTodas },
            marcaDagua: {
              ativa: config.marcaAtiva,
              tipo: config.marcaTipo,
              texto: config.marcaTexto,
              logo: marcaLogo,
              opacidade: config.marcaOpacidade / 100,
              escala: config.marcaEscala,
              onde: config.marcaOnde,
            },
            extras: extras.map((e) => ({ nome: e.nome, bytes: e.bytes, tipo: e.tipo, posicao: e.posicao, paginas: e.paginas })),
          },
          fontes,
        );
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
  }, [modo, fontesProntas, chaveMiolo, horasInvalidas, totalInvalido]);

  // Capa e contracapa
  const chaveCapa = JSON.stringify([ano, config.capa, config.capaCor, config.capaLinha1, config.capaLinha2, config.capaContato, config.capaUsarLogo, logoChave, fontes ? 1 : 0]);
  useEffect(() => {
    if (modo !== "capa" || !fontesProntas || ano === null) return;
    setErro(null);
    let vivo = true;
    setGerando(true);
    const t = setTimeout(async () => {
      try {
        const b = await gerarCapas(
          { ano, titulo: config.capa, cor: config.capaCor, linha1: config.capaLinha1, linha2: config.capaLinha2, contato: config.capaContato, logo: logoImg, usarLogo: config.capaUsarLogo },
          fontes,
        );
        if (vivo) setCapas(b);
      } catch (e) {
        if (vivo) {
          setCapas(null);
          setErro(e instanceof Error ? e.message : "Não consegui gerar a capa.");
        }
      } finally {
        if (vivo) setGerando(false);
      }
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, fontesProntas, chaveCapa]);

  // A4 com 2 miolos por folha: derivado do A5 (só quando escolhido)
  useEffect(() => {
    setSaidaA4(null);
    if (modo !== "miolo" || !miolo || config.saida !== "a4") return;
    let vivo = true;
    miolosEmA4(miolo.bytes)
      .then((b) => vivo && setSaidaA4(b))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não consegui montar o A4."));
    return () => {
      vivo = false;
    };
  }, [modo, miolo, config.saida]);

  const carregarLogo = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setLendoLogo(true);
    setErroLogo(null);
    try {
      const img = await prepararImagem(new Uint8Array(await f.arrayBuffer()), f.name, 1000);
      set("logo", { dataUrl: bytesParaDataUrl(img.bytes, img.tipo), w: img.w, h: img.h, tipo: img.tipo });
    } catch (e) {
      setErroLogo(e instanceof Error ? e.message : "Não consegui abrir a imagem.");
    } finally {
      setLendoLogo(false);
    }
  };

  const adicionarExtras = async (files: File[]) => {
    setLendoExtras(true);
    setErroExtras(null);
    const novos: ExtraUI[] = [];
    try {
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const tipo = detectarTipo(bytes, f.name);
        if (tipo === "pdf") {
          const n = (await PDFDocument.load(bytes)).getPageCount();
          if (n > 20) throw new Error(`${f.name}: use no máximo 20 páginas por arquivo.`);
          novos.push({ id: novoId(), nome: f.name, bytes, tipo: "pdf", paginas: n, posicao: "inicio" });
        } else if (tipo === "png" || tipo === "jpg") {
          const img = await prepararImagem(bytes, f.name, 1800);
          novos.push({ id: novoId(), nome: f.name, bytes: img.bytes, tipo: img.tipo, paginas: 1, posicao: "inicio" });
        } else {
          throw new Error(`${f.name}: envie PDF, PNG ou JPG.`);
        }
      }
      const todos = [...extras, ...novos];
      if (todos.length > MAX_EXTRAS) throw new Error(`No máximo ${MAX_EXTRAS} arquivos de páginas do cliente.`);
      if (todos.reduce((s, e) => s + e.paginas, 0) > MAX_PAGINAS_EXTRAS) throw new Error(`No máximo ${MAX_PAGINAS_EXTRAS} páginas do cliente no total.`);
      setExtras(todos);
    } catch (e) {
      setErroExtras(e instanceof Error ? e.message : "Não consegui abrir o arquivo.");
    } finally {
      setLendoExtras(false);
    }
  };

  const adicionarFeriado = (f: Feriado) => {
    if (config.regionais.length >= MAX_REGIONAIS) return;
    if (config.regionais.some((x) => x.dia === f.dia && x.mes === f.mes && x.nome === f.nome)) return;
    set("regionais", [...config.regionais, f].sort((a, b) => a.mes - b.mes || a.dia - b.dia));
  };
  const sugestoesLivres = SUGESTOES.filter((s) => !config.regionais.some((x) => x.dia === s.dia && x.mes === s.mes));

  const aplicarConfig = (c: ConfigAgendaUI) => (Object.keys(c) as (keyof ConfigAgendaUI)[]).forEach((k) => set(k, c[k] as never));

  const bytesMiolo = config.saida === "a4" ? saidaA4 : (miolo?.bytes ?? null);
  const bytes = modo === "capa" ? capas : bytesMiolo;
  const paginas = modo === "capa" ? 2 : (miolo?.plano.paginas.length ?? 0);
  const atual = Math.min(pagina, Math.max(0, paginas - 1));

  const atalhos = useMemo(() => {
    if (modo !== "miolo" || !miolo) return [];
    return [{ rotulo: "Capa", pagina: 0 }, { rotulo: "Dados", pagina: 2 }, { rotulo: "Calendário", pagina: 3 }, ...miolo.plano.paginaDoMes.map((p, i) => ({ rotulo: MESES_CURTOS[i], pagina: p }))];
  }, [modo, miolo]);

  const nExtras = extras.reduce((s, e) => s + e.paginas, 0);
  const resumoIdentidade = [config.logo ? "Logo" : null, config.rodape.trim() ? "contato" : null, config.marcaAtiva ? "marca-d'água" : null].filter(Boolean).join(" · ") || "Nada ainda";
  const resumoAjustes = `${config.modelo === "diario" ? "Diário" : "Semanal"} · ${config.estiloDia === "horas" ? `${doisDigitos(config.horaInicio)}h–${doisDigitos(config.horaFim)}h` : "linhas lisas"} · semana começa ${config.semanaComeca === "dom" ? "no domingo" : "na segunda"}`;

  const esquerda = (
    <Painel className="space-y-6">
      <Segmentado
        valor={modo}
        opcoes={[
          { valor: "miolo" as ModoAgenda, rotulo: "Miolo" },
          { valor: "capa" as ModoAgenda, rotulo: "Capa e contracapa" },
        ]}
        onChange={(v) => {
          setModo(v);
          setPagina(0);
        }}
      />

      <AgendaModelos config={config} onAplicar={aplicarConfig} />

      <Campo titulo="Ano da agenda">
        <Passo valor={String(config.ano)} onChange={(v) => set("ano", Number.parseInt(v, 10) || config.ano)} passo={1} min={2000} max={2200} rotulo="ano" invalido={ano === null} largura="w-20" />
      </Campo>

      <Mini rotulo="Palavra da capa" valor={config.capa} onChange={(v) => set("capa", v.slice(0, 12))} texto ajuda="Até 12 letras. Padrão: AGENDA" />

      {modo === "miolo" ? (
        <>
          <Bloco titulo="Logo, contato e marca-d'água" resumo={resumoIdentidade}>
            <AgendaLogo config={config} set={set} onArquivos={(f) => void carregarLogo(f)} carregando={lendoLogo} erro={erroLogo} />
            <AgendaIdentidade config={config} set={set} />
            <AgendaMarcaDagua config={config} set={set} />
          </Bloco>

          <Bloco titulo="Feriados" resumo={config.regionais.length ? `Nacionais + ${config.regionais.length} acrescentado${config.regionais.length > 1 ? "s" : ""}` : "Só os nacionais"}>
            <Campo titulo="Feriados" ajuda="Os feriados nacionais, o Carnaval, a Sexta-feira Santa, a Páscoa e o Corpus Christi entram sempre, já com as datas do ano. Acrescente os da sua região ou cidade abaixo.">
              {config.regionais.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {config.regionais.map((f) => (
                    <li key={`${f.mes}-${f.dia}-${f.nome}`} className="flex items-center gap-2 rounded-2xl bg-background/70 px-3 py-2 text-sm">
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
                      adicionarFeriado({ ...dataLida, nome: novoNome.trim() });
                      setNovaData("");
                      setNovoNome("");
                    }}
                  >
                    <Plus className="h-4 w-4" /> Adicionar feriado
                  </Button>
                  {sugestoesLivres.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {sugestoesLivres.map((s) => (
                        <button key={`${s.mes}-${s.dia}`} type="button" onClick={() => adicionarFeriado(s)} className="rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
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
          </Bloco>

          <Bloco titulo="Páginas do cliente" resumo={extras.length ? `${extras.length} arquivo${extras.length > 1 ? "s" : ""} · ${nExtras} página${nExtras > 1 ? "s" : ""}` : "Nenhuma"}>
            <AgendaExtras
              extras={extras}
              onArquivos={(f) => void adicionarExtras(f)}
              onRemover={(id) => setExtras((p) => p.filter((e) => e.id !== id))}
              onPosicao={(id, pos: PosicaoExtra) => setExtras((p) => p.map((e) => (e.id === id ? { ...e, posicao: pos } : e)))}
              carregando={lendoExtras}
              erro={erroExtras}
            />
          </Bloco>

          <Bloco titulo="Ajustes do miolo" resumo={resumoAjustes}>
            <Campo titulo="Modelo das páginas" ajuda={config.modelo === "diario" ? "Uma página por dia; sábado e domingo juntos." : "A semana inteira em duas páginas (segunda a domingo)."}>
              <Segmentado
                valor={config.modelo}
                opcoes={[
                  { valor: "diario" as const, rotulo: "Diário" },
                  { valor: "semanal" as const, rotulo: "Semanal" },
                ]}
                onChange={(v) => set("modelo", v)}
              />
            </Campo>
            {config.modelo === "diario" && (
              <>
                <Campo titulo="Linhas do dia">
                  <Segmentado
                    valor={config.estiloDia}
                    opcoes={[
                      { valor: "horas" as const, rotulo: "Com as horas" },
                      { valor: "linhas" as const, rotulo: "Só linhas" },
                    ]}
                    onChange={(v) => set("estiloDia", v)}
                  />
                </Campo>
                <Campo titulo="Das" ajuda={horasInvalidas ? undefined : "A página do sábado e do domingo mostra as 5 primeiras horas."}>
                  <Passo valor={String(config.horaInicio)} onChange={(v) => set("horaInicio", Math.min(21, Math.max(5, Number.parseInt(v, 10) || config.horaInicio)))} passo={1} min={5} max={21} sufixo="h" rotulo="hora de início" />
                </Campo>
                <Campo titulo="Até">
                  <Passo valor={String(config.horaFim)} onChange={(v) => set("horaFim", Math.min(23, Math.max(6, Number.parseInt(v, 10) || config.horaFim)))} passo={1} min={6} max={23} sufixo="h" rotulo="hora final" invalido={horasInvalidas} />
                  {horasInvalidas && <p className="mt-2 text-xs text-destructive">A hora final precisa ser depois da inicial.</p>}
                </Campo>
              </>
            )}
            <Campo titulo="Calendários pequenos: a semana começa">
              <Segmentado
                valor={config.semanaComeca}
                opcoes={[
                  { valor: "dom" as const, rotulo: "No domingo" },
                  { valor: "seg" as const, rotulo: "Na segunda" },
                ]}
                onChange={(v) => set("semanaComeca", v)}
              />
            </Campo>
            <Chave ligado={config.luas} onChange={(v) => set("luas", v)}>
              <span className="font-medium">Fases da lua</span>
              <span className="block text-xs text-muted-foreground">No planejamento do mês.</span>
            </Chave>
            <Chave ligado={config.destaque} onChange={(v) => set("destaque", v)}>
              <span className="font-medium">Domingos e feriados em cinza</span>
              <span className="block text-xs text-muted-foreground">O número do dia fica mais clarinho.</span>
            </Chave>
          </Bloco>

          <Campo titulo="Total de páginas" ajuda={miolo ? `O miolo precisa de ${miolo.plano.minimo} páginas. Se você pedir mais, o resto vira páginas de anotações no final.` : "Deixe vazio para só o necessário."}>
            <Mini rotulo="Número de páginas (opcional)" valor={config.total} onChange={(v) => set("total", v)} erro={totalInvalido ? "Número inteiro" : undefined} />
            <div className="mt-2 flex flex-wrap gap-2">
              {[{ r: "Só o necessário", v: "" }, { r: "350", v: "350" }, { r: "382", v: "382" }].map((c) => (
                <button
                  key={c.r}
                  type="button"
                  onClick={() => set("total", c.v)}
                  className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors", config.total === c.v ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground")}
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
        </>
      ) : (
        <>
          <AgendaLogo config={config} set={set} onArquivos={(f) => void carregarLogo(f)} carregando={lendoLogo} erro={erroLogo} />
          <Chave ligado={config.capaUsarLogo} onChange={(v) => set("capaUsarLogo", v)}>
            <span className="font-medium">Usar a logo na capa e na contracapa</span>
          </Chave>
          <Campo titulo="Cor de fundo" ajuda="A cor vira a capa inteira, com sangria. Fundo claro usa letras escuras sozinho.">
            <SeletorCor valor={config.capaCor} sugestoes={CORES_CAPA} onChange={(hex) => set("capaCor", hex)} />
            {logoImg && (
              <button
                type="button"
                className="mt-3 text-xs font-medium text-primary hover:underline"
                onClick={() =>
                  void corDeFundoDaLogo(logoImg).then((hex) => {
                    if (hex) set("capaCor", hex);
                    else setErroLogo("A logo não tem um fundo de uma cor só.");
                  })
                }
              >
                Usar a cor de fundo da logo
              </button>
            )}
          </Campo>
          <Campo titulo="Textos da capa">
            <div className="space-y-4">
              <Mini rotulo="Nome do cliente" valor={config.capaLinha1} onChange={(v) => set("capaLinha1", v.slice(0, 32))} texto />
              <Mini rotulo="Frase ou slogan (opcional)" valor={config.capaLinha2} onChange={(v) => set("capaLinha2", v.slice(0, 48))} texto />
            </div>
          </Campo>
          <Campo titulo="Contracapa" ajuda="Uma linha por informação (telefone, Instagram, endereço…). Até 6 linhas.">
            <textarea
              aria-label="Contato na contracapa"
              rows={4}
              value={config.capaContato}
              onChange={(e) => set("capaContato", e.target.value.slice(0, 240))}
              className="w-full resize-none rounded-2xl bg-muted/60 px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-primary/40"
            />
          </Campo>
        </>
      )}
    </Painel>
  );

  return (
    <DuasColunas
      esquerda={esquerda}
      direita={
        <>
          <Painel className="space-y-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Pré-visualização</h3>
              <p className="text-xs text-muted-foreground">{modo === "miolo" ? "É o PDF que vai ser baixado. Use as setas ou os atalhos para passear pelo miolo." : "Capa e contracapa em A5, com sangria. Use as setas para ver as duas."}</p>
            </div>
            {atalhos.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {atalhos.map((a) => (
                  <button key={a.rotulo} type="button" onClick={() => setPagina(a.pagina)} className="rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                    {a.rotulo}
                  </button>
                ))}
              </div>
            )}
            <PreviaPdf
              bytes={bytes}
              paginas={paginas}
              ocupado={gerando}
              pagina={atual}
              onPagina={setPagina}
              rotulos={modo === "capa" ? (i) => (i === 0 ? "Capa" : "Contracapa") : undefined}
              vazio={gerando ? "Montando…" : "Confira os campos marcados em vermelho"}
            />
          </Painel>

          <Painel className="space-y-4">
            {modo === "capa" ? (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm xl:grid-cols-3">
                  <Dado rotulo="Tamanho final" valor="14,8 × 21 cm" />
                  <Dado rotulo="Com sangria" valor="15,1 × 21,3 cm" />
                  <Dado rotulo="Páginas" valor="2 (capa e contracapa)" />
                </dl>
                <p className="rounded-2xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                  Para imprimir em folha maior com marcas de corte, solte este PDF na <span className="font-medium text-foreground">Montagem de impressos</span>: a sangria é lida sozinha. As cores saem em RGB; o fundo escuro
                  sai bem em papel firme (couchê 250 g).
                </p>
              </>
            ) : miolo ? (
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
                    <p>
                      Papel já cortado em A5. Impressão em frente e verso (duplex), página em pé, <span className="font-medium text-foreground">virando pela borda longa</span>.
                    </p>
                  ) : (
                    <p>
                      Papel A4. Impressão em frente e verso (duplex), página deitada, <span className="font-medium text-foreground">virando pela borda curta</span>. Depois, corte ao meio na guilhotina: saem 2 miolos.
                    </p>
                  )}
                  <p>
                    Imprima em <span className="font-medium text-foreground">tamanho real</span> (não ajuste o formato). Sem duplex: imprima as páginas ímpares e depois as pares; teste com poucas páginas.
                  </p>
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
          onClick={() =>
            bytes &&
            baixarBlob(
              new Blob([bytes], { type: "application/pdf" }),
              modo === "capa" ? `Capa_Agenda_${ano}.pdf` : `Miolo_Agenda_${ano}_${config.saida === "a5" ? "A5" : "A4"}.pdf`,
            )
          }
        >
          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {modo === "capa" ? "Baixar capa e contracapa" : `Baixar miolo ${config.saida === "a5" ? "A5" : "A4 (2 por folha)"}`}
        </Button>
      }
    />
  );
}
