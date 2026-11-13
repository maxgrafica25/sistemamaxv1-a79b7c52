// Pré-impressão → ferramenta "Impressão de fotos" (balcão).
// O atendente solta as fotos do cliente, escolhe a medida de cada uma (10×15, 15×20, 20×30 ou outra, em
// pé ou deitada) e o sistema encaixa tudo nas folhas com o melhor aproveitamento, com marcas de corte, e
// escreve um texto na foto se for pedido. Tudo no navegador, sem custo.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Download, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FontesExternas, Imagem } from "@/lib/preimpressao/agenda";
import { carregarFontes } from "@/lib/preimpressao/agendaNavegador";
import { AJUSTE_PADRAO } from "@/lib/preimpressao/cracha";
import {
  MAX_COPIAS_IMPRESSAO,
  MEDIDAS_IMPRESSAO,
  ORDEM_MEDIDAS,
  ORDEM_PAPEIS,
  PAPEIS_IMPRESSAO,
  compararPapeis,
  conferirImpressaoFotos,
  configImpressaoFotosPadrao,
  encaixarMelhor,
  geometriaDoItem,
  gerarImpressaoFotos,
  medidaDe,
  pecasDoLote,
  textoDoItem,
  type AjusteDaFoto,
  type ConfigImpressaoFotos,
  type CorteFotos,
  type EstiloTexto,
  type FonteTexto,
  type FotosImpressas,
  type ItemImpressao,
  type Orientacao,
  type PosicaoTexto,
} from "@/lib/preimpressao/impressaoFotos";
import { baixarBlob } from "@/lib/preimpressao/navegador";
import { FILTROS, filtroDoItem, type FiltroFoto, type FontePolaroid } from "@/lib/preimpressao/polaroid";
import { carregarFonteManuscrita, prepararFotoPolaroid } from "@/lib/preimpressao/polaroidNavegador";
import { CrachaFotoAjuste } from "./CrachaFotoAjuste";
import { LinhaDeFoto } from "./ListaDeFotos";
import { Campo, DuasColunas, NotaPrivacidade, Painel, Passo, Pilulas, PreviaPdf, SeletorCor, Segmentado, SoltarArquivo } from "./ui";
import { useConfigSalva } from "./uteis";
import { useListaDeFotos } from "./useListaDeFotos";

const num = (v: string, atual: number, min: number, max: number) => {
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : atual;
};

const CORES_TEXTO = [
  { nome: "Branco", hex: "#ffffff" },
  { nome: "Preto", hex: "#111827" },
  { nome: "Amarelo", hex: "#facc15" },
  { nome: "Rosa", hex: "#f472b6" },
  { nome: "Azul", hex: "#60a5fa" },
];

const MEDIDAS_LISTA = [...ORDEM_MEDIDAS.map((k) => ({ valor: k, rotulo: MEDIDAS_IMPRESSAO[k].nome })), { valor: "outra", rotulo: "Outra medida" }];

