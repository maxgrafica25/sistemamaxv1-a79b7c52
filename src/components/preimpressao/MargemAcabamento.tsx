// Pré-impressão → ferramenta "Margem de acabamento".
// Acrescenta faixas K50 FORA da arte de banners/faixas de lona para marcar o corte.
// Tudo no navegador: os arquivos nunca saem do computador.

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, FileArchive, Loader2, Lock, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  LIMITE_ACROBAT_CM,
  PECAS,
  detectarTipo,
  dpiEfetivo,
  formatarAntesDepois,
  imagemParaPdf,
  lerInfoImagem,
  margensPara,
  nomeResultado,
  planejarImagem,
  processarPdf,
  type InfoImagem,
  type Peca,
  type TipoArquivo,
} from "@/lib/preimpressao/margem";
import { baixarBlob, baixarZip, imagemMesmoFormato, miniaturaImagem, miniaturaPdf } from "@/lib/preimpressao/navegador";

// ─── Configuração (guardada no navegador) ────────────────────────────

type Saida = "mesmo" | "pdf";

interface Config {
  peca: Peca;
  cm: string;
  saida: Saida;
}

const CONFIG_KEY = "preimpressao.margem-acabamento.config.v1";
const CONFIG_PADRAO: Config = { peca: "banner", cm: "10", saida: "mesmo" };

function lerConfig(): Config {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return CONFIG_PADRAO;
    const c = JSON.parse(raw) as Partial<Config>;
    return {
      peca: PECAS.some((p) => p.key === c.peca) ? (c.peca as Peca) : CONFIG_PADRAO.peca,
      cm: typeof c.cm === "string" && c.cm.trim() ? c.cm : CONFIG_PADRAO.cm,
      saida: c.saida === "pdf" ? "pdf" : "mesmo",
    };
  } catch {
    return CONFIG_PADRAO;
  }
}

function numero(s: string): number {
  return Number.parseFloat(s.replace(",", ".").trim());
}

const MAX_CM = 500;
function cmValido(s: string): number | null {
  const v = numero(s);
  return Number.isFinite(v) && v > 0 && v <= MAX_CM ? v : null;
}

// ─── Itens da lista ──────────────────────────────────────────────────

type Status = "processando" | "pronto" | "falta_medida" | "erro";

interface Item {
  id: string;
  nome: string;
  file: File;
  tipo: TipoArquivo;
  bytes?: Uint8Array;
  info?: InfoImagem;
  /** Largura real digitada pelo usuário (texto do campo). */
  larguraCm: string;
  status: Status;
  erro?: string;
  avisos: string[];
  medidas?: string;
  paginas?: number;
  resultado?: { blob: Blob; nome: string };
  thumb?: string;
}

const MSG_CDR =
  "Arquivo do Corel (.cdr) não pode ser lido aqui. No CorelDRAW use Arquivo → Exportar… → PDF e envie o PDF.";

