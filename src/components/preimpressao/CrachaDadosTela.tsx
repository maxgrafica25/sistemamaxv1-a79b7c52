// Crachás → "Modelo com dados".
// Abre um modelo salvo (o visual da empresa) e troca só os dados: foto, nome, cargo e os campos extras
// (tipo sanguíneo, ASO, admissão…). Para uma pessoa é um formulário; para várias é uma tabela em que cada
// linha tem a foto ao lado dos dados, para a foto casar com a pessoa certa. Tudo no navegador, sem custo.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Download, ImagePlus, Loader2, Minus, Plus, Trash2, UserPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AJUSTE_PADRAO,
  LIMITE_PESSOAS,
  LISTA_DE_EXEMPLO,
  acharFoto,
  corDoSetor,
  gerarCartaoDeTeste,
  gerarCartoes,
  gerarProva,
  gerarVerso,
  lerTabela,
  ordenarPessoas,
  pessoasDaTabela,
  semAcento,
  setoresDaLista,
  type AjusteFoto,
  type OrdemLista,
  type Pessoa,
} from "@/lib/preimpressao/cracha";
import { ehImagem, lerFoto } from "@/lib/preimpressao/crachaNavegador";
import { baixarBlob, baixarZip } from "@/lib/preimpressao/navegador";
import { nomeDeArquivo } from "./agendaConfig";
import { CrachaFotoAjuste } from "./CrachaFotoAjuste";
import { CrachaPrevia } from "./CrachaPrevia";
import { CrachaVersoGuia } from "./CrachaVersoGuia";
import { resumoDoModelo, type ModeloAtivo, type ModeloSalvo } from "./crachaModelos";
import { Campo, DuasColunas, NotaPrivacidade, Painel, PreviaPdf, Segmentado, SoltarArquivo } from "./ui";
import { useGeracaoCrachas, type Aba } from "./useGeracaoCrachas";

type FotoLida = Awaited<ReturnType<typeof lerFoto>>;

let seq = 0;
const novoId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;
const linhaVazia = (): Pessoa => ({ id: novoId(), nome: "", cargo: "", setor: "", matricula: "", foto: "", incluir: true, extras: {} });
const ehVazia = (p: Pessoa) => !p.nome.trim() && !p.cargo.trim() && !p.setor.trim() && !p.matricula.trim() && !p.foto.trim() && !Object.values(p.extras ?? {}).some((v) => v.trim());

/** "maria_silva-02.JPG" → "Maria Silva 02". */
function nomeDaFoto(arquivo: string): string {
  return arquivo
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)(\p{L})/gu, (_m, a: string, b: string) => a + b.toLocaleUpperCase("pt-BR"));
}

