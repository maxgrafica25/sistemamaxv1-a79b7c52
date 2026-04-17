import { useEffect, useState } from "react";
import { Lightbulb, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  extractDimKey,
  findCatalogoSimilarByDim,
  type SugestaoCatalogo,
} from "@/lib/produtoCatalogo";

type Props = {
  nome: string;
  /** ID escolhido (quando o usuário clicou em "Usar este nome") */
  selectedId: string | null;
  onPick: (sugestao: SugestaoCatalogo) => void;
};

/**
 * Mostra inline (abaixo do campo nome) sugestões de produtos do catálogo
 * com dimensões equivalentes (±1cm). Permite reutilizar o nome canônico
 * para padronizar produtos entre fornecedores.
 */
export default function SugestoesCatalogoInline({ nome, selectedId, onPick }: Props) {
  const [sugestoes, setSugestoes] = useState<SugestaoCatalogo[]>([]);
  const [dimLabel, setDimLabel] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const dim = extractDimKey(nome);
    if (!dim) {
      setSugestoes([]);
      setDimLabel("");
      return;
    }
    setDimLabel(`${dim.a}x${dim.b}cm`);
    const t = setTimeout(async () => {
      const result = await findCatalogoSimilarByDim(dim, nome);
      if (!cancelled) setSugestoes(result);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [nome]);

  if (sugestoes.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <Lightbulb className="h-3.5 w-3.5" />
        Produtos similares no catálogo ({dimLabel}) — reutilize o nome para
        agrupar entre fornecedores
      </div>
      <div className="space-y-1.5">
        {sugestoes.slice(0, 5).map((s) => {
          const isSelected = selectedId === s.id;
          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded bg-background px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {s.nome_canonico}
                </div>
                {s.fornecedores.length > 0 && (
                  <div className="truncate text-xs text-muted-foreground">
                    Vinculado a: {s.fornecedores.join(", ")}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant={isSelected ? "default" : "outline"}
                className="h-7 shrink-0 text-xs"
                onClick={() => onPick(s)}
              >
                {isSelected ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Selecionado
                  </>
                ) : (
                  "Usar este nome"
                )}
              </Button>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-muted-foreground">
        Ou continue digitando um nome diferente para criar um novo produto no
        catálogo.
      </div>
    </div>
  );
}
