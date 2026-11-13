// Pré-impressão → ferramenta "Fotos 3×4" (fotos de documento no balcão).
// Solta as fotos dos clientes (uma ou várias pessoas), escolhe quantas cópias de cada uma e o sistema
// monta na folha no tamanho exato, com linhas de corte. Tudo no navegador, sem custo.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Download, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Imagem } from "@/lib/preimpressao/agenda";
import { AJUSTE_PADRAO } from "@/lib/preimpressao/cracha";
import { baixarBlob } from "@/lib/preimpressao/navegador";
import {
  MAX_COPIAS_FOTO,
  PAPEIS_FOTO,
  TAMANHOS_FOTO,
  conferirFotosDoc,
  configFotoDocPadrao,
  gerarFotosDoc,
  medidaDaFoto,
  planejarGrade,
  resumoFoto,
  type ConfigFotoDoc,
  type FotosGeradas,
  type LinhasDeCorte,
  type PapelFoto,
  type TamanhoFoto,
} from "@/lib/preimpressao/fotoDoc";
import { completarFolha, FILTROS, filtroDoItem, type FiltroFoto } from "@/lib/preimpressao/polaroid";
import { prepararFotoPolaroid } from "@/lib/preimpressao/polaroidNavegador";
import { CrachaFotoAjuste } from "./CrachaFotoAjuste";
import { LinhaDeFoto } from "./ListaDeFotos";
import { Campo, DuasColunas, NotaPrivacidade, Painel, Passo, Pilulas, PreviaPdf, Segmentado, SoltarArquivo } from "./ui";
import { useConfigSalva } from "./uteis";
import { useListaDeFotos } from "./useListaDeFotos";

const num = (v: string, atual: number, min: number, max: number) => {
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : atual;
};