let seq = 0;
const novoId = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`;

async function prepararItem(file: File): Promise<Item> {
  const base: Item = { id: novoId(), nome: file.name, file, tipo: "desconhecido", larguraCm: "", status: "processando", avisos: [] };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const tipo = detectarTipo(bytes, file.name);
    if (tipo === "cdr") return { ...base, tipo, status: "erro", erro: MSG_CDR };
    if (tipo === "desconhecido")
      return { ...base, tipo, status: "erro", erro: "Formato não suportado. Envie PDF, PNG ou JPG." };
    if (tipo === "pdf") return { ...base, tipo, bytes };
    const info = lerInfoImagem(bytes, tipo);
    return { ...base, tipo, bytes, info };
  } catch (e) {
    return { ...base, status: "erro", erro: e instanceof Error ? e.message : "Não consegui ler o arquivo." };
  }
}

/** Processa um item com a configuração atual. Retorna só os campos que mudam. */
async function processarItem(item: Item, cfg: { peca: Peca; cm: number; saida: Saida }): Promise<Partial<Item>> {
  const m = margensPara(cfg.peca, cfg.cm);
  const avisos: string[] = [];
  const limite = `Passa de ${LIMITE_ACROBAT_CM} cm de lado: o Acrobat não abre páginas maiores (o RIP pode abrir).`;

  if (item.tipo === "pdf" && item.bytes) {
    const r = await processarPdf(item.bytes, m);
    if (r.passaLimite) avisos.push(limite);
    const blob = new Blob([r.bytes], { type: "application/pdf" });
    const thumb = await miniaturaPdf(r.bytes).catch(() => undefined);
    return {
      status: "pronto",
      erro: undefined,
      avisos,
      medidas: formatarAntesDepois(r.paginas[0].antes, r.paginas[0].depois),
      paginas: r.paginas.length,
      resultado: { blob, nome: nomeResultado(item.nome, "pdf") },
      thumb,
    };
  }

  const info = item.info;
  if (!info || !item.bytes) throw new Error("Arquivo não carregado.");
  const largura = item.larguraCm.trim() ? numero(item.larguraCm) : null;
  if (largura !== null && !(largura > 0)) {
    return { status: "falta_medida", erro: "Digite a largura real do banner em cm.", resultado: undefined, medidas: undefined, thumb: undefined, avisos };
  }
  const dpi = dpiEfetivo(info, largura);
  if (!dpi) {
    return {
      status: "falta_medida",
      erro: "O arquivo não informa o tamanho (sem DPI). Digite a largura real do banner em cm.",
      resultado: undefined,
      medidas: undefined,
      thumb: undefined,
      avisos,
    };
  }
  const plano = planejarImagem(info, m, dpi);
  const medidas = formatarAntesDepois(plano.antes, plano.depois);
  if (plano.depois.w > LIMITE_ACROBAT_CM || plano.depois.h > LIMITE_ACROBAT_CM) avisos.push(limite);

  const emPdf = cfg.saida === "pdf" || info.cmyk;
  if (info.cmyk && cfg.saida !== "pdf") avisos.push("JPG em CMYK: salvo como PDF para manter as cores.");

  if (emPdf) {
    const r = await imagemParaPdf(item.bytes, info, m, dpi);
    const blob = new Blob([r.bytes], { type: "application/pdf" });
    const thumb = await miniaturaPdf(r.bytes).catch(() => undefined);
    return { status: "pronto", erro: undefined, avisos, medidas, paginas: 1, resultado: { blob, nome: nomeResultado(item.nome, "pdf") }, thumb };
  }

  const blob = await imagemMesmoFormato(item.file, info, plano);
  const thumb = await miniaturaImagem(blob, plano.larguraFinalPx, plano.alturaFinalPx).catch(() => undefined);
  return { status: "pronto", erro: undefined, avisos, medidas, paginas: 1, resultado: { blob, nome: nomeResultado(item.nome) }, thumb };
}

// ─── Componente ──────────────────────────────────────────────────────

export default function MargemAcabamento() {
  const [config, setConfig] = useState<Config>(lerConfig);
  const [items, setItems] = useState<Item[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [zipando, setZipando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Itens atuais (para os processamentos assíncronos lerem o estado mais novo)
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  // Versão por item: resultado de um processamento antigo é descartado
  const versoes = useRef(new Map<string, number>());
  // Fila: um arquivo de cada vez, para não estourar a memória com lonas enormes
  const fila = useRef<Promise<void>>(Promise.resolve());

  const cmNum = cmValido(config.cm);
  // Medida "assentada" (espera o usuário parar de digitar)
  const [cmAplicado, setCmAplicado] = useState<number | null>(cmNum);
  useEffect(() => {
    const t = setTimeout(() => setCmAplicado(cmNum), 400);
    return () => clearTimeout(t);
  }, [cmNum]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      /* navegador sem localStorage */
    }
  }, [config]);

  const atualizar = useCallback((id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const cfgRef = useRef({ peca: config.peca, cm: cmAplicado, saida: config.saida });
  cfgRef.current = { peca: config.peca, cm: cmAplicado, saida: config.saida };

  const agendar = useCallback(
    (id: string) => {
      const versao = (versoes.current.get(id) ?? 0) + 1;
      versoes.current.set(id, versao);
      const atual = itemsRef.current.find((i) => i.id === id);
      if (!atual || !atual.bytes) return;
      if (cfgRef.current.cm === null) return;
      atualizar(id, { status: "processando" });
      fila.current = fila.current.then(async () => {
        if (versoes.current.get(id) !== versao) return; // já tem pedido mais novo
        const item = itemsRef.current.find((i) => i.id === id);
        const cfg = cfgRef.current;
        if (!item || cfg.cm === null) return;
        let patch: Partial<Item>;
        try {
          patch = await processarItem(item, { peca: cfg.peca, cm: cfg.cm, saida: cfg.saida });
        } catch (e) {
          patch = {
            status: "erro",
            erro: e instanceof Error ? e.message : "Erro ao processar o arquivo.",
            resultado: undefined,
            thumb: undefined,
          };
        }
        if (versoes.current.get(id) === versao) atualizar(id, patch);
      });
    },
    [atualizar],
  );

  // Mudou a configuração → reprocessa tudo que já está carregado
  useEffect(() => {
    for (const it of itemsRef.current) agendar(it.id);
  }, [config.peca, config.saida, cmAplicado, agendar]);

  const adicionar = useCallback(
    async (files: FileList | File[]) => {
      const lista = Array.from(files);
      if (!lista.length) return;
      const novos = await Promise.all(lista.map(prepararItem));
      itemsRef.current = [...itemsRef.current, ...novos];
      setItems((prev) => [...prev, ...novos]);
      for (const n of novos) if (n.status !== "erro") agendar(n.id);
    },
    [agendar],
  );

  const remover = (id: string) => {
    versoes.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const mudarLargura = (id: string, valor: string) => {
    itemsRef.current = itemsRef.current.map((i) => (i.id === id ? { ...i, larguraCm: valor } : i));
    atualizar(id, { larguraCm: valor });
  };

  // Largura digitada → reprocessa aquele arquivo depois de uma pausa
  const timersLargura = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const aoDigitarLargura = (id: string, valor: string) => {
    mudarLargura(id, valor);
    const t = timersLargura.current.get(id);
    if (t) clearTimeout(t);
    timersLargura.current.set(
      id,
      setTimeout(() => agendar(id), 500),
    );
  };

  const prontos = items.filter((i) => i.status === "pronto" && i.resultado);

  const baixarTodos = async () => {
    setZipando(true);
    try {
      await baixarZip(
        prontos.map((i) => ({ nome: i.resultado!.nome, blob: i.resultado!.blob })),
        "margem_acabamento.zip",
      );
    } finally {
      setZipando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Configuração */}
      <Card>
        <CardContent className="pt-6 grid gap-5 md:grid-cols-[auto_auto_auto_1fr] md:items-end">
          <div className="space-y-2">
            <Label>Peça</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={config.peca}
              onValueChange={(v) => v && setConfig((c) => ({ ...c, peca: v as Peca }))}
              className="justify-start flex-wrap"
            >
              {PECAS.map((p) => (
                <ToggleGroupItem key={p.key} value={p.key} className="text-xs sm:text-sm">
                  {p.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="margem-cm">Medida (cm)</Label>
            <Input
              id="margem-cm"
              inputMode="decimal"
              className={cn("w-24", cmNum === null && "border-destructive")}
              value={config.cm}
              onChange={(e) => setConfig((c) => ({ ...c, cm: e.target.value }))}
            />
            {cmNum === null && <p className="text-xs text-destructive">Digite uma medida entre 0 e {MAX_CM} cm.</p>}
          </div>

          <div className="space-y-2">
            <Label>Salvar como</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={config.saida}
              onValueChange={(v) => v && setConfig((c) => ({ ...c, saida: v as Saida }))}
              className="justify-start flex-wrap"
            >
              <ToggleGroupItem value="mesmo" className="text-xs sm:text-sm">Mesmo formato do arquivo</ToggleGroupItem>
              <ToggleGroupItem value="pdf" className="text-xs sm:text-sm">Sempre PDF</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label>Cor da faixa</Label>
            <div className="flex items-center gap-2 h-10">
              <span className="h-8 w-8 rounded border border-border shrink-0" style={{ background: "#808080" }} aria-hidden />
              <span className="text-sm">
                CMYK C0 M0 Y0 K50 <span className="text-muted-foreground">(fixa)</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Área de arrastar e soltar */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          void adicionar(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          arrastando ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Arraste aqui os arquivos do banner ou da faixa (PDF, PNG ou JPG)</p>
        <p className="text-xs text-muted-foreground">Pode soltar vários de uma vez. A arte precisa estar no tamanho final (escala 1:1).</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => inputRef.current?.click()}>
          Escolher arquivos
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.cdr,application/pdf,image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void adicionar(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="mt-4 text-xs text-muted-foreground">
          Arquivo do Corel (.cdr)? Exporte como PDF antes (Arquivo → Exportar… → PDF).
        </p>
        <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> Os arquivos são processados aqui no seu computador. Nada é enviado para a internet.
        </p>
      </div>

      {/* Resultados */}
      {items.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-semibold">
                Arquivos ({prontos.length} de {items.length} prontos)
              </h2>
              <div className="flex gap-2">
                {prontos.length > 1 && (
                  <Button size="sm" onClick={baixarTodos} disabled={zipando}>
                    {zipando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                    Baixar todos (.zip)
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setItems([])}>
                  Limpar lista
                </Button>
              </div>
            </div>
            <ul className="divide-y divide-border">
              {items.map((it) => (
                <LinhaArquivo
                  key={it.id}
                  item={it}
                  onLargura={(v) => aoDigitarLargura(it.id, v)}
                  onRemover={() => remover(it.id)}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "processando")
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Processando
      </Badge>
    );
  if (status === "pronto") return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Pronto</Badge>;
  if (status === "falta_medida") return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Falta a medida</Badge>;
  return <Badge variant="destructive">Erro</Badge>;
}

function LinhaArquivo({ item, onLargura, onRemover }: { item: Item; onLargura: (v: string) => void; onRemover: () => void }) {
  const imagem = item.tipo === "png" || item.tipo === "jpg";
  const info = item.info;
  const larguraArquivo = info?.dpi ? (info.larguraPx / info.dpi) * 2.54 : null;
  return (
    <li className="flex gap-3 py-3 items-start">
      <div className="h-20 w-20 shrink-0 rounded border border-border bg-muted/40 flex items-center justify-center overflow-hidden">
        {item.thumb ? (
          <img src={item.thumb} alt="" className="max-h-full max-w-full object-contain" />
        ) : item.status === "processando" ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-[10px] uppercase text-muted-foreground">{item.tipo === "desconhecido" ? "?" : item.tipo}</span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate max-w-full" title={item.nome}>{item.nome}</span>
          <StatusBadge status={item.status} />
        </div>
        {item.medidas && (
          <p className="text-sm tabular-nums">
            {item.medidas}
            {item.paginas && item.paginas > 1 && <span className="text-muted-foreground"> · {item.paginas} páginas</span>}
          </p>
        )}
        {info && (
          <p className="text-xs text-muted-foreground">
            {info.larguraPx} × {info.alturaPx} px · {info.dpi ? `${Math.round(info.dpi)} dpi` : "sem DPI no arquivo"}
            {info.cmyk && " · CMYK"}
          </p>
        )}
        {item.erro && <p className={cn("text-xs", item.status === "erro" ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>{item.erro}</p>}
        {item.avisos.map((a) => (
          <p key={a} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {a}
          </p>
        ))}
        {imagem && info && (
          <div className="flex items-center gap-2 pt-1">
            <Label htmlFor={`larg-${item.id}`} className="text-xs font-normal whitespace-nowrap">
              {info.dpi ? "Corrigir largura real (cm)" : "Largura real do banner (cm)"}
            </Label>
            <Input
              id={`larg-${item.id}`}
              inputMode="decimal"
              className={cn("h-8 w-24 text-sm", item.status === "falta_medida" && "border-amber-500")}
              placeholder={larguraArquivo ? larguraArquivo.toFixed(1).replace(".", ",") : "ex.: 90"}
              value={item.larguraCm}
              onChange={(e) => onLargura(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-1 shrink-0">
        <Button
          size="sm"
          disabled={item.status !== "pronto" || !item.resultado}
          onClick={() => item.resultado && baixarBlob(item.resultado.blob, item.resultado.nome)}
        >
          <Download className="h-4 w-4" /> Baixar
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemover} aria-label={`Remover ${item.nome}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