export default function ImpressaoFotos() {
  const [salvo, set] = useConfigSalva<ConfigImpressaoFotos>("preimpressao.impressaofotos.config.v1", configImpressaoFotosPadrao);
  const cfg = useMemo<ConfigImpressaoFotos>(() => ({ ...configImpressaoFotosPadrao, ...salvo, texto: { ...configImpressaoFotosPadrao.texto, ...salvo.texto } }), [salvo]);
  const { itens, setItens, erro: erroFotos, receber, mudar, remover } = useListaDeFotos();
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [montserrat, setMontserrat] = useState<FontesExternas | null>(null);
  const [caveat, setCaveat] = useState<FontePolaroid | null>(null);
  const [recortes, setRecortes] = useState<Map<string, Imagem>>(new Map());
  const [pdf, setPdf] = useState<FotosImpressas | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [qtdTodas, setQtdTodas] = useState(1);
  const cache = useRef(new Map<string, Imagem>());

  useEffect(() => {
    void carregarFontes().then(setMontserrat);
    void carregarFonteManuscrita().then(setCaveat);
  }, []);

  const papel = PAPEIS_IMPRESSAO[cfg.papel] ?? PAPEIS_IMPRESSAO.a4;
  const outra = medidaDe("outra", cfg);

  // Itens no formato da biblioteca (com o tamanho da foto original, para saber se é em pé ou deitada)
  const itensLib = useMemo<ItemImpressao[]>(
    () => itens.map((i) => ({ id: i.id, arquivo: i.foto.nome, qtd: i.qtd, legenda: i.legenda, medida: i.medida, orient: i.orient, fw: i.foto.w, fh: i.foto.h })),
    [itens],
  );
  const pecas = useMemo(() => pecasDoLote(cfg, itensLib), [cfg, itensLib]);
  const encaixe = useMemo(() => encaixarMelhor(cfg, pecas), [cfg, pecas]);
  const comparacao = useMemo(() => compararPapeis(cfg, pecas), [cfg, pecas]);
  const total = itens.reduce((a, i) => a + i.qtd, 0);

  // Recorte + filtro de cada foto, na proporção da medida dela (em cache)
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      const novo = new Map<string, Imagem>();
      for (const [n, i] of itens.entries()) {
        const g = geometriaDoItem(cfg, itensLib[n]);
        const filtro = filtroDoItem(i, cfg.filtro);
        const aspecto = cfg.ajuste === "preencher" ? g.iw / g.ih : i.foto.w / i.foto.h;
        const maxLado = Math.min(3200, Math.round((Math.max(g.iw, g.ih) / 25.4) * 320));
        const k = `${i.id}|${aspecto.toFixed(4)}|${filtro}|${maxLado}|${i.ajuste.zoom}|${i.ajuste.x}|${i.ajuste.y}`;
        let img = cache.current.get(k);
        if (!img) {
          try {
            img = await prepararFotoPolaroid(i.foto, aspecto, cfg.ajuste === "preencher" ? i.ajuste : AJUSTE_PADRAO, filtro, maxLado);
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
  }, [itens, itensLib, cfg]);

  // PDF
  useEffect(() => {
    if (!itens.length) {
      setPdf(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(() => {
      gerarImpressaoFotos({ cfg, itens: itensLib, fotos: recortes, fontes: { montserrat, caveat } })
        .then((r) => {
          if (!vivo) return;
          setPdf(r);
          setErro(null);
        })
        .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível montar as fotos."))
        .finally(() => vivo && setGerando(false));
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [itens.length, itensLib, cfg, recortes, montserrat, caveat]);

  const conferencia = useMemo(() => conferirImpressaoFotos({ cfg, itens: itens.map((i, n) => ({ ...itensLib[n], zoom: i.ajuste.zoom })) }), [cfg, itens, itensLib]);

  const ajustandoIdx = itens.findIndex((i) => i.id === ajustando);
  const ajustandoItem = ajustandoIdx >= 0 ? itens[ajustandoIdx] : undefined;
  const geoAjuste = ajustandoIdx >= 0 ? geometriaDoItem(cfg, itensLib[ajustandoIdx]) : null;

  const esquerda = (
    <Painel className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Impressão de fotos</h2>
        <p className="text-sm text-muted-foreground">Solte as fotos do cliente, escolha a medida e o sistema encaixa nas folhas, com marcas de corte.</p>
      </div>
      <NotaPrivacidade />

      <Campo titulo="1. Fotos do cliente" ajuda="Cada foto pode ter medida, orientação, cópias, filtro e texto próprios. Em “Enquadrar” você escolhe a parte da foto que fica.">
        <SoltarArquivo
          titulo="Solte as fotos aqui"
          dica="JPG, PNG ou WebP"
          arquivo={itens.length ? { nome: `${itens.length} foto(s)`, detalhe: `${total} cópia(s) no total` } : null}
          aceita="image/*"
          multiplo
          erro={erroFotos}
          onArquivos={(f) => void receber(f)}
        />
      </Campo>

      {itens.length > 0 && (
        <>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-2xl bg-muted/40 p-2">
            {itens.map((i) => (
              <LinhaDeFoto
                key={i.id}
                item={i}
                rotuloLegenda="Texto na foto"
                placeholderLegenda={textoDoItem({ legenda: "" }, cfg) || "Texto na foto (opcional)"}
                medidas={MEDIDAS_LISTA}
                onMudar={(p) => mudar(i.id, p)}
                onRemover={() => remover(i.id)}
                onEnquadrar={() => setAjustando(i.id)}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-36">
              <Passo valor={String(qtdTodas)} onChange={(v) => setQtdTodas(num(v, qtdTodas, 1, MAX_COPIAS_IMPRESSAO))} min={1} max={MAX_COPIAS_IMPRESSAO} rotulo="cópias de cada" largura="w-8" />
            </div>
            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setItens((p) => p.map((i) => ({ ...i, qtd: qtdTodas })))}>
              Cópias em todas
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setItens([])}>
              Limpar
            </Button>
          </div>
        </>
      )}

      <Campo titulo="2. Medida da foto" ajuda={`${medidaDe(cfg.medida, cfg).nome} cm. É a medida de todas as fotos; use o seletor de cada foto para uma medida diferente.`}>
        <div className="space-y-3">
          <Pilulas valor={cfg.medida} opcoes={MEDIDAS_LISTA} onChange={(v: string) => set("medida", v)} />
          {cfg.medida === "outra" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Lado curto</p>
                <Passo valor={String(outra.w / 10).replace(".", ",")} onChange={(v) => set("outraW", Math.round(num(v, outra.w / 10, 1, 100) * 100) / 10)} passo={0.5} min={1} max={100} sufixo="cm" rotulo="lado curto" largura="w-10" />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Lado comprido</p>
                <Passo valor={String(outra.h / 10).replace(".", ",")} onChange={(v) => set("outraH", Math.round(num(v, outra.h / 10, 1, 100) * 100) / 10)} passo={0.5} min={1} max={100} sufixo="cm" rotulo="lado comprido" largura="w-10" />
              </div>
            </div>
          )}
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Em pé ou deitada</p>
            <Segmentado
              valor={cfg.orientacao}
              opcoes={[
                { valor: "auto" as Orientacao, rotulo: "Automática" },
                { valor: "retrato" as Orientacao, rotulo: "Em pé" },
                { valor: "paisagem" as Orientacao, rotulo: "Deitada" },
              ]}
              onChange={(v: Orientacao) => set("orientacao", v)}
            />
            <p className="mt-1 text-xs text-muted-foreground">Automática: foto em pé sai em pé (10×15) e foto deitada sai deitada (15×10).</p>
          </div>
        </div>
      </Campo>

      <Campo titulo="3. Folha" ajuda="O sistema encaixa as fotos do melhor jeito, girando as que couberem melhor. Papel fotográfico: sem margem e sem marcas.">
        <div className="space-y-3">
          <Pilulas valor={cfg.papel} opcoes={ORDEM_PAPEIS.map((k) => ({ valor: k, rotulo: PAPEIS_IMPRESSAO[k].nome }))} onChange={(v: string) => set("papel", v)} />
          {comparacao.length > 0 && (
            <div className="space-y-1 rounded-2xl bg-muted/40 p-3">
              <p className="text-xs font-medium text-foreground">Qual folha rende mais?</p>
              {comparacao.slice(0, 5).map((c, n) => (
                <button
                  key={c.papel}
                  type="button"
                  onClick={() => set("papel", c.papel)}
                  className={cn("flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-xs transition-colors hover:bg-background", c.papel === cfg.papel && "bg-background ring-1 ring-primary/40")}
                >
                  <span className="font-medium">
                    {c.nome}
                    {n === 0 && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">menos folhas</span>}
                  </span>
                  <span className="text-muted-foreground">
                    {c.folhas} folha{c.folhas > 1 ? "s" : ""} · {Math.round(c.aproveitamento * 100)}% aproveitado
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Campo>

      {!papel.foto && (
        <Campo titulo="4. Corte" ajuda="Marcas de corte: um espaço de 4 mm entre as fotos, com traços nos cantos. Contorno fino: fotos encostadas, uma linha em volta.">
          <div className="space-y-3">
            <Segmentado
              valor={cfg.corte}
              opcoes={[
                { valor: "marcas" as CorteFotos, rotulo: "Marcas de corte" },
                { valor: "contorno" as CorteFotos, rotulo: "Contorno fino" },
                { valor: "nenhuma" as CorteFotos, rotulo: "Sem linhas" },
              ]}
              onChange={(v: CorteFotos) => set("corte", v)}
            />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Margem da folha</p>
              <Segmentado
                valor={String(cfg.margem)}
                opcoes={[
                  { valor: "5", rotulo: "5 mm" },
                  { valor: "6", rotulo: "6 mm" },
                  { valor: "8", rotulo: "8 mm" },
                  { valor: "10", rotulo: "10 mm" },
                ]}
                onChange={(v) => set("margem", Number(v))}
              />
            </div>
          </div>
        </Campo>
      )}

      <Campo titulo="5. Como a foto entra" ajuda="Preencher corta o excesso (você ajusta em Enquadrar). Inteira mostra a foto toda, com bordas brancas se a proporção for diferente.">
        <div className="space-y-3">
          <Segmentado
            valor={cfg.ajuste}
            opcoes={[
              { valor: "preencher" as AjusteDaFoto, rotulo: "Preencher" },
              { valor: "inteira" as AjusteDaFoto, rotulo: "Foto inteira" },
            ]}
            onChange={(v: AjusteDaFoto) => set("ajuste", v)}
          />
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Borda branca em volta da foto</p>
            <Passo valor={String(cfg.bordaMm)} onChange={(v) => set("bordaMm", num(v, cfg.bordaMm, 0, 20))} passo={1} min={0} max={20} sufixo="mm" rotulo="borda" />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Ajuste de cor (para todas)</p>
            <Pilulas valor={cfg.filtro} opcoes={FILTROS} onChange={(v: FiltroFoto) => set("filtro", v)} />
          </div>
        </div>
      </Campo>

      <Campo titulo="6. Texto na foto" ajuda="Escreva o texto em cada foto (acima) ou um texto para todas aqui. Vazio = sem texto.">
        <div className="space-y-3">
          <input
            value={cfg.texto.padrao}
            onChange={(e) => set("texto", { ...cfg.texto, padrao: e.target.value.slice(0, 80) })}
            placeholder="Texto para todas (ex.: Formatura 2026)"
            aria-label="Texto para todas as fotos"
            className="h-10 w-full rounded-full bg-muted/60 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Letra</p>
            <Segmentado
              valor={cfg.texto.fonte}
              opcoes={[
                { valor: "moderna" as FonteTexto, rotulo: "Moderna" },
                { valor: "manuscrita" as FonteTexto, rotulo: "De mão" },
                { valor: "classica" as FonteTexto, rotulo: "Clássica" },
              ]}
              onChange={(v: FonteTexto) => set("texto", { ...cfg.texto, fonte: v })}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Estilo</p>
            <Segmentado
              valor={cfg.texto.estilo}
              opcoes={[
                { valor: "sombra" as EstiloTexto, rotulo: "Com sombra" },
                { valor: "faixaEscura" as EstiloTexto, rotulo: "Faixa escura" },
                { valor: "faixaClara" as EstiloTexto, rotulo: "Faixa clara" },
              ]}
              onChange={(v: EstiloTexto) => set("texto", { ...cfg.texto, estilo: v })}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Onde</p>
            <Segmentado
              valor={cfg.texto.posicao}
              opcoes={[
                { valor: "baixo" as PosicaoTexto, rotulo: "Embaixo" },
                { valor: "centro" as PosicaoTexto, rotulo: "No meio" },
                { valor: "cima" as PosicaoTexto, rotulo: "Em cima" },
              ]}
              onChange={(v: PosicaoTexto) => set("texto", { ...cfg.texto, posicao: v })}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Tamanho da letra</p>
            <Passo valor={String(cfg.texto.tamMm)} onChange={(v) => set("texto", { ...cfg.texto, tamMm: num(v, cfg.texto.tamMm, 3, 30) })} passo={1} min={3} max={30} sufixo="mm" rotulo="tamanho da letra" />
          </div>
          {cfg.texto.estilo === "sombra" && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Cor da letra</p>
              <SeletorCor valor={cfg.texto.cor} sugestoes={CORES_TEXTO} onChange={(v) => set("texto", { ...cfg.texto, cor: v })} />
            </div>
          )}
        </div>
      </Campo>
    </Painel>
  );

  const direita = (
    <>
      <Painel className="space-y-4">
        <PreviaPdf bytes={pdf?.bytes ?? null} paginas={pdf?.folhas ?? 0} rotulos={(n) => `Folha ${n + 1}`} pagina={pagina} onPagina={setPagina} ocupado={gerando} vazio="Solte as fotos para ver as folhas" />
        {itens.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{total}</span> foto(s) em <span className="font-medium text-foreground">{encaixe.folhas.length}</span> folha(s) {papel.nome} · <span className="font-medium text-foreground">{Math.round(encaixe.aproveitamento * 100)}%</span> aproveitado
          </p>
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
        </ul>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </Painel>

      <Painel className="space-y-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Como imprimir</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>No driver da impressora, escolha o papel da folha e <span className="font-medium text-foreground">tamanho real (100%)</span>, sem “ajustar à página”.</li>
          <li>Papel fotográfico ou couchê brilhante dão o melhor resultado.</li>
          <li>Corte pelas marcas dos cantos (guilhotina): primeiro as fileiras, depois cada foto.</li>
        </ol>
      </Painel>
    </>
  );

  const rodape = (
    <div className="flex flex-wrap items-center gap-2">
      <Button className="rounded-full" onClick={() => pdf && baixarBlob(new Blob([pdf.bytes], { type: "application/pdf" }), "Fotos.pdf")} disabled={!pdf || !pdf.folhas || gerando}>
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
        aspecto={geoAjuste ? geoAjuste.iw / geoAjuste.ih : 1}
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
