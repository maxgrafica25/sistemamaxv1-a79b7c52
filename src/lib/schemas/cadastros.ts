// Etapa 4b — Schemas Zod compartilhados para as telas de cadastro.
// Cada schema espelha as constraints já presentes no banco (NOT NULL, ranges
// de check constraints) + limites de comprimento defensivos (XSS / abuse).
// Padrão idêntico ao InviteUserDialog: safeParse + errors map + disable Save.

import { z } from "zod";

// ─── Equipamentos ─────────────────────────────────────────────────────
export const equipmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter ao menos 2 caracteres")
    .max(120, "Nome muito longo (máx 120)"),
  printer_type: z.enum(["pb", "color", "ribbon", "other"], {
    errorMap: () => ({ message: "Tipo inválido" }),
  }),
  description: z
    .string()
    .trim()
    .max(500, "Descrição muito longa (máx 500)")
    .optional()
    .or(z.literal("")),
});
export type EquipmentInput = z.infer<typeof equipmentSchema>;

export const consumableSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter ao menos 2 caracteres")
    .max(120, "Nome muito longo (máx 120)"),
  price: z
    .number({ invalid_type_error: "Preço inválido" })
    .min(0, "Preço não pode ser negativo")
    .max(10_000_000, "Preço acima do limite"),
  yield_pages: z
    .number({ invalid_type_error: "Rendimento inválido" })
    .int("Use número inteiro")
    .positive("Rendimento deve ser maior que zero")
    .max(100_000_000, "Rendimento acima do limite"),
});
export type ConsumableInput = z.infer<typeof consumableSchema>;

// ─── Matérias-primas ──────────────────────────────────────────────────
export const paperSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório").max(120, "Nome muito longo"),
  grammage: z
    .string()
    .trim()
    .max(20, "Gramatura muito longa")
    .optional()
    .or(z.literal("")),
  sheet_qty: z
    .number({ invalid_type_error: "Qtd. folhas inválida" })
    .int("Use número inteiro")
    .positive("Qtd. folhas deve ser maior que zero")
    .max(10_000_000, "Qtd. folhas acima do limite"),
  pack_price: z
    .number({ invalid_type_error: "Preço inválido" })
    .nonnegative("Preço não pode ser negativo")
    .max(10_000_000, "Preço acima do limite"),
  freight_total: z
    .number({ invalid_type_error: "Frete inválido" })
    .nonnegative("Frete não pode ser negativo")
    .max(10_000_000, "Frete acima do limite"),
  freight_divide_by: z
    .number({ invalid_type_error: "Divisor inválido" })
    .int("Use número inteiro")
    .positive("Divisor deve ser maior que zero")
    .max(1_000_000),
  supplier: z.string().trim().max(120, "Fornecedor muito longo").optional().or(z.literal("")),
  contact: z.string().trim().max(120, "Contato muito longo").optional().or(z.literal("")),
  purchase_sheet_w: z
    .number({ invalid_type_error: "Largura inválida" })
    .positive("Largura deve ser maior que zero")
    .max(10_000, "Largura acima do limite")
    .nullable()
    .optional(),
  purchase_sheet_h: z
    .number({ invalid_type_error: "Altura inválida" })
    .positive("Altura deve ser maior que zero")
    .max(10_000, "Altura acima do limite")
    .nullable()
    .optional(),
});
export type PaperInput = z.infer<typeof paperSchema>;

export const supplySchema = z.object({
  produto: z.string().trim().min(2, "Produto obrigatório").max(120, "Produto muito longo"),
  quantidade: z
    .number({ invalid_type_error: "Quantidade inválida" })
    .positive("Quantidade deve ser maior que zero")
    .max(10_000_000),
  valor: z
    .number({ invalid_type_error: "Valor inválido" })
    .nonnegative("Valor não pode ser negativo")
    .max(10_000_000),
  margem_pct: z
    .number({ invalid_type_error: "Margem inválida" })
    .min(0, "Margem não pode ser negativa")
    .max(500, "Margem máxima 500%"),
  fornecedor: z.string().trim().max(120).optional().or(z.literal("")),
  contato: z.string().trim().max(120).optional().or(z.literal("")),
  modulos: z
    .array(z.enum(["grafica", "cv"]))
    .min(1, "Selecione ao menos um módulo"),
});
export type SupplyInput = z.infer<typeof supplySchema>;

// ─── Despesas fixas ───────────────────────────────────────────────────
export const expenseRowSchema = z.object({
  name: z.string().trim().min(2, "Descrição obrigatória").max(120, "Descrição muito longa"),
  value: z
    .number({ invalid_type_error: "Valor inválido" })
    .nonnegative("Valor não pode ser negativo")
    .max(100_000_000),
});

export const salaryRowSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório").max(120, "Nome muito longo"),
  salary: z
    .number({ invalid_type_error: "Salário inválido" })
    .nonnegative("Salário não pode ser negativo")
    .max(10_000_000),
});

export const equipmentDepRowSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório").max(120, "Nome muito longo"),
  purchase_value: z
    .number({ invalid_type_error: "Valor inválido" })
    .nonnegative("Valor não pode ser negativo")
    .max(100_000_000),
  useful_life_months: z
    .number({ invalid_type_error: "Vida útil inválida" })
    .int("Use número inteiro")
    .positive("Vida útil deve ser maior que zero")
    .max(1200, "Máximo 1200 meses (100 anos)"),
  residual_value: z
    .number({ invalid_type_error: "Valor inválido" })
    .nonnegative("Valor não pode ser negativo")
    .max(100_000_000),
});

export const capacitySchema = z.object({
  hours_per_month: z
    .number({ invalid_type_error: "Horas inválidas" })
    .positive("Horas/mês deve ser maior que zero")
    .max(744, "Máximo 744h (mês inteiro 24×31)"),
});

// ─── Processos de Produção (Grupos de Etapas) ─────────────────────────
export const stepGroupSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório").max(120, "Nome muito longo"),
  steps_count: z.number().int().min(1, "Adicione ao menos uma etapa ao grupo"),
});

// ─── Helper genérico: extrai dict { field: firstError } a partir de um ZodError ─
export function zodErrorsToMap(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_root";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
