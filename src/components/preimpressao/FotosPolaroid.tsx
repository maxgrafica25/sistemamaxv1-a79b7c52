// Pré-impressão → ferramenta "Fotos Polaroid".
// Solta as fotos do cliente e o sistema monta polaroids (clássica, mini ou quadrada) em folhas A4, com
// moldura colorida, legenda à mão, filtros, enfeites, verso com mensagem/QR e marcas de corte.
// Tudo no navegador, sem custo.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Download, Loader2, Minus, Plus, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Imagem } from "@/lib/preimpressao/agenda";
import { AJUSTE_PADRAO, type AjusteFoto } from "@/lib/preimpressao/cracha";
import { ehImagem, lerFoto } from "@/lib/preimpressao/crachaNavegador";
import { baixarBlob } from "@/lib/preimpressao/navegador";
import {
  FILTROS,
  MAX_COPIAS,
  MOLDURAS,
  POLAROIDS,
  aspectoPolaroid,
  completarFolha,
  configPolaroidPadrao,
  conferirPolaroids,
  gerarPolaroids,
  legendaDoItem,
  planejarFolha,
  resumoDeFolhas,
  type ConfigPolaroid,
  type Enfeite,
  type FiltroFoto,
  type FontePolaroid,
  type PolaroidsGeradas,
  type TamanhoPolaroid,
} from "@/lib/preimpressao/polaroid";
import { carregarFonteManuscrita, prepararFotoPolaroid } from "@/lib/preimpressao/polaroidNavegador";
import { CrachaFotoAjuste } from "./CrachaFotoAjuste";
import { Campo, Chave, DuasColunas, NotaPrivacidade, Painel, PreviaPdf, SeletorCor, Segmentado, SoltarArquivo } from "./ui";
import { useConfigSalva } from "./uteis";

type FotoLida = Awaited<ReturnType<typeof lerFoto>>;

interface ItemUI {
  id: string;
  foto: FotoLida;
  url: string;
  qtd: number;
  legenda: string;
  ajuste: AjusteFoto;
}

