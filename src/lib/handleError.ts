// Centraliza tratamento de erros do Supabase / async genérico.
// Sempre exibe toast ao usuário (nunca falha silenciosa) e loga estruturado.
import { toast } from "sonner";

interface ErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

const RLS_PATTERNS = [
  /row-level security/i,
  /new row violates row-level security/i,
  /permission denied/i,
  /insufficient_privilege/i,
  /violates.*policy/i,
];

const isRlsError = (msg: string, code?: string) => {
  if (code === "42501" || code === "PGRST301" || code === "PGRST116") return true;
  return RLS_PATTERNS.some((re) => re.test(msg));
};

const isAdminOnlyError = (msg: string) =>
  /apenas administradores|only admin|admin.*podem|administrador/i.test(msg);

const isFinanceiroOnlyError = (msg: string) =>
  /financeiro/i.test(msg);

// Etapa 4 — sanitização: remove paths internos, stacks, refs Postgres
// e mensagens contendo "supabase"/"postgres" antes de exibir ao usuário.
const TECHNICAL_LEAK_PATTERNS = [
  /\bat\s+[\w$.<>]+\s*\([^)]*\)/g,         // stack frames "at fn (file:line)"
  /\/[\w./-]+\.(?:ts|tsx|js|jsx):\d+/g,    // paths com linha
  /\b(?:supabase|postgres(?:ql)?|pg|pgrst)\b[^.]{0,40}/gi,
  /\b[A-Z0-9_]{2,}_(?:ERROR|EXCEPTION)\b/g, // códigos tipo FOO_BAR_ERROR
];

const sanitizeForDisplay = (msg: string): string => {
  let cleaned = msg;
  for (const re of TECHNICAL_LEAK_PATTERNS) cleaned = cleaned.replace(re, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  // Se sobrou pouco/nada útil, devolve genérico
  if (cleaned.length < 8) return "ocorreu um erro inesperado";
  return cleaned;
};


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

  if (options.silent) return;

  let friendly: string;

  if (isRlsError(message, err.code)) {
    // Mensagem de RLS — provavelmente precisa de admin
    friendly = `Sem permissão para ${context}. Esta ação é restrita aos administradores do sistema. Solicite ao administrador para realizar a alteração.`;
  } else if (isFinanceiroOnlyError(message)) {
    friendly = `Sem permissão para ${context}. Esta ação é restrita aos usuários do Financeiro (Juliano ou Marcelle).`;
  } else if (isAdminOnlyError(message)) {
    // Erro custom do banco que já menciona admin
    friendly = `Sem permissão para ${context}. ${message}`;
  } else if (/duplicate key|already exists/i.test(message)) {
    friendly = "Esse registro já existe.";
  } else if (/foreign key|violates foreign key/i.test(message)) {
    friendly = `Não foi possível ${context}: existem registros vinculados que precisam ser removidos antes.`;
  } else {
    friendly = `Falha ao ${context}: ${message}`;
  }

  toast.error(friendly);
}
