// Centraliza tratamento de erros do Supabase / async genérico.
// Sempre exibe toast ao usuário (nunca falha silenciosa) e loga estruturado.
import { toast } from "sonner";

interface ErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Trata erro de operação Supabase/async com feedback visível ao usuário.
 * @param error  Erro retornado por supabase ou catch
 * @param context Frase curta descrevendo a operação ("salvar manutenção", "carregar logs")
 * @param options.silent Se true, apenas loga (sem toast) — usar só para fluxos de fundo
 */
export function handleError(
  error: unknown,
  context: string,
  options: { silent?: boolean } = {},
): void {
  const err = (error ?? {}) as ErrorLike;
  const message = err.message || String(error) || "Erro desconhecido";

  console.error(`[${context}]`, {
    message,
    code: err.code,
    details: err.details,
    hint: err.hint,
  });

  if (!options.silent) {
    // Mensagens de RLS são confusas pro usuário final — traduzir
    const friendly = message.includes("row-level security")
      ? "Você não tem permissão para essa ação. Contate um administrador."
      : message.includes("duplicate key")
      ? "Esse registro já existe."
      : `Falha ao ${context}: ${message}`;
    toast.error(friendly);
  }
}