let seq = 0;
const novoId = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`;

const ENFEITES: { valor: Enfeite; rotulo: string }[] = [
  { valor: "nenhum", rotulo: "Sem enfeite" },
  { valor: "fita", rotulo: "Fita adesiva" },
  { valor: "coracao", rotulo: "Coração" },
  { valor: "estrela", rotulo: "Estrela" },
];

function Pilulas<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: { valor: T; rotulo: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            valor === o.valor ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground",
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export default function FotosPolaroid() {
  const [cfg, set] = useConfigSalva<ConfigPolaroid>("preimpressao.polaroid.config.v1", configPolaroidPadrao);
  const [itens, setItens] = useState<ItemUI[]>([]);
  const [erroFotos, setErroFotos] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [fonte, setFonte] = useState<FontePolaroid | null>(null);
  const [recortes, setRecortes] = useState<Map<string, Imagem>>(new Map());
  const [pdf, setPdf] = useState<PolaroidsGeradas | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [qtdTodas, setQtdTodas] = useState(1);
  const cache = useRef(new Map<string, Imagem>());
  const urls = useRef<string[]>([]);

  useEffect(() => {
    void carregarFonteManuscrita().then(setFonte);
    const guardadas = urls.current;
    return () => guardadas.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const aspecto = aspectoPolaroid(cfg.tamanho);
  const med = POLAROIDS[cfg.tamanho];
  const plano = planejarFolha(cfg.tamanho);
  const total = itens.reduce((a, i) => a + i.qtd, 0);
  const resumo = resumoDeFolhas(cfg.tamanho, total);

  const receber = async (files: File[]) => {
    const boas = files.filter((f) => ehImagem(f.name) || f.type.startsWith("image/"));
    if (!boas.length) return setErroFotos("Envie fotos em JPG, PNG ou WebP.");
    setErroFotos(null);
    const novos: ItemUI[] = [];
    let falhas = 0;
    for (const f of boas) {
      try {
        const foto = await lerFoto(f);
        const url = URL.createObjectURL(new Blob([foto.bytes], { type: foto.tipo || "image/jpeg" }));
        urls.current.push(url);
        novos.push({ id: novoId(), foto, url, qtd: 1, legenda: "", ajuste: AJUSTE_PADRAO });
      } catch {
        falhas++;
      }
    }
    setItens((p) => [...p, ...novos]);
    if (falhas) setErroFotos(`${falhas} arquivo(s) não abriram como foto.`);
  };

  const mudar = (id: string, p: Partial<ItemUI>) => setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const remover = (id: string) => setItens((prev) => prev.filter((i) => i.id !== id));

  // Recorte + filtro de cada foto (em cache)
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      const novo = new Map<string, Imagem>();
      for (const i of itens) {
        const k = `${i.id}|${aspecto}|${cfg.filtro}|${i.ajuste.zoom}|${i.ajuste.x}|${i.ajuste.y}`;
        let img = cache.current.get(k);
        if (!img) {
          try {
            img = await prepararFotoPolaroid(i.foto, aspecto, i.ajuste, cfg.filtro);
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

  // PDF
  useEffect(() => {
    if (!itens.length) {
      setPdf(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(() => {
      gerarPolaroids({
        cfg,
        itens: itens.map((i) => ({ id: i.id, arquivo: i.foto.nome, qtd: i.qtd, legenda: i.legenda })),
        fotos: recortes,
        fonte,
      })
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
  }, [itens, cfg, recortes, fonte]);

  const conferencia = useMemo(
    () => conferirPolaroids({ cfg, itens: itens.map((i) => ({ id: i.id, arquivo: i.foto.nome, qtd: i.qtd, legenda: i.legenda, w: i.foto.w, h: i.foto.h, zoom: i.ajuste.zoom })) }),
    [cfg, itens],
  );

  const comVerso = !!pdf && pdf.paginas > pdf.folhas;
  const rotulo = (n: number) => (comVerso ? `${n % 2 === 0 ? "Frente" : "Verso"} da folha ${Math.floor(n / 2) + 1}` : `Folha ${n + 1}`);
  const ajustandoItem = itens.find((i) => i.id === ajustando);

  const completar = () => {
    const mais = completarFolha(itens.map((i) => i.qtd), plano.porFolha);
    setItens((prev) => prev.map((i, k) => ({ ...i, qtd: Math.min(MAX_COPIAS, i.qtd + mais[k]) })));
  };

  const esquerda = (
    <Painel className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Fotos Polaroid</h2>
        <p className="text-sm text-muted-foreground">Solte as fotos e o sistema monta as polaroids em folhas A4, já com marcas de corte.</p>
      </div>
      <NotaPrivacidade />

      <Campo titulo="1. Fotos" ajuda="Quantas quiser, de uma vez. Cada uma pode ter legenda, cópias e enquadramento próprios.">
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
              <div key={i.id} className="flex items-center gap-3 rounded-2xl bg-background p-2 ring-1 ring-border/60">
                <img src={i.url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground" title={i.foto.nome}>
                      {i.foto.nome}
                    </p>
                    <button type="button" aria-label={`Remover ${i.foto.nome}`} className="text-muted-foreground hover:text-destructive" onClick={() => remover(i.id)}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    value={i.legenda}
                    onChange={(e) => mudar(i.id, { legenda: e.target.value.slice(0, 60) })}
                    placeholder={legendaDoItem({ id: i.id, arquivo: i.foto.nome, qtd: 1, legenda: "" }, cfg) || "Legenda (opcional)"}
                    aria-label={`Legenda de ${i.foto.nome}`}
                    className="h-8 w-full rounded-full bg-muted/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label="Menos uma cópia" className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/70 hover:bg-muted" onClick={() => mudar(i.id, { qtd: Math.max(1, i.qtd - 1) })}>
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-14 text-center text-sm font-semibold tabular-nums">{i.qtd} cópia{i.qtd > 1 ? "s" : ""}</span>
                      <button type="button" aria-label="Mais uma cópia" className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/70 hover:bg-muted" onClick={() => mudar(i.id, { qtd: Math.min(MAX_COPIAS, i.qtd + 1) })}>
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-xs" onClick={() => setAjustando(i.id)}>
                      Enquadrar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" className="rounded-full" onClick={completar} disabled={resumo.sobram === 0}>
              Completar a folha{resumo.sobram ? ` (+${resumo.sobram})` : ""}
            </Button>
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Menos" className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/70" onClick={() => setQtdTodas((v) => Math.max(1, v - 1))}>
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{qtdTodas}</span>
              <button type="button" aria-label="Mais" className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/70" onClick={() => setQtdTodas((v) => Math.min(MAX_COPIAS, v + 1))}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setItens((p) => p.map((i) => ({ ...i, qtd: qtdTodas })))}>
              Mesma quantidade em todas
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setItens([])}>
              Limpar
            </Button>
          </div>
        </>
      )}

      <Campo titulo="2. Tamanho" ajuda={`${med.nome}: ${med.w} × ${med.h} mm, foto de ${med.foto.w} × ${med.foto.h} mm. Cabem ${plano.porFolha} por folha A4${plano.girada ? " (deitadas)" : ""}.`}>
        <Segmentado
          valor={cfg.tamanho}
          opcoes={[
            { valor: "classica" as const, rotulo: "Clássica" },
            { valor: "mini" as const, rotulo: "Mini" },
            { valor: "quadrada" as const, rotulo: "Quadrada" },
          ]}
          onChange={(v: TamanhoPolaroid) => set("tamanho", v)}
        />
      </Campo>

      <Campo titulo="3. Moldura">
        <SeletorCor valor={cfg.moldura} sugestoes={MOLDURAS} onChange={(v) => set("moldura", v)} />
      </Campo>

      <Campo titulo="4. Filtro nas fotos" ajuda="Vale para todas. Não muda o arquivo original.">
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

      <Campo titulo="6. Verso" ajuda="Mensagem e/ou QR Code atrás de cada polaroid. Imprima em frente e verso, virando pela borda longa: os lugares já saem espelhados.">
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
        <PreviaPdf
          bytes={pdf?.bytes ?? null}
          paginas={pdf?.paginas ?? 0}
          rotulos={rotulo}
          pagina={pagina}
          onPagina={setPagina}
          ocupado={gerando}
          vazio="Solte as fotos para ver as folhas"
        />
        {itens.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{total}</span> polaroid(s) em <span className="font-medium text-foreground">{resumo.folhas}</span> folha(s) A4 · {resumo.porFolha} por folha
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
          <li>Imprima em A4, tamanho real (100%), sem ajustar à página. Papel fotográfico ou couchê ficam melhores.</li>
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
