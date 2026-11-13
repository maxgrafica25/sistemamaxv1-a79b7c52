// Crachás → "Criar ou ajustar um modelo".
// O modelo é o visual do crachá de uma empresa: arte de fundo, onde ficam foto, nome, cargo e os campos
// extras (tipo sanguíneo, ASO, admissão…), cores, faixa por setor e verso. Depois de salvo, a equipe só
// abre o modelo e troca os dados (tela "Modelo com dados"). Tudo no navegador, sem custo.

import { useMemo, useState } from "react";
import { Download, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ELEMENTOS_CRACHA,
  MAX_EXTRAS,
  elementosPadrao,
  novoCampoExtra,
  semAcento,
  type CampoExtra,
  type ElementoCracha,
  type FotoCarregada,
  type LayoutElemento,
  type Orientacao,
  type Pessoa,
} from "@/lib/preimpressao/cracha";
import { lerArte, lerFoto } from "@/lib/preimpressao/crachaNavegador";
import { baixarBlob } from "@/lib/preimpressao/navegador";
import { gerarCartaoDeTeste } from "@/lib/preimpressao/cracha";
import { ativoDeModelo, guardarModelo, gravarModelos, resumoDoModelo, type ConfigModelo, type ModeloAtivo, type ModeloSalvo } from "./crachaModelos";
import { CrachaPrevia, type PontoCracha } from "./CrachaPrevia";
import { CrachaVersoGuia } from "./CrachaVersoGuia";
import { Campo, Chave, DuasColunas, NotaPrivacidade, Painel, Passo, PreviaPdf, SeletorCor, Segmentado, SoltarArquivo } from "./ui";
import { useGeracaoCrachas, type Aba } from "./useGeracaoCrachas";

const FUNDOS = [
  { nome: "Branco", hex: "#ffffff" },
  { nome: "Cinza claro", hex: "#f1f5f9" },
  { nome: "Azul escuro", hex: "#0f2a5c" },
  { nome: "Preto", hex: "#111827" },
  { nome: "Verde escuro", hex: "#14532d" },
  { nome: "Vinho", hex: "#7f1d1d" },
];
const TEXTOS = [
  { nome: "Preto", hex: "#111827" },
  { nome: "Cinza", hex: "#4b5563" },
  { nome: "Branco", hex: "#ffffff" },
  { nome: "Azul", hex: "#1d4ed8" },
  { nome: "Vermelho", hex: "#dc2626" },
];

const num = (v: string, atual: number, min: number, max: number) => {
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : atual;
};

/** Valor de mentira para o campo extra aparecer na prévia. */
function exemploDe(rotulo: string): string {
  const k = semAcento(rotulo);
  if (k.includes("sangu")) return "O+";
  if (k.includes("aso") || k.includes("admiss") || k.includes("data") || k.includes("valid") || k.includes("nasc")) return "15/08/2024";
  if (k.includes("cpf")) return "123.456.789-00";
  if (k.includes("rg")) return "12.345.678-9";
  return "Exemplo";
}

