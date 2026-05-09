// =============================================================================
// scripts/seed-staging-users.ts
//
// Cria/atualiza 3 usuários de teste no Supabase de STAGING para a suíte RLS:
//   - admin@staging.local      (role=admin, único admin ativo)
//   - financeiro@staging.local (display_name='Juliano' → is_financeiro_user=true)
//   - colab@staging.local      (role=colaborador)
//
// Idempotente: se o usuário já existe, apenas reseta a senha.
// Garante que admin@staging.local é o ÚNICO admin ativo (desativa outros).
//
// Uso:
//   export STAGING_SUPABASE_URL="https://<ref>.supabase.co"
//   export STAGING_SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
//   bun run seed:staging
//
// Anti-prod: aborta se a URL contém o ref de produção.
// =============================================================================
import { createClient } from "@supabase/supabase-js";

const PROD_REF = "nxkmxslugblhsyohrrvm";

const URL = process.env.STAGING_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!URL || !SERVICE_KEY) {
  console.error("❌ Faltam STAGING_SUPABASE_URL e/ou STAGING_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (URL.includes(PROD_REF)) {
  console.error(`❌ ABORTADO: STAGING_SUPABASE_URL aponta para PROD (${PROD_REF}).`);
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Persona = {
  email: string;
  displayName: string;
  role: "admin" | "colaborador";
};

const PERSONAS: Persona[] = [
  { email: "admin@staging.local",      displayName: "Staging Admin",      role: "admin" },
  { email: "financeiro@staging.local", displayName: "Juliano",            role: "colaborador" },
  { email: "colab@staging.local",      displayName: "Staging Colab",      role: "colaborador" },
];

function genPassword(): string {
  // 32 chars hex, suficiente pra MIN_PASSWORD_LENGTH=8 e bcrypt 72-char limit
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().slice(0, 8);
}

async function findUserByEmail(email: string) {
  // Admin API não tem getUserByEmail direto; lista paginada (suficiente em staging).
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function upsertUser(p: Persona): Promise<{ email: string; password: string; userId: string }> {
  const password = genPassword();
  const existing = await findUserByEmail(p.email);

  let userId: string;
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { display_name: p.displayName },
    });
    if (error) throw error;
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email,
      password,
      email_confirm: true,
      user_metadata: { display_name: p.displayName },
    });
    if (error) throw error;
    userId = data.user!.id;
  }

  // Garante profile com role e display_name corretos.
  // O trigger handle_new_user já cria a row em profiles ao criar usuário em auth;
  // aqui forçamos os valores que precisamos.
  const { error: upErr } = await admin
    .from("profiles")
    .update({
      display_name: p.displayName,
      role: p.role,
      is_active: true,
    })
    .eq("user_id", userId);

  if (upErr) {
    // Se a row não existe ainda, insere:
    if (upErr.code === "PGRST116" || /no rows/i.test(upErr.message)) {
      const { error: insErr } = await admin.from("profiles").insert({
        user_id: userId,
        display_name: p.displayName,
        role: p.role,
        is_active: true,
      });
      if (insErr) throw insErr;
    } else {
      throw upErr;
    }
  }

  return { email: p.email, password, userId };
}

async function ensureSingleActiveAdmin(adminUserId: string) {
  // Desativa quaisquer outros admins ativos para o teste last_admin_lockout funcionar.
  const { error, count } = await admin
    .from("profiles")
    .update({ is_active: false }, { count: "exact" })
    .eq("role", "admin")
    .eq("is_active", true)
    .neq("user_id", adminUserId);
  if (error) throw error;
  return count ?? 0;
}

async function countActiveAdmins(): Promise<number> {
  const { count, error } = await admin
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  console.log(`→ staging URL: ${URL}`);
  const results: { email: string; password: string; userId: string }[] = [];

  for (const p of PERSONAS) {
    const r = await upsertUser(p);
    results.push(r);
    console.log(`✅ ${r.email.padEnd(30)} | senha: ${r.password}`);
  }

  const adminRow = results.find((r) => r.email === "admin@staging.local")!;
  const deactivated = await ensureSingleActiveAdmin(adminRow.userId);
  if (deactivated > 0) {
    console.log(`ℹ️  ${deactivated} admin(s) pré-existente(s) desativado(s) para isolar o teste last_admin_lockout`);
  }

  const total = await countActiveAdmins();
  console.log(`\n✅ admins ativos no staging: ${total}`);
  if (total !== 1) {
    console.warn(`⚠️  esperado 1 admin ativo, encontrado ${total}. Os cenários A/B do last_admin_lockout serão pulados.`);
  }

  console.log(`\n--- Copie para o gerenciador de senhas e envie via add_secret ---`);
  for (const r of results) {
    const key = r.email.split("@")[0].toUpperCase();
    console.log(`STAGING_${key}_EMAIL=${r.email}`);
    console.log(`STAGING_${key}_PASSWORD=${r.password}`);
  }
}

main().catch((e) => {
  console.error("❌ seed falhou:", e);
  process.exit(1);
});
