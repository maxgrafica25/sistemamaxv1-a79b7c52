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

/**
 * Trata erro de operação Supabase/async com feedback visível ao usuário.
 * Intercepta mensagens técnicas do banco e as substitui por mensagens amigáveis.
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
  const message = err.message || String(error) || "";
  const code = err.code;

  // Log técnico para desenvolvedores (mantido no console)
  console.error(`[${context}]`, {
    message,
    code,
    details: err.details,
    hint: err.hint,
  });

  if (options.silent) return;

  let friendly: string;

  // 1. Erros de Permissão / RLS
  if (isRlsError(message, code)) {
    friendly = "Você não tem permissão para realizar esta operação. Se considerar que isso é um erro, contate o administrador.";
  } 
  // 2. Erros de Admin/Financeiro específicos da aplicação
  else if (isFinanceiroOnlyError(message)) {
    friendly = `Esta ação é restrita aos usuários do Financeiro.`;
  } else if (isAdminOnlyError(message)) {
    friendly = `Esta ação é restrita aos administradores do sistema.`;
  }
  // 3. Erros de Banco de Dados (Constraints) - PostgreSQL Error Codes
  // 23505: unique_violation
  else if (code === "23505" || /duplicate key|already exists/i.test(message)) {
    friendly = "Este registro já está cadastrado.";
  }
  // 23503: foreign_key_violation
  else if (code === "23503" || /foreign key|violates foreign key/i.test(message)) {
    friendly = "Não é possível realizar esta operação pois existem registros vinculados.";
  }
  // 23502: not_null_violation
  else if (code === "23502" || /null value in column.*violates not-null constraint/i.test(message)) {
    // Tenta extrair o nome da coluna se disponível
    const columnMatch = message.match(/column "([^"]+)"/);
    if (columnMatch && columnMatch[1]) {
      friendly = `O campo "${columnMatch[1]}" é obrigatório.`;
    } else {
      friendly = "Existem campos obrigatórios não preenchidos.";
    }
  }
  // 4. Fallback para outros erros
  else {
    friendly = "Ocorreu um erro ao salvar. Tente novamente.";
  }


  toast.error(friendly);
}

