// Páginas de abertura do cliente, feitas pelo sistema: "Quem somos", "Nossos produtos", cardápio…
// Três modelos: só texto, foto e texto, e lista com preços.

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_ABERTURAS, MESES, type PosicaoExtra } from "@/lib/preimpressao/agenda";
import { Campo, Mini, Segmentado, SoltarArquivo } from "./ui";
import { EXEMPLOS_ABERTURA, type AberturaUI } from "./agendaConfig";

const valorDe = (p: PosicaoExtra) => String(p);
const posicaoDe = (v: string): PosicaoExtra => (v === "inicio" || v === "fim" ? v : Number(v));

let seq = 0;
const novoId = () => `ab${Date.now().toString(36)}${(seq++).toString(36)}`;

export function AgendaAberturas({
  aberturas,
  onChange,
  onFoto,
  fotoCarregando,
  erro,
}: {
  aberturas: AberturaUI[];
  onChange: (l: AberturaUI[]) => void;
  onFoto: (id: string, files: File[]) => void;
  fotoCarregando: string | null;
  erro: string | null;
}) {
  const mudar = (id: string, p: Partial<AberturaUI>) => onChange(aberturas.map((a) => (a.id === id ? { ...a, ...p } : a)));
  return (
    <Campo titulo="Páginas de abertura" ajuda="Quem somos, produtos, cardápio… O sistema monta a página no mesmo estilo da agenda. Entram no miolo no lugar que você escolher.">
      <div className="space-y-4">
        {aberturas.map((a, n) => (
          <div key={a.id} className="space-y-4 rounded-2xl bg-background/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Página {n + 1}</p>
              <button
                type="button"
                aria-label={`Remover a página de abertura ${n + 1}`}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onChange(aberturas.filter((x) => x.id !== a.id))}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Segmentado
              valor={a.modelo}
              opcoes={[
                { valor: "texto" as const, rotulo: "Texto" },
                { valor: "foto" as const, rotulo: "Foto e texto" },
                { valor: "lista" as const, rotulo: "Lista" },
              ]}
              onChange={(v) => mudar(a.id, { modelo: v })}
            />
            <Mini rotulo="Título" valor={a.titulo} onChange={(v) => mudar(a.id, { titulo: v.slice(0, 40) })} texto ajuda="A última palavra sai em negrito." />
            {a.modelo === "foto" && (
              <div className="space-y-3">
                {a.foto && <img src={a.foto.dataUrl} alt="Foto da abertura" className="max-h-28 w-full rounded-xl object-cover ring-1 ring-border/60" />}
                <SoltarArquivo
                  titulo={a.foto ? "Trocar a foto" : "Solte a foto (PNG ou JPG)"}
                  dica="Ela é cortada no centro para caber na página."
                  aceita=".png,.jpg,.jpeg,image/png,image/jpeg"
                  carregando={fotoCarregando === a.id}
                  onArquivos={(f) => onFoto(a.id, f)}
                />
              </div>
            )}
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">{a.modelo === "lista" ? "Itens (um por linha: nome | preço)" : "Texto"}</span>
              <textarea
                aria-label={`Texto da página de abertura ${n + 1}`}
                rows={a.modelo === "lista" ? 8 : 6}
                value={a.texto}
                onChange={(e) => mudar(a.id, { texto: e.target.value.slice(0, 1600) })}
                className="w-full resize-none rounded-2xl bg-muted/60 px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-primary/40"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {a.modelo === "lista" ? "Uma linha que começa com # vira subtítulo. Ex.: # Pizzas" : "Uma linha em branco separa os parágrafos. O primeiro sai maior."} · {a.texto.length}/1600
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
                Onde entra
                <select
                  aria-label={`Onde entra a página de abertura ${n + 1}`}
                  value={valorDe(a.posicao)}
                  onChange={(e) => mudar(a.id, { posicao: posicaoDe(e.target.value) })}
                  className="h-8 min-w-0 flex-1 rounded-full bg-muted/70 px-3 text-xs font-medium text-foreground outline-none ring-1 ring-transparent focus:ring-primary/40"
                >
                  <option value="inicio">No início, depois dos calendários</option>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      Antes de {m.charAt(0) + m.slice(1).toLowerCase()}
                    </option>
                  ))}
                  <option value="fim">No fim, antes das anotações</option>
                </select>
              </label>
              <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => mudar(a.id, { ...EXEMPLOS_ABERTURA[a.modelo] })}>
                Usar texto de exemplo
              </button>
            </div>
          </div>
        ))}
      </div>
      {erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}
      {aberturas.length < MAX_ABERTURAS && (
        <Button
          size="sm"
          variant="secondary"
          className="mt-3 rounded-full"
          onClick={() => onChange([...aberturas, { id: novoId(), titulo: "", texto: "", modelo: "texto", foto: null, posicao: "inicio" }])}
        >
          <Plus className="h-4 w-4" /> Adicionar página de abertura
        </Button>
      )}
    </Campo>
  );
}
