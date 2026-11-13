// Pré-impressão → ferramenta "Fotos Polaroid".
// Solta as fotos do cliente e o sistema monta polaroids (clássica, mini ou quadrada) em folhas A4, A3,
// SRA3 ou Formatão, com moldura colorida, legenda à mão, filtros (geral ou por foto), adesivos que se
// arrastam, verso com mensagem/QR e marcas de corte. Tudo no navegador, sem custo.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Download, Loader2, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Imagem } from "@/lib/preimpressao/agenda";
import { AJUSTE_PADRAO } from "@/lib/preimpressao/cracha";
import { baixarBlob } from "@/lib/preimpressao/navegador";
import {
  ADESIVOS,
  CORES_ADESIVO,
  FILTROS,
  MAX_ADESIVOS,
  MAX_COPIAS,
  MOLDURAS,
  PAPEIS,
  POLAROIDS,
  aspectoPolaroid,
  completarFolha,
  conferirPolaroids,
  configPolaroidPadrao,
  filtroDoItem,
  gerarPecaUnica,
  gerarPolaroids,
  legendaDoItem,
  planejarFolha,
  resumoDeFolhas,
  type Adesivo,
  type ConfigPolaroid,
  type Enfeite,
  type FiltroFoto,
  type FontePolaroid,
  type PapelFolha,
  type PolaroidsGeradas,
  type TamanhoPolaroid,
  type TipoAdesivo,
} from "@/lib/preimpressao/polaroid";
import { carregarFonteManuscrita, prepararFotoPolaroid } from "@/lib/preimpressao/polaroidNavegador";
import { CrachaFotoAjuste } from "./CrachaFotoAjuste";
import { LinhaDeFoto } from "./ListaDeFotos";
import { useListaDeFotos } from "./useListaDeFotos";
import { PolaroidPrevia } from "./PolaroidPrevia";
import { Campo, Chave, DuasColunas, NotaPrivacidade, Painel, Passo, Pilulas, PreviaPdf, SeletorCor, Segmentado, SoltarArquivo } from "./ui";
import { useConfigSalva } from "./uteis";

const ENFEITES: { valor: Enfeite; rotulo: string }[] = [
  { valor: "nenhum", rotulo: "Sem enfeite" },
  { valor: "fita", rotulo: "Fita adesiva" },
  { valor: "coracao", rotulo: "Coração" },
  { valor: "estrela", rotulo: "Estrela" },
];

let seqAdesivo = 0;
const num = (v: string, atual: number, min: number, max: number) => {
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : atual;
};