export default function Fotos3x4() {
  const [salvo, set] = useConfigSalva<ConfigFotoDoc>("preimpressao.fotodoc.config.v1", configFotoDocPadrao);
  const cfg = useMemo<ConfigFotoDoc>(() => ({ ...configFotoDocPadrao, ...salvo }), [salvo]);
  const { itens, setItens, erro: erroFotos, receber, mudar, remover } = useListaDeFotos();
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [recortes, setRecortes] = useState<Map<string, Imagem>>(new Map());
  const [pdf, setPdf] = useState<FotosGeradas | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [qtdTodas, setQtdTodas] = useState(6);
  const cache = useRef(new Map<string, Imagem>());

  const medida = medidaDaFoto(cfg);
  const aspecto = medida.w / medida.h;
  const grade = planejarGrade(cfg);
  const total = itens.reduce((a, i) => a + i.qtd, 0);
  const resumo = resumoFoto(cfg, total);

  // Recorte + filtro de cada foto (em cache); a foto vai com até 1,2× 300 dpi
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      const novo = new Map<string, Imagem>();
      const maxLado = Math.min(2400, Math.round((Math.max(medida.w, medida.h) / 25.4) * 320));
      for (const i of itens) {
        const filtro = filtroDoItem(i, cfg.filtro);
        const k = `${i.id}|${aspecto}|${filtro}|${maxLado}|${i.ajuste.zoom}|${i.ajuste.x}|${i.ajuste.y}`;
        let img = cache.current.get(k);
        if (!img) {
          try {
            img = await prepararFotoPolaroid(i.foto, aspecto, i.ajuste, filtro, maxLado);
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
  }, [itens, aspecto, cfg.filtro, medida.w, medida.h]);

  const itensPdf = useMemo(() => itens.map((i) => ({ id: i.id, arquivo: i.foto.nome, qtd: i.qtd })), [itens]);

  useEffect(() => {
    if (!itens.length) {
      setPdf(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(() => {
      gerarFotosDoc({ cfg, itens: itensPdf, fotos: recortes })
        .then((r) => {
          if (!vivo) return;
          setPdf(r);
          setErro(null);
        })
        .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível montar as fotos."))
        .finally(() => vivo && setGerando(false));
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [itens.length, itensPdf, cfg, recortes]);

  const conferencia = useMemo(
    () => conferirFotosDoc({ cfg, itens: itens.map((i) => ({ id: i.id, arquivo: i.foto.nome, qtd: i.qtd, w: i.foto.w, h: i.foto.h, zoom: i.ajuste.zoom })) }),
    [cfg, itens],
  );

  const ajustandoItem = itens.find((i) => i.id === ajustando);
  const completar = () => {
    const mais = completarFolha(itens.map((i) => i.qtd), grade.porFolha);
    setItens((prev) => prev.map((i, k) => ({ ...i, qtd: Math.min(MAX_COPIAS_FOTO, i.qtd + mais[k]) })));
  };

  const esquerda = (
    <Painel className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Fotos 3×4</h2>
        <p className="text-sm text-muted-foreground">Monta as fotos de documento na folha, no tamanho exato e com linhas de corte.</p>
      </div>
      <NotaPrivacidade />

      <Campo titulo="1. Fotos" ajuda="Uma ou várias pessoas de uma vez. Para cada uma, escolha as cópias e centralize o rosto em “Enquadrar”.">
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
          <div className="max-h-96 space-y-2 overflow-y-auto rounded-2xl bg-muted/40 p-2">
            {itens.map((i) => (
              <LinhaDeFoto key={i.id} item={i} comLegenda={false} onMudar={(p) => mudar(i.id, p)} onRemover={() => remover(i.id)} onEnquadrar={() => setAjustando(i.id)} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" className="rounded-full" onClick={completar} disabled={resumo.sobram === 0}>
              Completar a folha{resumo.sobram ? ` (+${resumo.sobram})` : ""}
            </Button>
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="w-36">
              <Passo valor={String(qtdTodas)} onChange={(v) => setQtdTodas(num(v, qtdTodas, 1, MAX_COPIAS_FOTO))} min={1} max={MAX_COPIAS_FOTO} rotulo="cópias de cada" largura="w-8" />
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

      <Campo titulo="2. Tamanho da foto" ajuda={`${medida.w / 10} × ${medida.h / 10} cm. ${grade.capacidade ? `Cabem ${grade.capacidade} por folha ${PAPEIS_FOTO[cfg.papel].nome}${grade.deitada ? " (folha deitada)" : ""}.` : "Não cabe nessa folha."}`}>
        <div className="space-y-3">
          <Segmentado
            valor={cfg.tamanho}
            opcoes={[
              ...(Object.keys(TAMANHOS_FOTO) as (keyof typeof TAMANHOS_FOTO)[]).map((k) => ({ valor: k as TamanhoFoto, rotulo: TAMANHOS_FOTO[k].nome })),
              { valor: "livre" as TamanhoFoto, rotulo: "Outra medida" },
            ]}
            onChange={(v: TamanhoFoto) => set("tamanho", v)}
          />
          {cfg.tamanho === "livre" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Largura</p>
                <Passo valor={String(cfg.larguraMm / 10).replace(".", ",")} onChange={(v) => set("larguraMm", Math.round(num(v, cfg.larguraMm / 10, 1.5, 15) * 100) / 10)} passo={0.5} min={1.5} max={15} sufixo="cm" rotulo="largura da foto" largura="w-10" />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Altura</p>
                <Passo valor={String(cfg.alturaMm / 10).replace(".", ",")} onChange={(v) => set("alturaMm", Math.round(num(v, cfg.alturaMm / 10, 1.5, 20) * 100) / 10)} passo={0.5} min={1.5} max={20} sufixo="cm" rotulo="altura da foto" largura="w-10" />
              </div>
            </div>
          )}
        </div>
      </Campo>

      <Campo titulo="3. Folha">
        <Pilulas valor={cfg.papel} opcoes={(Object.keys(PAPEIS_FOTO) as PapelFoto[]).map((k) => ({ valor: k, rotulo: PAPEIS_FOTO[k].nome }))} onChange={(v: PapelFoto) => set("papel", v)} />
      </Campo>

      <Campo titulo="4. Quantas por folha" ajuda="“Encher” usa a folha toda. Para poucas fotos, escolha o número e elas ficam no meio da folha.">
        <div className="space-y-3">
          <Segmentado
            valor={cfg.porFolha === 0 ? "encher" : "numero"}
            opcoes={[
              { valor: "encher" as const, rotulo: "Encher a folha" },
              { valor: "numero" as const, rotulo: "Escolher" },
            ]}
            onChange={(v) => set("porFolha", v === "encher" ? 0 : Math.min(6, Math.max(1, grade.capacidade || 6)))}
          />
          {cfg.porFolha > 0 && <Passo valor={String(cfg.porFolha)} onChange={(v) => set("porFolha", Math.round(num(v, cfg.porFolha, 1, Math.max(1, grade.capacidade || 1))))} min={1} max={Math.max(1, grade.capacidade)} rotulo="fotos por folha" largura="w-10" />}
        </div>
      </Campo>

      <Campo titulo="5. Corte" ajuda="Encostadas: um corte só entre as fotos. Com espaço, cada foto leva dois cortes.">
        <div className="space-y-3">
          <Segmentado
            valor={String(cfg.espaco)}
            opcoes={[
              { valor: "0", rotulo: "Encostadas" },
              { valor: "1", rotulo: "1 mm" },
              { valor: "2", rotulo: "2 mm" },
              { valor: "3", rotulo: "3 mm" },
            ]}
            onChange={(v) => set("espaco", Number(v))}
          />
          <Pilulas
            valor={cfg.marcas}
            opcoes={[
              { valor: "cantos" as LinhasDeCorte, rotulo: "Marcas nas margens" },
              { valor: "contorno" as LinhasDeCorte, rotulo: "Contorno fino" },
              { valor: "nenhuma" as LinhasDeCorte, rotulo: "Sem linhas" },
            ]}
            onChange={(v: LinhasDeCorte) => set("marcas", v)}
          />
        </div>
      </Campo>

      <Campo titulo="6. Ajuste da cor" ajuda="Vale para as fotos sem filtro próprio. “Melhorar” corrige foto escura ou lavada; “Preto e branco” para documento em P&B.">
        <Pilulas valor={cfg.filtro} opcoes={FILTROS.filter((f) => ["nenhum", "melhorar", "pb"].includes(f.valor))} onChange={(v: FiltroFoto) => set("filtro", v)} />
      </Campo>
    </Painel>
  );

  const direita = (
    <>
      <Painel className="space-y-4">
        <PreviaPdf bytes={pdf?.bytes ?? null} paginas={pdf?.folhas ?? 0} rotulos={(n) => `Folha ${n + 1}`} pagina={pagina} onPagina={setPagina} ocupado={gerando} vazio="Solte as fotos para ver a folha" />
        {itens.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{total}</span> foto(s) em <span className="font-medium text-foreground">{resumo.folhas}</span> folha(s) {PAPEIS_FOTO[cfg.papel].nome} · {resumo.porFolha} por folha
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
          <li>No driver da impressora, escolha o papel da folha e <span className="font-medium text-foreground">tamanho real (100%)</span>, sem “ajustar à página”.</li>
          <li>Papel fotográfico dá o melhor resultado em foto de documento.</li>
          <li>Corte pelas marcas das margens (guilhotina): primeiro as linhas de um sentido, depois as do outro.</li>
        </ol>
      </Painel>
    </>
  );

  const rodape = (
    <div className="flex flex-wrap items-center gap-2">
      <Button className="rounded-full" onClick={() => pdf && baixarBlob(new Blob([pdf.bytes], { type: "application/pdf" }), "Fotos_3x4.pdf")} disabled={!pdf || !pdf.folhas || gerando}>
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
        guiaRosto
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
