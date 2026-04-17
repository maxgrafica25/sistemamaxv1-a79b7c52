import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Lightbulb } from "lucide-react";
import type { SugestaoCatalogo } from "@/lib/produtoCatalogo";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nomeAtual: string;
  sugestoes: SugestaoCatalogo[];
  /** Callback de confirmação. Se `escolha` for null, mantém o nome digitado (cria novo). */
  onConfirm: (escolha: SugestaoCatalogo | null) => void;
};

/**
 * Diálogo de "rede de segurança" exibido ao salvar quando há produtos no catálogo
 * com dimensões equivalentes mas nome diferente do digitado.
 * Pergunta se o usuário quer reutilizar o nome canônico de algum produto existente
 * ou manter o nome novo.
 */
export default function ConfirmarNomeDialog({
  open,
  onOpenChange,
  nomeAtual,
  sugestoes,
  onConfirm,
}: Props) {
  const [escolha, setEscolha] = useState<string>("__manter__");

  useEffect(() => {
    if (open) setEscolha("__manter__");
  }, [open]);

  const handleConfirmar = () => {
    if (escolha === "__manter__") {
      onConfirm(null);
    } else {
      const s = sugestoes.find((x) => x.id === escolha);
      onConfirm(s || null);
    }
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Padronizar nome do produto?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <div>
                Você está salvando como:{" "}
                <span className="font-medium text-foreground">"{nomeAtual}"</span>
              </div>
              <div className="text-xs">
                Encontrei produto(s) com dimensões equivalentes já no catálogo.
                Quer reutilizar um dos nomes existentes (recomendado para
                comparar fornecedores) ou manter o nome que você digitou?
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup value={escolha} onValueChange={setEscolha} className="space-y-2">
          {sugestoes.slice(0, 5).map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-3 rounded-md border p-3 hover:bg-accent/50"
            >
              <RadioGroupItem value={s.id} id={s.id} className="mt-0.5" />
              <Label htmlFor={s.id} className="flex-1 cursor-pointer space-y-0.5">
                <div className="font-medium">{s.nome_canonico}</div>
                {s.fornecedores.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Já vinculado: {s.fornecedores.join(", ")}
                  </div>
                )}
              </Label>
            </div>
          ))}
          <div className="flex items-start gap-3 rounded-md border border-dashed p-3 hover:bg-accent/50">
            <RadioGroupItem value="__manter__" id="__manter__" className="mt-0.5" />
            <Label htmlFor="__manter__" className="flex-1 cursor-pointer space-y-0.5">
              <div className="font-medium">Manter o nome que digitei</div>
              <div className="text-xs text-muted-foreground">
                Cria um novo produto no catálogo com "{nomeAtual}"
              </div>
            </Label>
          </div>
        </RadioGroup>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar}>Salvar</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
