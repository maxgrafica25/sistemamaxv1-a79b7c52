// =============================================================================
// Suíte de testes RLS — rodar contra um banco STAGING (nunca prod).
//
// Configuração:
//   STAGING_SUPABASE_URL=...
//   STAGING_SUPABASE_ANON_KEY=...
//   STAGING_ADMIN_EMAIL=... STAGING_ADMIN_PASSWORD=...
//   STAGING_FINANCEIRO_EMAIL=... STAGING_FINANCEIRO_PASSWORD=...
//   STAGING_COLAB_EMAIL=... STAGING_COLAB_PASSWORD=...
//
// Cada usuário deve estar pré-criado em staging com a role correta:
//   - admin:      profiles.role='admin'
//   - financeiro: profiles.is_financeiro=true (após migration 01)
//   - colab:      role='colaborador', is_financeiro=false
//
// Executar:  bun run test:rls
// =============================================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.STAGING_SUPABASE_URL ?? "";
const KEY = process.env.STAGING_SUPABASE_ANON_KEY ?? "";

export type Persona = "admin" | "financeiro" | "colab";

async function signedClient(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email} failed: ${error.message}`);
  return c;
}

export async function clientFor(persona: Persona): Promise<SupabaseClient> {
  const map = {
    admin: ["STAGING_ADMIN_EMAIL", "STAGING_ADMIN_PASSWORD"] as const,
    financeiro: ["STAGING_FINANCEIRO_EMAIL", "STAGING_FINANCEIRO_PASSWORD"] as const,
    colab: ["STAGING_COLAB_EMAIL", "STAGING_COLAB_PASSWORD"] as const,
  };
  const [emailKey, pwKey] = map[persona];
  return signedClient(process.env[emailKey] ?? "", process.env[pwKey] ?? "");
}

export function ensureStagingEnv() {
  if (!URL || !KEY) throw new Error("STAGING_SUPABASE_URL/KEY ausentes — não rode contra prod.");
  if (URL.includes("nxkmxslugblhsyohrrvm")) {
    throw new Error("STAGING_SUPABASE_URL aponta para o projeto de PRODUÇÃO. Abortado.");
  }
}
