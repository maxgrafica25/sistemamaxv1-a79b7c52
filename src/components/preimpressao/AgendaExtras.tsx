// Páginas do cliente dentro da agenda: PDF ou imagem que entra no início, no fim ou antes de um mês.

import { X } from "lucide-react";
import { MESES, type PosicaoExtra } from "@/lib/preimpressao/agenda";
import { Campo, SoltarArquivo } from "./ui";

export interface ExtraUI {
  id: string;
  nome: string;
  bytes: Uint8Array;
  tipo: "pdf" | "png" | "jpg";
  paginas: number;
  posicao: PosicaoExtra;
}

const valorDe = (p: PosicaoExtra) => String(p);
const posicaoDe = (v: string): PosicaoExtra => (v === "inicio" || v === "fim" ? v : Number(v));

export function AgendaExtras({
  extras,
  onArquivos,
  onRemover,
  onPosicao,
  carregando,
  erro,
}: {
  extras: ExtraUI[];
  onArquivos: (f: File[]) => void;
  onRemover: (id: string) => void;
  onPosicao: (id: string, p: PosicaoExtra) => void;
  carregando: boolean;
  erro: string | null;
}) {
  return (
    <Campo titulo="Páginas do cliente" ajuda="Tabela de preços, mapa, regras… Cada página entra em A5, inteira e centralizada. Não ficam salvas no modelo.">
      {extras.length > 0 && (
        <ul className="mb-3 space-y-2">
          {extras.map((e) => (
            <li key={e.id} className="rounded-2xl bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={e.nome}>
                    {e.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.paginas} {e.paginas === 1 ? "página" : "páginas"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remover ${e.nome}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onRemover(e.id)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                Onde entra
                <select
                  aria-label={`Onde entra ${e.nome}`}
                  value={valorDe(e.posicao)}
                  onChange={(ev) => onPosicao(e.id, posicaoDe(ev.target.value))}
                  className="h-8 min-w-0 flex-1 rounded-full bg-background px-3 text-xs font-medium text-foreground outline-none ring-1 ring-transparent focus:ring-primary/40"
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
            </li>
          ))}
        </ul>
      )}
      <SoltarArquivo
        titulo="Solte um PDF ou imagem"
        dica="PDF (até 20 páginas), PNG ou JPG."
        aceita=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        multiplo
        carregando={carregando}
        erro={erro}
        onArquivos={onArquivos}
      />
    </Campo>
  );
}