export default function FotosPolaroid() {
  const [cfg, set] = useConfigSalva<ConfigPolaroid>("preimpressao.polaroid.config.v1", configPolaroidPadrao);
  const { itens, setItens, erro: erroFotos, receber, mudar, remover } = useListaDeFotos();
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [fonte, setFonte] = useState<FontePolaroid | null>(null);
  const [recortes, setRecortes] = useState<Map<string, Imagem>>(new Map());
  const [pdf, setPdf] = useState<PolaroidsGeradas | null>(null);
  const [peca, setPeca] = useState<Uint8Array | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [aba, setAba] = useState<"folha" | "uma">("folha");
  const [adSel, setAdSel] = useState<string | null>(null);
  const [qtdTodas, setQtdTodas] = useState(1);
  const cache = useRef(new Map<string, Imagem>());

  useEffect(() => {
    void carregarFonteManuscrita().then(setFonte);
  }, []);

  // Configurações salvas antes dos adesivos e do papel não têm esses campos
  const adesivos = useMemo(() => cfg.adesivos ?? [], [cfg.adesivos]);
  const papel: PapelFolha = cfg.papel && PAPEIS[cfg.papel] ? cfg.papel : "a4";
  const cfgOk = useMemo<ConfigPolaroid>(() => ({ ...cfg, adesivos, papel }), [cfg, adesivos, papel]);

  const aspecto = aspectoPolaroid(cfg.tamanho);
  const med = POLAROIDS[cfg.tamanho];
  const plano = planejarFolha(cfg.tamanho, papel);
  const total = itens.reduce((a, i) => a + i.qtd, 0);
  const resumo = resumoDeFolhas(cfg.tamanho, total, papel);

  // Recorte + filtro de cada foto (em cache)
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      const novo = new Map<string, Imagem>();
      for (const i of itens) {
        const filtro = filtroDoItem(i, cfg.filtro);
        const k = `${i.id}|${aspecto}|${filtro}|${i.ajuste.zoom}|${i.ajuste.x}|${i.ajuste.y}`;
        let img = cache.current.get(k);
        if (!img) {
          try {
            img = await prepararFotoPolaroid(i.foto, aspecto, i.ajuste, filtro);
          } catch {
            continue;
          }
          cache.current.set(k, img);
        }
        if (!vivo) return;
        novo.set(i.id, img);
      }
      if (vivo) setRecortes(novo);
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [itens, aspecto, cfg.filtro]);

  const itensPdf = useMemo(() => itens.map((i) => ({ id: i.id, arquivo: i.foto.nome, qtd: i.qtd, legenda: i.legenda, filtro: i.filtro })), [itens]);

  // PDF da folha
  useEffect(() => {
    if (!itens.length) {
      setPdf(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(() => {
      gerarPolaroids({ cfg: cfgOk, itens: itensPdf, fotos: recortes, fonte })
        .then((r) => {
          if (!vivo) return;
          setPdf(r);
          setErro(null);
        })
        .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível montar as polaroids."))
        .finally(() => vivo && setGerando(false));
    }, 450);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [itens.length, itensPdf, cfgOk, recortes, fonte]);

  // Uma polaroid grande (para colocar adesivos), com a 1ª foto ou uma moldura vazia
  const modelo = useMemo(() => itensPdf[0] ?? { id: "demo", arquivo: "foto.jpg", qtd: 1, legenda: "" }, [itensPdf]);
  useEffect(() => {
    if (aba !== "uma") return;
    let vivo = true;
    const t = setTimeout(() => {
      gerarPecaUnica({ cfg: cfgOk, itens: [modelo], fotos: recortes, fonte }, modelo)
        .then((b) => vivo && setPeca(b))
        .catch(() => vivo && setPeca(null));
    }, 100);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [aba, cfgOk, modelo, recortes, fonte]);

  const conferencia = useMemo(
    () => conferirPolaroids({ cfg: cfgOk, itens: itens.map((i) => ({ id: i.id, arquivo: i.foto.nome, qtd: i.qtd, legenda: i.legenda, w: i.foto.w, h: i.foto.h, zoom: i.ajuste.zoom })) }),
    [cfgOk, itens],
  );

  const comVerso = !!pdf && pdf.paginas > pdf.folhas;
  const rotulo = (n: number) => (comVerso ? `${n % 2 === 0 ? "Frente" : "Verso"} da folha ${Math.floor(n / 2) + 1}` : `Folha ${n + 1}`);
  const ajustandoItem = itens.find((i) => i.id === ajustando);

  const completar = () => {
    const mais = completarFolha(itens.map((i) => i.qtd), plano.porFolha);
    setItens((prev) => prev.map((i, k) => ({ ...i, qtd: Math.min(MAX_COPIAS, i.qtd + mais[k]) })));
  };

  // Adesivos
  const mudarAdesivo = (id: string, p: Partial<Adesivo>) => set("adesivos", adesivos.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const novoAdesivo = (tipo: TipoAdesivo) => {
    if (adesivos.length >= MAX_ADESIVOS) return;
    const a: Adesivo = { id: `ad${Date.now().toString(36)}${seqAdesivo++}`, tipo, x: 22 + ((adesivos.length * 17) % 56), y: 26 + ((adesivos.length * 13) % 40), tam: tipo === "fita" ? 22 : 11, cor: tipo === "fita" ? "#facc15" : "#e11d48", giro: tipo === "fita" ? -12 : 0 };
    set("adesivos", [...adesivos, a]);
    setAdSel(a.id);
    setAba("uma");
  };
  const adesivoAtual = adesivos.find((a) => a.id === adSel);

  const esquerda = (
    <Painel className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Fotos Polaroid</h2>
        <p className="text-sm text-muted-foreground">Solte as fotos e o sistema monta as polaroids na folha, já com marcas de corte.</p>
      </div>
      <NotaPrivacidade />

      <Campo titulo="1. Fotos" ajuda="Quantas quiser, de uma vez. Cada uma pode ter legenda, cópias, filtro e enquadramento próprios.">
        <SoltarArquivo
          titulo="Solte as fotos aqui"
          dica="JPG, PNG ou WebP"
          arquivo={itens.length ? { nome: `${itens.length} foto(s)`, detalhe: `${total} polaroid(s) no total` } : null}
          aceita="image/*"
          multiplo
          erro={erroFotos}
          onArquivos={(f) => void receber(f)}
        />
      </Campo>

      {itens.length > 0 && (
        <>
          <div className="max-h-96 space-y-2 overflow-y-auto rounded-2xl bg-muted/40 p-2">
            {itens.map((i) => (
              <LinhaDeFoto
                key={i.id}
                item={i}
                placeholderLegenda={legendaDoItem({ id: i.id, arquivo: i.foto.nome, qtd: 1, legenda: "" }, cfg)}
                onMudar={(p) => mudar(i.id, p)}
                onRemover={() => remover(i.id)}
                onEnquadrar={() => setAjustando(i.id)}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" className="rounded-full" onClick={completar} disabled={resumo.sobram === 0}>
              Completar a folha{resumo.sobram ? ` (+${resumo.sobram})` : ""}
            </Button>
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="w-36">
              <Passo valor={String(qtdTodas)} onChange={(v) => setQtdTodas(num(v, qtdTodas, 1, MAX_COPIAS))} min={1} max={MAX_COPIAS} rotulo="cópias de cada" largura="w-8" />
            </div>
            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setItens((p) => p.map((i) => ({ ...i, qtd: qtdTodas })))}>
              Aplicar a todas
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setItens([])}>
              Limpar
            </Button>
          </div>
        </>
      )}

      <Campo titulo="2. Tamanho e folha" ajuda={`${med.nome}: ${med.w} × ${med.h} mm, foto de ${med.foto.w} × ${med.foto.h} mm. Cabem ${plano.porFolha} por folha ${PAPEIS[papel].nome}${plano.girada ? " (deitadas)" : ""}.`}>
        <div className="space-y-3">
          <Segmentado
            valor={cfg.tamanho}
            opcoes={[
              { valor: "classica" as const, rotulo: "Clássica" },
              { valor: "mini" as const, rotulo: "Mini" },
              { valor: "quadrada" as const, rotulo: "Quadrada" },
            ]}
            onChange={(v: TamanhoPolaroid) => set("tamanho", v)}
          />
          <Segmentado
            valor={papel}
            opcoes={(Object.keys(PAPEIS) as PapelFolha[]).map((k) => ({ valor: k, rotulo: PAPEIS[k].nome }))}
            onChange={(v: PapelFolha) => set("papel", v)}
          />
        </div>
      </Campo>

      <Campo titulo="3. Moldura">
        <SeletorCor valor={cfg.moldura} sugestoes={MOLDURAS} onChange={(v) => set("moldura", v)} />
      </Campo>

      <Campo titulo="4. Filtro geral" ajuda="Vale para as fotos que não têm filtro próprio. Não muda o arquivo original.">
        <Pilulas valor={cfg.filtro} opcoes={FILTROS} onChange={(v: FiltroFoto) => set("filtro", v)} />
      </Campo>

      <Campo titulo="5. Legenda e enfeite" ajuda="A legenda vai na borda de baixo, em letra de mão. A de cada foto (acima) tem prioridade.">
        <div className="space-y-3">
          <input
            value={cfg.legendaPadrao}
            onChange={(e) => set("legendaPadrao", e.target.value.slice(0, 60))}
            placeholder="Legenda para todas (ex.: Verão 2026)"
            aria-label="Legenda para todas"
            className="h-10 w-full rounded-full bg-muted/60 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <Chave ligado={cfg.legendaDoArquivo} onChange={(v) => set("legendaDoArquivo", v)}>
            <span className="font-medium">Usar o nome do arquivo como legenda</span>
            <span className="block text-xs text-muted-foreground">Só para as fotos sem legenda. "Maria_e_Joao.jpg" vira "Maria e Joao".</span>
          </Chave>
          <input
            value={cfg.data}
            onChange={(e) => set("data", e.target.value.slice(0, 20))}
            placeholder="Data no canto (opcional, ex.: 15/03/2026)"
            aria-label="Data no canto"
            className="h-10 w-full rounded-full bg-muted/60 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <Pilulas valor={cfg.enfeite} opcoes={ENFEITES} onChange={(v: Enfeite) => set("enfeite", v)} />
        </div>
      </Campo>

      <Campo titulo="6. Adesivos" ajuda="Escolha um adesivo e arraste na polaroid ao lado. Eles saem em todas as polaroids, no mesmo lugar.">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {ADESIVOS.map((a) => (
              <Button key={a.tipo} size="sm" variant="secondary" className="rounded-full" onClick={() => novoAdesivo(a.tipo)} disabled={adesivos.length >= MAX_ADESIVOS}>
                + {a.rotulo}
              </Button>
            ))}
          </div>
          {adesivos.length > 0 && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Adesivo escolhido">
              {adesivos.map((a, n) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={adSel === a.id}
                  onClick={() => {
                    setAdSel(a.id);
                    setAba("uma");
                  }}
                  className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", adSel === a.id ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground")}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.cor }} />
                  {ADESIVOS.find((x) => x.tipo === a.tipo)?.rotulo} {n + 1}
                </button>
              ))}
            </div>
          )}
          {adesivoAtual && (
            <div className="space-y-3 rounded-2xl bg-muted/40 p-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Tamanho</p>
                <Passo valor={String(adesivoAtual.tam)} onChange={(v) => mudarAdesivo(adesivoAtual.id, { tam: num(v, adesivoAtual.tam, 4, 60) })} passo={1} min={4} max={60} sufixo="mm" rotulo="tamanho do adesivo" />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Giro</p>
                <Passo valor={String(adesivoAtual.giro)} onChange={(v) => mudarAdesivo(adesivoAtual.id, { giro: num(v, adesivoAtual.giro, -180, 180) })} passo={15} min={-180} max={180} sufixo="°" rotulo="giro do adesivo" />
              </div>
              {adesivoAtual.tipo !== "carinha" && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Cor</p>
                  <SeletorCor valor={adesivoAtual.cor} sugestoes={CORES_ADESIVO} onChange={(v) => mudarAdesivo(adesivoAtual.id, { cor: v })} />
                </div>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-destructive"
                onClick={() => {
                  set("adesivos", adesivos.filter((a) => a.id !== adesivoAtual.id));
                  setAdSel(null);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Tirar este adesivo
              </Button>
            </div>
          )}
        </div>
      </Campo>

      <Campo titulo="7. Verso" ajuda="Mensagem e/ou QR Code atrás de cada polaroid. Imprima em frente e verso, virando pela borda longa: os lugares já saem espelhados.">
        <div className="space-y-3">
          <Chave ligado={cfg.verso.ativo} onChange={(v) => set("verso", { ...cfg.verso, ativo: v })}>
            <span className="font-medium">Imprimir o verso</span>
          </Chave>
          {cfg.verso.ativo && (
            <>
              <textarea
                value={cfg.verso.mensagem}
                onChange={(e) => set("verso", { ...cfg.verso, mensagem: e.target.value.slice(0, 160) })}
                rows={3}
                placeholder="Mensagem (ex.: Obrigado por fazer parte desse dia!)"
                aria-label="Mensagem do verso"
                className="w-full rounded-2xl bg-muted/60 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <input
                value={cfg.verso.qr}
                onChange={(e) => set("verso", { ...cfg.verso, qr: e.target.value.slice(0, 200) })}
                placeholder="Endereço para o QR Code (opcional)"
                aria-label="Endereço do QR Code"
                className="h-10 w-full rounded-full bg-muted/60 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </>
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
            { valor: "folha" as const, rotulo: "Folha montada" },
            { valor: "uma" as const, rotulo: "Uma polaroid (adesivos)" },
          ]}
          onChange={(v) => setAba(v)}
        />
        {aba === "folha" ? (
          <>
            <PreviaPdf bytes={pdf?.bytes ?? null} paginas={pdf?.paginas ?? 0} rotulos={rotulo} pagina={pagina} onPagina={setPagina} ocupado={gerando} vazio="Solte as fotos para ver as folhas" />
            {itens.length > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{total}</span> polaroid(s) em <span className="font-medium text-foreground">{resumo.folhas}</span> folha(s) {PAPEIS[papel].nome} · {resumo.porFolha} por folha
              </p>
            )}
          </>
        ) : (
          <PolaroidPrevia bytes={peca} adesivos={adesivos} selecionado={adSel} onMover={(id, p) => mudarAdesivo(id, p)} ocupado={false} nome={modelo.arquivo} />
        )}
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
          {pdf?.avisos.map((a) => (
            <li key={a} className="flex items-start gap-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </Painel>

      <Painel className="space-y-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Como imprimir</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>Imprima no tamanho real (100%), sem ajustar à página. Papel fotográfico ou couchê ficam melhores.</li>
          <li>Corte pelas marcas nos cantos de cada polaroid (guilhotina).</li>
          {cfg.verso.ativo && <li>Com verso: frente e verso, virando pela borda longa.</li>}
        </ol>
      </Painel>
    </>
  );

  const rodape = (
    <div className="flex flex-wrap items-center gap-2">
      <Button className="rounded-full" onClick={() => pdf && baixarBlob(new Blob([pdf.bytes], { type: "application/pdf" }), "Polaroids.pdf")} disabled={!pdf || gerando}>
        {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Baixar PDF ({pdf?.folhas ?? 0} folha{(pdf?.folhas ?? 0) === 1 ? "" : "s"})
      </Button>
    </div>
  );

  return (
    <>
      <DuasColunas esquerda={esquerda} direita={direita} rodape={rodape} />
      <CrachaFotoAjuste
        aberto={!!ajustandoItem}
        nome={ajustandoItem?.foto.nome ?? ""}
        foto={ajustandoItem?.foto ?? null}
        forma="quadrado"
        aspecto={aspecto}
        ajuste={ajustandoItem?.ajuste ?? AJUSTE_PADRAO}
        onFechar={() => setAjustando(null)}
        onSalvar={(a) => {
          if (ajustandoItem) mudar(ajustandoItem.id, { ajuste: a });
          setAjustando(null);
        }}
      />
    </>
  );
}