export function CrachaModeloTela({
  modelo,
  onModelo,
  modelos,
  onModelos,
  onUsar,
}: {
  modelo: ModeloAtivo;
  onModelo: (f: (m: ModeloAtivo) => ModeloAtivo) => void;
  modelos: Record<string, ModeloSalvo>;
  onModelos: (m: Record<string, ModeloSalvo>) => void;
  onUsar: () => void;
}) {
  const cfg = modelo.cfg;
  const [sel, setSel] = useState<string>("nome");
  const [aba, setAba] = useState<Aba>("frente");
  const [novoExtra, setNovoExtra] = useState("");
  const [nomeModelo, setNomeModelo] = useState(modelo.nome ?? "");
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroArte, setErroArte] = useState<string | null>(null);
  const [fotoTeste, setFotoTeste] = useState<(FotoCarregada & { tipo?: string }) | null>(null);

  const atualizar = (p: Partial<ConfigModelo>) => onModelo((m) => ({ ...m, cfg: { ...m.cfg, ...p } }));
  const setLayout = (chave: string, p: Partial<LayoutElemento>) => {
    if (chave.startsWith("x:")) {
      const id = chave.slice(2);
      atualizar({ extras: cfg.extras.map((x) => (x.id === id ? { ...x, layout: { ...x.layout, ...p } } : x)) });
    } else {
      const k = chave as ElementoCracha;
      atualizar({ elementos: { ...cfg.elementos, [k]: { ...cfg.elementos[k], ...p } } });
    }
  };
  const layoutDe = (chave: string): LayoutElemento | undefined => (chave.startsWith("x:") ? cfg.extras.find((x) => x.id === chave.slice(2))?.layout : cfg.elementos[chave as ElementoCracha]);

  // Pessoa de exemplo, só para ver o modelo desenhado
  const exemplo = useMemo<Pessoa>(
    () => ({ id: "exemplo", nome: "Maria Souza Oliveira", cargo: "Analista de Marketing", setor: "Comercial", matricula: "1024", foto: "", incluir: true, extras: Object.fromEntries(cfg.extras.map((x) => [x.id, exemploDe(x.rotulo)])) }),
    [cfg.extras],
  );
  const pessoas = useMemo(() => [exemplo], [exemplo]);
  const fotoDe = useMemo(() => new Map(fotoTeste ? [[exemplo.id, fotoTeste]] : []), [fotoTeste, exemplo.id]);
  const ajustes = useMemo(() => ({}), []);
  const ordemSetores = useMemo(() => ["comercial"], []);
  const g = useGeracaoCrachas({ modelo, pessoas, unicas: pessoas, fotoDe, ajustes, atual: exemplo, aba, ordemSetores });

  const trocarOrientacao = (o: Orientacao) => {
    if (o === cfg.orientacao) return;
    const novo = elementosPadrao(o);
    for (const k of Object.keys(novo) as ElementoCracha[]) novo[k] = { ...novo[k], cor: cfg.elementos[k].cor, ativo: cfg.elementos[k].ativo };
    const extras = cfg.extras.map((x, n) => ({ ...x, layout: { ...novoCampoExtra(x.rotulo, n, o).layout, cor: x.layout.cor, ativo: x.layout.ativo } }));
    atualizar({ orientacao: o, elementos: novo, extras, faixa: { ...cfg.faixa, mm: o === "pe" ? 10 : 8 } });
  };

  const textosTodos = (cor: string) => {
    const e = { ...cfg.elementos };
    for (const k of ["nome", "cargo", "matricula"] as const) e[k] = { ...e[k], cor };
    atualizar({ elementos: e, extras: cfg.extras.map((x) => ({ ...x, layout: { ...x.layout, cor } })) });
  };

  const receberArte = async (files: File[], verso: boolean) => {
    if (!files[0]) return;
    try {
      const a = await lerArte(files[0]);
      onModelo((m) => (verso ? { ...m, arteVerso: a } : { ...m, arte: a }));
      setErroArte(null);
    } catch (e) {
      setErroArte(e instanceof Error ? e.message : "Não consegui abrir a arte.");
    }
  };

  const adicionarExtra = () => {
    const r = novoExtra.trim();
    if (!r || cfg.extras.length >= MAX_EXTRAS) return;
    const campo = novoCampoExtra(r, cfg.extras.length, cfg.orientacao);
    atualizar({ extras: [...cfg.extras, campo] });
    setSel(`x:${campo.id}`);
    setNovoExtra("");
  };
  const mudarExtra = (id: string, p: Partial<CampoExtra>) => atualizar({ extras: cfg.extras.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const tirarExtra = (id: string) => {
    atualizar({ extras: cfg.extras.filter((x) => x.id !== id) });
    if (sel === `x:${id}`) setSel("nome");
  };

  const salvar = async () => {
    const n = nomeModelo.trim();
    if (!n) return setAviso("Dê um nome ao modelo (ex.: Escola Alfa) para salvar.");
    const r = await guardarModelo(n, modelo, modelos);
    if (!r.ok) return setAviso("Não coube no navegador. Apague um modelo ou use uma arte menor.");
    onModelos(r.modelos);
    onModelo((m) => ({ ...m, nome: n }));
    setAviso(`Modelo “${n}” salvo. Agora é só abrir em “Modelo com dados”.`);
  };

  const apagar = (n: string) => {
    const { [n]: _t, ...resto } = modelos;
    void _t;
    gravarModelos(resto);
    onModelos(resto);
    setAviso(null);
  };

  const nomesModelos = Object.keys(modelos).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const el = layoutDe(sel) ?? cfg.elementos.nome;
  const ehExtra = sel.startsWith("x:");
  const unidade = !ehExtra && ELEMENTOS_CRACHA.find((e) => e.chave === sel)?.unidade === "mm" ? "mm" : "pt";
  const rotuloSel = ehExtra ? (cfg.extras.find((x) => x.id === sel.slice(2))?.rotulo ?? "campo") : (ELEMENTOS_CRACHA.find((e) => e.chave === sel)?.rotulo ?? "elemento");

  const pontos: PontoCracha[] = [
    ...ELEMENTOS_CRACHA.filter((e) => cfg.elementos[e.chave].ativo).map((e) => ({ chave: e.chave as string, x: cfg.elementos[e.chave].x, y: cfg.elementos[e.chave].y })),
    ...cfg.extras.filter((x) => x.layout.ativo).map((x) => ({ chave: `x:${x.id}`, x: x.layout.x, y: x.layout.y })),
  ];

  const esquerda = (
    <Painel className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Criar ou ajustar um modelo</h2>
        <p className="text-sm text-muted-foreground">O modelo é o visual do crachá da empresa. Monte uma vez, salve com um nome, e a equipe só troca os dados.</p>
      </div>
      <NotaPrivacidade />

      <Campo titulo="Modelos salvos" ajuda={nomesModelos.length ? "Clique para abrir e ajustar." : "Nenhum modelo salvo ainda."}>
        <div className="space-y-3">
          {nomesModelos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nomesModelos.map((n) => (
                <span key={n} className={cn("flex items-center rounded-full text-xs font-medium ring-1 ring-border/60", modelo.nome === n ? "bg-foreground text-background" : "bg-background")}>
                  <button
                    type="button"
                    className="rounded-l-full py-1.5 pl-3 pr-2"
                    onClick={() => {
                      onModelo(() => ativoDeModelo(n, modelos[n]));
                      setNomeModelo(n);
                      setAviso(`Modelo “${n}” aberto.`);
                    }}
                  >
                    {n}
                  </button>
                  <button type="button" aria-label={`Apagar o modelo ${n}`} className="rounded-r-full py-1.5 pl-1 pr-2 opacity-70 hover:text-destructive hover:opacity-100" onClick={() => apagar(n)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={nomeModelo}
              onChange={(e) => setNomeModelo(e.target.value)}
              placeholder="Nome do modelo (ex.: Escola Alfa)"
              aria-label="Nome do modelo"
              className="h-10 min-w-0 flex-1 rounded-full bg-muted/60 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <Button className="rounded-full" onClick={() => void salvar()}>
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </Button>
          </div>
          {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
        </div>
      </Campo>

      <Campo titulo="1. Posição do cartão">
        <Segmentado
          valor={cfg.orientacao}
          opcoes={[
            { valor: "pe" as const, rotulo: "Em pé" },
            { valor: "deitado" as const, rotulo: "Deitado" },
          ]}
          onChange={trocarOrientacao}
        />
      </Campo>

      <Campo titulo="2. Arte de fundo" ajuda="Opcional. A arte que o cliente mandou (ou que você fez no Canva ou no Corel, exportada em PDF ou PNG), na mesma proporção do cartão. Ela cobre o cartão inteiro.">
        <SoltarArquivo
          titulo="Solte a arte do crachá"
          dica="PDF, PNG ou JPG"
          arquivo={modelo.arte ? { nome: modelo.arte.nome, detalhe: modelo.arte.px ? `${modelo.arte.px.w} × ${modelo.arte.px.h} px` : "PDF (vetor mantido)" } : null}
          aceita=".pdf,application/pdf,.png,.jpg,.jpeg,image/png,image/jpeg"
          erro={erroArte}
          onArquivos={(f) => void receberArte(f, false)}
        />
        {modelo.arte && (
          <Button size="sm" variant="ghost" className="mt-2 rounded-full" onClick={() => onModelo((m) => ({ ...m, arte: null }))}>
            Tirar a arte
          </Button>
        )}
        <div className="mt-4">
          <p className="mb-1 text-xs text-muted-foreground">Cor de fundo (aparece quando não há arte)</p>
          <SeletorCor valor={cfg.corFundo} sugestoes={FUNDOS} onChange={(v) => atualizar({ corFundo: v })} />
        </div>
      </Campo>

      <Campo titulo="3. Campos do crachá" ajuda="Escolha um campo e clique ou arraste na prévia ao lado, ou use os botões. Desligue o que o modelo não usa.">
        <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Campo">
          {ELEMENTOS_CRACHA.map((e) => (
            <button
              key={e.chave}
              type="button"
              role="radio"
              aria-checked={sel === e.chave}
              onClick={() => setSel(e.chave)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                sel === e.chave ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground",
                !cfg.elementos[e.chave].ativo && "line-through opacity-60",
              )}
            >
              {e.rotulo}
            </button>
          ))}
          {cfg.extras.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={sel === `x:${x.id}`}
              onClick={() => setSel(`x:${x.id}`)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                sel === `x:${x.id}` ? "bg-foreground text-background" : "bg-primary/10 text-primary hover:bg-primary/15",
                !x.layout.ativo && "line-through opacity-60",
              )}
            >
              {x.rotulo}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <Chave ligado={el.ativo} onChange={(v) => setLayout(sel, { ativo: v })}>
            <span className="font-medium">Mostrar {rotuloSel.toLowerCase()}</span>
            {sel === "qr" && <span className="block text-xs text-muted-foreground">O QR Code leva a matrícula (ou o nome, se não houver matrícula).</span>}
          </Chave>
          {el.ativo && (
            <>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Da esquerda para a direita</p>
                <Passo valor={String(Math.round(el.x))} onChange={(v) => setLayout(sel, { x: num(v, el.x, 0, 100) })} min={0} max={100} sufixo="%" rotulo="posição na horizontal" />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">De cima para baixo</p>
                <Passo valor={String(Math.round(el.y))} onChange={(v) => setLayout(sel, { y: num(v, el.y, 0, 100) })} min={0} max={100} sufixo="%" rotulo="posição na vertical" />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{unidade === "mm" ? "Tamanho (largura)" : "Tamanho da letra"}</p>
                <Passo
                  valor={String(el.tam).replace(".", ",")}
                  onChange={(v) => setLayout(sel, { tam: num(v, el.tam, unidade === "mm" ? 8 : 4, unidade === "mm" ? 60 : 40) })}
                  passo={unidade === "mm" ? 1 : 0.5}
                  min={unidade === "mm" ? 8 : 4}
                  max={unidade === "mm" ? 60 : 40}
                  sufixo={unidade}
                  rotulo="tamanho"
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{sel === "foto" ? "Cor do contorno da foto" : sel === "qr" ? "Cor dos quadradinhos" : "Cor do texto"}</p>
                <SeletorCor valor={el.cor} sugestoes={TEXTOS} onChange={(v) => setLayout(sel, { cor: v })} />
              </div>
              {ehExtra && (
                <Chave ligado={cfg.extras.find((x) => x.id === sel.slice(2))?.mostrarRotulo ?? true} onChange={(v) => mudarExtra(sel.slice(2), { mostrarRotulo: v })}>
                  <span className="font-medium">Escrever o nome do campo</span>
                  <span className="block text-xs text-muted-foreground">Sai “{rotuloSel}: valor”. Desligado, sai só o valor.</span>
                </Chave>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setLayout(sel, { x: 50 })}>
                  Centralizar
                </Button>
                <Button size="sm" variant="secondary" className="rounded-full" onClick={() => textosTodos("#ffffff")}>
                  Todos os textos claros
                </Button>
                <Button size="sm" variant="secondary" className="rounded-full" onClick={() => textosTodos("#111827")}>
                  Todos escuros
                </Button>
                {ehExtra && (
                  <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => tirarExtra(sel.slice(2))}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Tirar este campo
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </Campo>

      <Campo titulo="Campos a mais" ajuda={`Tipo sanguíneo, ASO, data de admissão… Crie o campo aqui; depois ele aparece em “Modelo com dados”. Se a lista do Excel tiver uma coluna com o mesmo nome, ela preenche sozinha. Até ${MAX_EXTRAS} campos.`}>
        <div className="flex gap-2">
          <input
            value={novoExtra}
            onChange={(e) => setNovoExtra(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarExtra()}
            placeholder="Nome do campo (ex.: Tipo sanguíneo)"
            aria-label="Nome do campo novo"
            className="h-10 min-w-0 flex-1 rounded-full bg-muted/60 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <Button className="rounded-full" onClick={adicionarExtra} disabled={!novoExtra.trim() || cfg.extras.length >= MAX_EXTRAS}>
            <Plus className="mr-2 h-4 w-4" />
            Criar
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {["Tipo sanguíneo", "ASO", "Data de admissão"].filter((s) => !cfg.extras.some((x) => semAcento(x.rotulo) === semAcento(s))).map((s) => (
            <button key={s} type="button" className="rounded-full bg-muted/70 px-3 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setNovoExtra(s)}>
              + {s}
            </button>
          ))}
        </div>
      </Campo>

      <Campo titulo="4. Foto e faixa do setor">
        <div className="space-y-3">
          <Segmentado
            valor={cfg.forma}
            opcoes={[
              { valor: "circulo" as const, rotulo: "Redonda" },
              { valor: "arredondado" as const, rotulo: "3 × 4" },
              { valor: "quadrado" as const, rotulo: "Quadrada" },
            ]}
            onChange={(v) => atualizar({ forma: v })}
          />
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Faixa colorida do setor (a cor de cada setor se escolhe ao usar o modelo)</p>
            <Segmentado
              valor={cfg.faixa.posicao}
              opcoes={[
                { valor: "base" as const, rotulo: "Embaixo" },
                { valor: "topo" as const, rotulo: "Em cima" },
                { valor: "nenhuma" as const, rotulo: "Sem faixa" },
              ]}
              onChange={(v) => atualizar({ faixa: { ...cfg.faixa, posicao: v } })}
            />
          </div>
          {cfg.faixa.posicao !== "nenhuma" && (
            <Passo valor={String(cfg.faixa.mm).replace(".", ",")} onChange={(v) => atualizar({ faixa: { ...cfg.faixa, mm: num(v, cfg.faixa.mm, 3, 25) } })} passo={1} min={3} max={25} sufixo="mm" rotulo="altura da faixa" />
          )}
          <Chave ligado={cfg.mostrarFuro} onChange={(v) => atualizar({ mostrarFuro: v })}>
            <span className="font-medium">Mostrar a região do furo do cordão</span>
            <span className="block text-xs text-muted-foreground">Guia só na prévia (não vai para o cartão): evite texto na área rosa.</span>
          </Chave>
        </div>
      </Campo>

      <Campo titulo="5. Verso (opcional)" ajuda="Igual para todos os cartões. A Fargo C50 imprime um lado por vez: o verso sai em um PDF separado.">
        <div className="space-y-3">
          <SoltarArquivo
            titulo="Solte a arte do verso"
            dica="PDF, PNG ou JPG"
            arquivo={modelo.arteVerso ? { nome: modelo.arteVerso.nome, detalhe: modelo.arteVerso.px ? `${modelo.arteVerso.px.w} × ${modelo.arteVerso.px.h} px` : "PDF (vetor mantido)" } : null}
            aceita=".pdf,application/pdf,.png,.jpg,.jpeg,image/png,image/jpeg"
            onArquivos={(f) => void receberArte(f, true)}
          />
          {modelo.arteVerso && (
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => onModelo((m) => ({ ...m, arteVerso: null }))}>
              Tirar a arte do verso
            </Button>
          )}
          <SeletorCor valor={cfg.corVerso} sugestoes={FUNDOS} onChange={(v) => atualizar({ corVerso: v })} />
          <Chave ligado={cfg.girarVerso} onChange={(v) => atualizar({ girarVerso: v })}>
            <span className="font-medium">Girar o verso 180°</span>
            <span className="block text-xs text-muted-foreground">Ligue se, no teste, o verso sair de cabeça para baixo em relação à frente.</span>
          </Chave>
          <CrachaVersoGuia />
          <Button
            variant="secondary"
            className="rounded-full"
            onClick={async () => baixarBlob(new Blob([await gerarCartaoDeTeste(cfg.orientacao, cfg.girarVerso)], { type: "application/pdf" }), "Cartao_de_teste_Fargo.pdf")}
          >
            <Download className="mr-2 h-4 w-4" />
            Cartão de teste (frente e verso)
          </Button>
        </div>
      </Campo>

      <Campo titulo="Foto de teste (opcional)" ajuda="Só para ver como a foto fica no modelo. Não é salva.">
        <SoltarArquivo
          titulo="Solte uma foto de teste"
          dica="JPG, PNG ou WebP"
          arquivo={fotoTeste ? { nome: fotoTeste.nome } : null}
          aceita="image/*"
          onArquivos={async (f) => f[0] && setFotoTeste(await lerFoto(f[0]))}
        />
      </Campo>
    </Painel>
  );

  const direita = (
    <Painel className="space-y-4">
      <Segmentado
        valor={aba === "prova" ? "frente" : aba}
        opcoes={[
          { valor: "frente" as const, rotulo: "Frente" },
          { valor: "verso" as const, rotulo: "Verso" },
        ]}
        onChange={(v) => setAba(v)}
      />
      {aba !== "verso" ? (
        <CrachaPrevia
          bytes={g.previa}
          orientacao={cfg.orientacao}
          pontos={pontos}
          selecionado={sel}
          onMover={(c, p) => setLayout(c, p)}
          ocupado={g.gerando}
          nome="Exemplo"
          indice={0}
          total={1}
          onIndice={() => undefined}
          mostrarFuro={cfg.mostrarFuro}
          dica="Os dados são de exemplo. O ponto roxo é o campo escolhido: clique ou arraste para mudar de lugar."
        />
      ) : (
        <PreviaPdf bytes={g.versoBytes} paginas={1} vazio="O verso aparece aqui" />
      )}
      {g.erro && <p className="text-xs text-destructive">{g.erro}</p>}
    </Painel>
  );

  const rodape = (
    <div className="flex flex-wrap items-center gap-2">
      <Button className="rounded-full" onClick={() => void salvar()}>
        <Save className="mr-2 h-4 w-4" />
        Salvar modelo
      </Button>
      <Button variant="secondary" className="rounded-full" onClick={onUsar}>
        Usar este modelo com dados
      </Button>
      <span className="hidden text-xs text-muted-foreground sm:inline">{resumoDoModelo(modelo)}</span>
    </div>
  );

  return <DuasColunas esquerda={esquerda} direita={direita} rodape={rodape} />;
}
