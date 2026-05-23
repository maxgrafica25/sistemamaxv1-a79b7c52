import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GitBranch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Props {
  quoteId: string;
  quoteNumber: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  fullWidth?: boolean;
  iconOnly?: boolean;
}

export function CreateVersionButton({
  quoteId,
  quoteNumber,
  variant = "outline",
  size = "sm",
  fullWidth = false,
  iconOnly = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("create_quote_version", { p_quote_id: quoteId });
      if (error) throw error;
      toast.success("Nova versão criada! Itens aprovados foram preservados.");
      navigate(`/orcamentos-v3/${data}/editar`);
    } catch (e) {
      toast.error("Erro ao criar nova versão: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`gap-1.5 ${fullWidth ? "w-full" : ""}`}
          title="Criar nova versão"
          onClick={(e) => e.stopPropagation()}
        >
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <GitBranch className="h-3.5 w-3.5" />}
          {!iconOnly && <span>Nova versão</span>}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Criar nova versão de {quoteNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            Uma cópia será criada para edição. Os itens já aprovados pelo cliente
            permanecerão travados (mesmo valor e quantidade) na nova versão, garantindo
            que o que foi acordado não mude. O orçamento atual ficará bloqueado para edição.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleCreate} disabled={loading}>
            Criar nova versão
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