export function CrachaDadosTela({
  modelo,
  onModelo,
  modelos,
  onEscolher,
  onAjustarModelo,
  onCriarModelo,
}: {
  modelo: ModeloAtivo;
  onModelo: (f: (m: ModeloAtivo) => ModeloAtivo) => void;
  modelos: Record<string, ModeloSalvo>;
  onEscolher: (nome: string) => void;
  onAjustarModelo: () => void;
  onCriarModelo: () => void;
}) {
  const cfg = modelo.cfg;
  const [quantidade, setQuantidade] = useState<"uma" | "varias">("uma");
  const [linhas, setLinhas] = useState<Pessoa[]>(() => [linhaVazia()]);
  const [copias, setCopias] = useState<Record<string, number>>({});
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [fotos, setFotos] = useState<FotoLida[]>([]);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [ajustes, setAjustes] = useState<Record<string, AjusteFoto>>({});
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [colarAberto, setColarAberto] = useState(false);
  const [textoColar, setTextoColar] = useState("");
  const [ordem, setOrdem] = useState<OrdemLista>("lista");
  const [erroFotos, setErroFotos] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [aba, setAba] = useState<Aba>("frente");
  const [acao, setAcao] = useState<string | null>(null);

  const nomesModelos = Object.keys(modelos).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const extrasAtivos = cfg.extras.filter((x) => x.layout.ativo);
  const colunas = {
    cargo: cfg.elementos.cargo.ativo,
    setor: cfg.elementos.setor.ativo || cfg.faixa.posicao !== "nenhuma",
    matricula: cfg.elementos.matricula.ativo || cfg.elementos.qr.ativo,
  };
  const comFoto = cfg.elementos.foto.ativo;

  useEffect(() => {
    const m = new Map(fotos.map((f) => [f.nome, URL.createObjectURL(new Blob([f.bytes], { type: f.tipo || "image/jpeg" }))]));
    setUrls(m);
    return () => m.forEach((u) => URL.revokeObjectURL(u));
  }, [fotos]);

  // ─── Pessoas ────────────────────────────────────────────────────
  const ordenadas = useMemo(() => ordenarPessoas(linhas, ordem), [linhas, ordem]);
  const unicas = useMemo(() => ordenadas.filter((p) => !excluidos.has(p.id) && !ehVazia(p)), [ordenadas, excluidos]);
  const pessoas = useMemo(() => unicas.flatMap((p) => Array.from({ length: Math.max(1, copias[p.id] ?? 1) }, () => p)), [unicas, copias]);
  const setores = useMemo(() => setoresDaLista(linhas), [linhas]);
  const ordemSetores = useMemo(() => setores.map((s) => s.chave), [setores]);
  const fotoDe = useMemo(() => {
    const m = new Map<string, FotoLida>();
    for (const p of linhas) {
      const f = acharFoto(p, fotos) as FotoLida | null;
      if (f) m.set(p.id, f);
    }
    return m;
  }, [linhas, fotos]);
  const atual = unicas[Math.min(idx, Math.max(0, unicas.length - 1))] as Pessoa | undefined;
  const g = useGeracaoCrachas({ modelo, pessoas, unicas, fotoDe, ajustes, atual, aba, ordemSetores });

  const usadas = useMemo(() => new Set([...fotoDe.values()].map((f) => f.nome)), [fotoDe]);
  const fotosSemPessoa = fotos.filter((f) => !usadas.has(f.nome));
  const pessoasSemFoto = comFoto ? unicas.filter((p) => !fotoDe.has(p.id)) : [];

  // ─── Edição ─────────────────────────────────────────────────────
  const mudar = (id: string, p: Partial<Pessoa>) => setLinhas((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const mudarExtra = (id: string, chave: string, valor: string) => setLinhas((prev) => prev.map((x) => (x.id === id ? { ...x, extras: { ...x.extras, [chave]: valor } } : x)));
  const remover = (id: string) => setLinhas((prev) => (prev.length > 1 ? prev.filter((x) => x.id !== id) : [linhaVazia()]));

  const receberFotos = async (files: File[]) => {
    const boas = files.filter((f) => ehImagem(f.name) || f.type.startsWith("image/"));
    if (!boas.length) return setErroFotos("Envie fotos em JPG, PNG ou WebP.");
    setErroFotos(null);
    const lidas: FotoLida[] = [];
    let falhas = 0;
    for (const f of boas) {
      try {
        lidas.push(await lerFoto(f));
      } catch {
        falhas++;
      }
    }
    setFotos((prev) => {
      const mapa = new Map(prev.map((x) => [x.nome.toLowerCase(), x]));
      for (const l of lidas) mapa.set(l.nome.toLowerCase(), l);
      return [...mapa.values()];
    });
    // lista vazia + fotos soltas = uma linha para cada foto (o nome vem do arquivo)
    setLinhas((prev) => {
      if (!prev.every(ehVazia) || !lidas.length) return prev;
      if (quantidade === "uma") return [{ ...linhaVazia(), nome: nomeDaFoto(lidas[0].nome), foto: lidas[0].nome }];
      return lidas.map((l) => ({ ...linhaVazia(), nome: nomeDaFoto(l.nome), foto: l.nome }));
    });
    if (falhas) setErroFotos(`${falhas} arquivo(s) não abriram como foto.`);
  };

  const receberFotoUnica = async (files: File[]) => {
    const f = files.find((x) => ehImagem(x.name) || x.type.startsWith("image/"));
    if (!f || !linhas[0]) return;
    try {
      const l = await lerFoto(f);
      setFotos((prev) => [...prev.filter((x) => x.nome.toLowerCase() !== l.nome.toLowerCase()), l]);
      setLinhas((prev) => prev.map((x, i) => (i === 0 ? { ...x, foto: l.nome, nome: x.nome || nomeDaFoto(l.nome) } : x)));
      setErroFotos(null);
    } catch {
      setErroFotos("Não consegui abrir essa foto.");
    }
  };

  const colar = (substituir: boolean) => {
    const r = pessoasDaTabela(lerTabela(textoColar), cfg.extras);
    if (!r.pessoas.length) return;
    const novas = r.pessoas.map((p) => ({ ...p, id: novoId() }));
    setLinhas((prev) => (substituir || prev.every(ehVazia) ? novas : [...prev.filter((x) => !ehVazia(x)), ...novas]).slice(0, LIMITE_PESSOAS));
    setTextoColar("");
    setColarAberto(false);
    setQuantidade("varias");
  };

  const criarPelasFotos = () => {
    const novas = fotosSemPessoa.map((f) => ({ ...linhaVazia(), nome: nomeDaFoto(f.nome), foto: f.nome }));
    setLinhas((prev) => [...prev.filter((x) => !ehVazia(x)), ...novas].slice(0, LIMITE_PESSOAS));
  };

  const limparTudo = () => {
    setLinhas([linhaVazia()]);
    setCopias({});
    setExcluidos(new Set());
    setAjustes({});
    setIdx(0);
  };

  const trocarQuantidade = (q: "uma" | "varias") => {
    setQuantidade(q);
    if (q === "uma") setLinhas((prev) => (prev.length ? [prev.find((x) => !ehVazia(x)) ?? prev[0]] : [linhaVazia()]));
  };

  // ─── Saídas ─────────────────────────────────────────────────────
  const executar = async (nome: string, fn: () => Promise<void>) => {
    setAcao(nome);
    g.setErro(null);
    try {
      await fn();
    } catch (e) {
      g.setErro(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setAcao(null);
    }
  };
  const baixarPdf = () => g.completo && baixarBlob(new Blob([g.completo.bytes], { type: "application/pdf" }), "Crachas.pdf");
  const baixarIndividuais = () =>
    executar("zip", async () => {
      const arquivos: { nome: string; blob: Blob }[] = [];
      for (const [i, p] of unicas.entries()) {
        setAcao(`zip ${i + 1}/${unicas.length}`);
        const r = await gerarCartoes({ cfg: g.cfgPdf, pessoas: [p], fotos: g.recortes, fundo: g.fundo, externas: g.externas, ordemSetores });
        arquivos.push({ nome: `Cracha_${String(i + 1).padStart(3, "0")}_${nomeDeArquivo(p.nome || "sem nome")}.pdf`, blob: new Blob([r.bytes], { type: "application/pdf" }) });
      }
      await baixarZip(arquivos, "Crachas_individuais.zip");
    });
  const baixarVersos = () =>
    executar("verso", async () => {
      const b = await gerarVerso({ orientacao: cfg.orientacao, corFundo: cfg.corVerso, fundo: g.fundoVerso, copias: Math.max(1, pessoas.length), girar: cfg.girarVerso });
      baixarBlob(new Blob([b], { type: "application/pdf" }), "Versos_dos_crachas.pdf");
    });
  const baixarTeste = () =>
    executar("teste", async () => baixarBlob(new Blob([await gerarCartaoDeTeste(cfg.orientacao, cfg.girarVerso)], { type: "application/pdf" }), "Cartao_de_teste_Fargo.pdf"));
  const baixarProva = () =>
    executar("prova", async () => {
      const b = g.provaBytes ?? (g.completo ? await gerarProva(g.completo.bytes, cfg.orientacao) : null);
      if (b) baixarBlob(new Blob([b], { type: "application/pdf" }), "Prova_dos_crachas.pdf");
    });

  const ajustandoPessoa = ajustando ? linhas.find((p) => p.id === ajustando) : undefined;
  const temVerso = !!modelo.arteVerso || cfg.corVerso.toLowerCase() !== "#ffffff";

  // ─── Pedaços da tela ────────────────────────────────────────────
  const campoTexto = (p: Pessoa, chave: "nome" | "cargo" | "setor" | "matricula", titulo: string, placeholder?: string) => (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{titulo}</span>
      <input
        value={p[chave]}
        onChange={(e) => mudar(p.id, { [chave]: e.target.value })}
        placeholder={placeholder}
        className="h-10 w-full rounded-full bg-muted/60 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
    </label>
  );

  const formUma = (() => {
    const p = linhas[0] ?? linhaVazia();
    const f = fotoDe.get(p.id);
    return (
      <div className="space-y-4">
        {comFoto && (
          <Campo titulo="Foto">
            {f ? (
              <div className="flex items-center gap-3 rounded-2xl bg-background p-3 ring-1 ring-border/60">
                <img src={urls.get(f.nome)} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={f.nome}>
                    {f.nome}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setAjustando(p.id)}>
                      Enquadrar
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={() => mudar(p.id, { foto: "" })}>
                      Tirar a foto
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <SoltarArquivo titulo="Solte a foto da pessoa" dica="JPG, PNG ou WebP" aceita="image/*" erro={erroFotos} onArquivos={(fs) => void receberFotoUnica(fs)} />
            )}
          </Campo>
        )}
        <div className="space-y-3">
          {campoTexto(p, "nome", "Nome", "Nome completo")}
          {cfg.elementos.cargo.ativo && campoTexto(p, "cargo", "Cargo")}
          {colunas.setor && campoTexto(p, "setor", "Setor", cfg.faixa.posicao !== "nenhuma" ? "Define a cor da faixa" : undefined)}
          {colunas.matricula && campoTexto(p, "matricula", "Matrícula")}
          {extrasAtivos.map((x) => (
            <label key={x.id} className="block">
              <span className="mb-1 block text-xs text-muted-foreground">{x.rotulo}</span>
              <input
                value={p.extras?.[x.id] ?? ""}
                onChange={(e) => mudarExtra(p.id, x.id, e.target.value)}
                className="h-10 w-full rounded-full bg-muted/60 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </label>
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Quantos cartões iguais</p>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Menos um cartão" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 hover:bg-muted" onClick={() => setCopias((c) => ({ ...c, [p.id]: Math.max(1, (c[p.id] ?? 1) - 1) }))}>
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-base font-semibold tabular-nums">{copias[p.id] ?? 1}</span>
            <button type="button" aria-label="Mais um cartão" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 hover:bg-muted" onClick={() => setCopias((c) => ({ ...c, [p.id]: Math.min(50, (c[p.id] ?? 1) + 1) }))}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  })();

  const celula = "h-9 w-full min-w-[6rem] rounded-xl bg-background px-2.5 text-sm ring-1 ring-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  const tabela = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setColarAberto((v) => !v)}>
          Colar do Excel
        </Button>
        <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setLinhas((prev) => [...prev, linhaVazia()])} disabled={linhas.length >= LIMITE_PESSOAS}>
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar pessoa
        </Button>
        {linhas.some((x) => !ehVazia(x)) && (
          <Button size="sm" variant="ghost" className="rounded-full" onClick={limparTudo}>
            Limpar tudo
          </Button>
        )}
      </div>
      {colarAberto && (
        <div className="space-y-2 rounded-2xl bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            Copie no Excel as colunas (Nome, Cargo, Setor, Matrícula
            {extrasAtivos.length ? `, ${extrasAtivos.map((x) => x.rotulo).join(", ")}` : ""}, Foto) e cole aqui. A 1ª linha deve ter os títulos. A coluna Foto é opcional: sem ela, a foto é achada pelo nome da pessoa.
          </p>
          <Textarea value={textoColar} onChange={(e) => setTextoColar(e.target.value)} rows={5} className="rounded-2xl font-mono text-xs" placeholder={"Nome\tCargo\tSetor\tMatrícula"} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="rounded-full" onClick={() => colar(false)} disabled={!textoColar.trim()}>
              Adicionar à lista
            </Button>
            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => colar(true)} disabled={!textoColar.trim()}>
              Trocar a lista por esta
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setTextoColar(LISTA_DE_EXEMPLO)}>
              Usar lista de exemplo
            </Button>
          </div>
        </div>
      )}
      {comFoto && (
        <SoltarArquivo
          titulo="Solte as fotos de todos aqui"
          dica="O nome do arquivo é o da pessoa (Maria Silva.jpg) ou o que está na coluna Foto"
          arquivo={fotos.length ? { nome: `${fotos.length} foto(s)`, detalhe: `${fotoDe.size} combinam com a lista` } : null}
          aceita="image/*"
          multiplo
          erro={erroFotos}
          onArquivos={(fs) => void receberFotos(fs)}
        />
      )}
      <div className="max-h-[28rem] overflow-auto rounded-2xl bg-muted/30 p-2">
        <table className="w-full border-separate border-spacing-y-1.5 text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="w-6 px-1" />
              {comFoto && <th className="px-1">Foto</th>}
              <th className="px-1">Nome</th>
              {colunas.cargo && <th className="px-1">Cargo</th>}
              {colunas.setor && <th className="px-1">Setor</th>}
              {colunas.matricula && <th className="px-1">Matrícula</th>}
              {extrasAtivos.map((x) => (
                <th key={x.id} className="px-1">
                  {x.rotulo}
                </th>
              ))}
              <th className="px-1">Cópias</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {ordenadas.slice(0, 300).map((p) => {
              const f = fotoDe.get(p.id);
              const incl = !excluidos.has(p.id);
              const pos = unicas.findIndex((x) => x.id === p.id);
              return (
                <tr key={p.id} className={cn("rounded-xl bg-background align-middle", atual?.id === p.id && "outline outline-2 outline-primary/40", !incl && "opacity-50")}>
                  <td className="px-1">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={incl}
                      aria-label={`Imprimir ${p.nome || "linha sem nome"}`}
                      onChange={() =>
                        setExcluidos((prev) => {
                          const n = new Set(prev);
                          if (n.has(p.id)) n.delete(p.id);
                          else n.add(p.id);
                          return n;
                        })
                      }
                    />
                  </td>
                  {comFoto && (
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-1">
                        {f ? (
                          <button type="button" title="Enquadrar a foto" onClick={() => setAjustando(p.id)} className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
                            <img src={urls.get(f.nome)} alt={f.nome} className="h-full w-full object-cover" />
                          </button>
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600" title="Sem foto">
                            <ImagePlus className="h-4 w-4" />
                          </span>
                        )}
                        <select
                          value={f?.nome ?? ""}
                          aria-label={`Foto de ${p.nome || "linha sem nome"}`}
                          onChange={(e) => mudar(p.id, { foto: e.target.value })}
                          className="h-8 w-20 rounded-full bg-muted/70 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <option value="">{f ? "Sem foto" : "Escolher…"}</option>
                          {fotos.map((x) => (
                            <option key={x.nome} value={x.nome}>
                              {x.nome}
                              {usadas.has(x.nome) && x.nome !== f?.nome ? " (em uso)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  )}
                  <td className="px-1">
                    <input value={p.nome} onChange={(e) => mudar(p.id, { nome: e.target.value })} onFocus={() => pos >= 0 && setIdx(pos)} aria-label="Nome" className={cn(celula, "min-w-[9rem]")} />
                  </td>
                  {colunas.cargo && (
                    <td className="px-1">
                      <input value={p.cargo} onChange={(e) => mudar(p.id, { cargo: e.target.value })} onFocus={() => pos >= 0 && setIdx(pos)} aria-label="Cargo" className={celula} />
                    </td>
                  )}
                  {colunas.setor && (
                    <td className="px-1">
                      <input value={p.setor} onChange={(e) => mudar(p.id, { setor: e.target.value })} onFocus={() => pos >= 0 && setIdx(pos)} aria-label="Setor" className={celula} />
                    </td>
                  )}
                  {colunas.matricula && (
                    <td className="px-1">
                      <input value={p.matricula} onChange={(e) => mudar(p.id, { matricula: e.target.value })} onFocus={() => pos >= 0 && setIdx(pos)} aria-label="Matrícula" className={cn(celula, "min-w-[5rem]")} />
                    </td>
                  )}
                  {extrasAtivos.map((x) => (
                    <td key={x.id} className="px-1">
                      <input value={p.extras?.[x.id] ?? ""} onChange={(e) => mudarExtra(p.id, x.id, e.target.value)} onFocus={() => pos >= 0 && setIdx(pos)} aria-label={x.rotulo} className={cn(celula, "min-w-[6rem]")} />
                    </td>
                  ))}
                  <td className="px-1">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={copias[p.id] ?? 1}
                      onChange={(e) => setCopias((c) => ({ ...c, [p.id]: Math.min(50, Math.max(1, Number(e.target.value) || 1)) }))}
                      aria-label="Cópias"
                      className={cn(celula, "w-14 min-w-0 text-center")}
                    />
                  </td>
                  <td className="px-1">
                    <button type="button" aria-label={`Remover ${p.nome || "a linha"}`} className="text-muted-foreground hover:text-destructive" onClick={() => remover(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {ordenadas.length > 300 && <p className="px-2 py-1 text-xs text-muted-foreground">Mostrando 300 de {ordenadas.length}; todos entram no lote.</p>}
      </div>
      {comFoto && (fotosSemPessoa.length > 0 || pessoasSemFoto.length > 0) && (
        <div className="space-y-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">
          {pessoasSemFoto.length > 0 && (
            <p>
              <span className="font-semibold">{pessoasSemFoto.length} pessoa(s) sem foto:</span> {pessoasSemFoto.slice(0, 4).map((p) => p.nome || "(sem nome)").join(", ")}
              {pessoasSemFoto.length > 4 ? ` e mais ${pessoasSemFoto.length - 4}` : ""}. Use “Escolher…” na linha da pessoa.
            </p>
          )}
          {fotosSemPessoa.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <p>
                <span className="font-semibold">{fotosSemPessoa.length} foto(s) sem pessoa:</span> {fotosSemPessoa.slice(0, 3).map((f) => f.nome).join(", ")}
                {fotosSemPessoa.length > 3 ? ` e mais ${fotosSemPessoa.length - 3}` : ""}.
              </p>
              <Button size="sm" variant="secondary" className="h-7 rounded-full px-3 text-xs" onClick={criarPelasFotos}>
                Criar uma linha para cada foto
              </Button>
            </div>
          )}
        </div>
      )}
      <Campo titulo="Ordem do lote">
        <Segmentado
          valor={ordem}
          opcoes={[
            { valor: "lista" as const, rotulo: "Como está" },
            { valor: "nome" as const, rotulo: "Nome" },
            { valor: "setor" as const, rotulo: "Setor" },
            { valor: "matricula" as const, rotulo: "Matrícula" },
          ]}
          onChange={(v) => setOrdem(v)}
        />
      </Campo>
    </div>
  );

  const esquerda = (
    <Painel className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Modelo com dados</h2>
        <p className="text-sm text-muted-foreground">Escolha o modelo da empresa e troque só os dados. A foto fica sempre ao lado dos dados da mesma pessoa.</p>
      </div>
      <NotaPrivacidade />

      <Campo titulo="1. Modelo">
        {nomesModelos.length > 0 || modelo.nome === null ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {nomesModelos.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onEscolher(n)}
                  className={cn("rounded-full px-4 py-2 text-sm font-medium ring-1 ring-border/60 transition-colors", modelo.nome === n ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground")}
                >
                  {n}
                </button>
              ))}
              {modelo.nome === null && <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">Modelo atual (sem nome)</span>}
            </div>
            <p className="text-xs text-muted-foreground">{resumoDoModelo(modelo)}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" className="rounded-full" onClick={onAjustarModelo}>
                Ajustar este modelo
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={onCriarModelo}>
                Criar outro modelo
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum modelo salvo ainda.</p>
        )}
        {nomesModelos.length === 0 && (
          <div className="mt-3 rounded-2xl bg-muted/50 p-4 text-sm">
            <p className="font-medium">Ainda não há modelos salvos.</p>
            <p className="mt-1 text-xs text-muted-foreground">Crie o modelo da empresa uma vez (arte, posições e campos) e salve. Depois a equipe só abre e troca os dados.</p>
            <Button size="sm" className="mt-3 rounded-full" onClick={onCriarModelo}>
              Criar um modelo
            </Button>
          </div>
        )}
      </Campo>

      <Campo titulo="2. Quantas pessoas?">
        <Segmentado
          valor={quantidade}
          opcoes={[
            { valor: "uma" as const, rotulo: "Uma pessoa" },
            { valor: "varias" as const, rotulo: "Várias pessoas" },
          ]}
          onChange={trocarQuantidade}
        />
      </Campo>

      <Campo titulo="3. Dados" ajuda={quantidade === "varias" ? "Cole a lista do Excel ou digite direto na tabela. Cada linha tem a foto ao lado dos dados." : undefined}>
        {quantidade === "uma" ? formUma : tabela}
      </Campo>

      {cfg.faixa.posicao !== "nenhuma" && setores.length > 0 && (
        <Campo titulo="Cor de cada setor" ajuda="A faixa do cartão leva a cor do setor da pessoa.">
          <div className="space-y-1.5">
            {setores.map((s) => (
              <label key={s.chave} className="flex items-center gap-3 rounded-xl bg-background px-3 py-1.5 text-sm ring-1 ring-border/60">
                <input
                  type="color"
                  aria-label={`Cor do setor ${s.nome}`}
                  value={corDoSetor(s.nome, cfg, ordemSetores)}
                  onChange={(e) => onModelo((m) => ({ ...m, cfg: { ...m.cfg, coresSetor: { ...m.cfg.coresSetor, [semAcento(s.nome)]: e.target.value.toLowerCase() } } }))}
                  className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
                />
                <span className="truncate">{s.nome}</span>
              </label>
            ))}
          </div>
        </Campo>
      )}
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
        {aba === "frente" && (
          <CrachaPrevia
            bytes={g.previa}
            orientacao={cfg.orientacao}
            ocupado={g.gerando}
            nome={atual?.nome ?? ""}
            indice={Math.min(idx, Math.max(0, unicas.length - 1))}
            total={unicas.length}
            onIndice={setIdx}
            mostrarFuro={cfg.mostrarFuro}
            dica="Para mudar as posições, use “Ajustar este modelo”."
          />
        )}
        {aba === "verso" && <PreviaPdf bytes={g.versoBytes} paginas={1} vazio="O verso aparece aqui" />}
        {aba === "prova" && <PreviaPdf bytes={g.provaBytes} paginas={g.provaBytes ? 1 : 0} ocupado={g.gerando} vazio={unicas.length ? "Montando a folha de prova…" : "Preencha os dados para ver a prova"} />}
        {aba === "prova" && <p className="text-xs text-muted-foreground">Folha A4 com vários cartões e marcas de corte, para o cliente aprovar em papel comum antes de gastar cartão PVC e fita.</p>}
      </Painel>

      <Painel className="space-y-3">
        <p className="text-sm font-medium">Conferência</p>
        <ul className="space-y-1.5">
          {g.conferencia.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              {c.nivel === "ok" ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : c.nivel === "atencao" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}
              <span className={c.nivel === "ok" ? "text-muted-foreground" : "text-foreground"}>{c.texto}</span>
            </li>
          ))}
        </ul>
        {g.erro && <p className="text-xs text-destructive">{g.erro}</p>}
      </Painel>

      <Painel className="space-y-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Como imprimir na Fargo C50</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>Abra o PDF e imprima no driver da Fargo, com o <span className="font-medium text-foreground">tamanho de papel CR80</span>, tamanho real (100%) e sem ajustar à página.</li>
          <li>Imprima primeiro o <span className="font-medium text-foreground">cartão de teste</span> e um cartão do lote antes de rodar tudo.</li>
          {temVerso && <li>Para o verso, vire o cartão e imprima o PDF dos versos (botão abaixo).</li>}
        </ol>
        {temVerso && <CrachaVersoGuia />}
      </Painel>
    </>
  );

  const rodape = (
    <div className="flex flex-wrap items-center gap-2">
      <Button className="rounded-full" onClick={baixarPdf} disabled={!g.completo || g.gerando || !!acao}>
        {g.gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Baixar PDF dos crachás ({pessoas.length})
      </Button>
      <Button variant="secondary" className="rounded-full" onClick={() => void baixarIndividuais()} disabled={!unicas.length || !!acao}>
        {acao?.startsWith("zip") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {acao?.startsWith("zip") ? `Gerando ${acao.slice(4)}` : "Um PDF por pessoa (.zip)"}
      </Button>
      {temVerso && (
        <Button variant="secondary" className="rounded-full" onClick={() => void baixarVersos()} disabled={!!acao || !pessoas.length}>
          Versos ({pessoas.length})
        </Button>
      )}
      <Button variant="secondary" className="rounded-full" onClick={() => void baixarProva()} disabled={!g.completo || !!acao}>
        Prova em A4
      </Button>
      <Button variant="ghost" className="rounded-full" onClick={() => void baixarTeste()} disabled={!!acao}>
        Cartão de teste
      </Button>
    </div>
  );

  return (
    <>
      <DuasColunas esquerda={esquerda} direita={direita} rodape={rodape} larguraEsquerda={quantidade === "varias" ? "minmax(360px,56%)" : undefined} />
      <CrachaFotoAjuste
        aberto={!!ajustandoPessoa}
        nome={ajustandoPessoa?.nome ?? ""}
        foto={ajustandoPessoa ? (fotoDe.get(ajustandoPessoa.id) ?? null) : null}
        forma={cfg.forma}
        ajuste={ajustando ? (ajustes[ajustando] ?? AJUSTE_PADRAO) : AJUSTE_PADRAO}
        onFechar={() => setAjustando(null)}
        onSalvar={(a) => {
          if (ajustando) setAjustes((prev) => ({ ...prev, [ajustando]: a }));
          setAjustando(null);
        }}
      />
    </>
  );
}
