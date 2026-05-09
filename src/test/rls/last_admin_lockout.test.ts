// =============================================================================
// Teste: trigger prevent_last_admin_lockout
//
// Garante que o sistema sempre tenha pelo menos 1 admin ativo.
// A proteção existe como trigger BEFORE UPDATE em public.profiles
// (função public.prevent_last_admin_lockout). Bloqueia:
//   - rebaixar role do último admin ativo (admin -> colaborador)
//   - desativar (is_active=false) o último admin ativo
//
// Pré-requisito em staging: o JWT "admin" deve ser o ÚNICO admin ativo
// para os Cenários A/B. O Cenário C promove temporariamente o "colab" a admin.
// =============================================================================
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { clientFor, ensureStagingEnv } from "./setup";

beforeAll(ensureStagingEnv);

async function countActiveAdmins() {
  const admin = await clientFor("admin");
  const { count, error } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}

describe("Trigger: prevent_last_admin_lockout", () => {
  let initialAdminCount = 0;

  beforeAll(async () => {
    initialAdminCount = await countActiveAdmins();
    if (initialAdminCount < 1) {
      throw new Error("Staging precisa ter pelo menos 1 admin ativo para esta suite.");
    }
  });

  afterAll(async () => {
    // Defesa em profundidade: garantir que não reduzimos o número de admins.
    const finalCount = await countActiveAdmins();
    expect(finalCount).toBeGreaterThanOrEqual(initialAdminCount);
  });

  it("Cenário A — admin não consegue rebaixar a si mesmo se for o único admin ativo", async () => {
    if (initialAdminCount !== 1) {
      console.warn(`[skip A] staging tem ${initialAdminCount} admins; cenário exige exatamente 1.`);
      return;
    }
    const admin = await clientFor("admin");
    const { data: me } = await admin.auth.getUser();

    const { error } = await admin
      .from("profiles")
      .update({ role: "colaborador" })
      .eq("user_id", me.user!.id);

    expect(error).toBeTruthy();
    expect(error?.message ?? "").toMatch(/pelo menos um administrador|last_admin/i);

    const { data: after } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("user_id", me.user!.id)
      .single();
    expect(after?.role).toBe("admin");
    expect(after?.is_active).toBe(true);
  });

  it("Cenário B — admin não consegue desativar a si mesmo se for o único admin ativo", async () => {
    if (initialAdminCount !== 1) {
      console.warn(`[skip B] staging tem ${initialAdminCount} admins; cenário exige exatamente 1.`);
      return;
    }
    const admin = await clientFor("admin");
    const { data: me } = await admin.auth.getUser();

    const { error } = await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("user_id", me.user!.id);

    expect(error).toBeTruthy();
    expect(error?.message ?? "").toMatch(/pelo menos um administrador|last_admin/i);

    const { data: after } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("user_id", me.user!.id)
      .single();
    expect(after?.is_active).toBe(true);
  });

  it("Cenário C — com 2 admins ativos, rebaixar um é permitido", async () => {
    const admin = await clientFor("admin");
    const colab = await clientFor("colab");
    const { data: adminUser } = await admin.auth.getUser();
    const { data: colabUser } = await colab.auth.getUser();

    // snapshot original do colab para restaurar
    const { data: colabBefore } = await admin
      .from("profiles")
      .select("role, is_active, is_financeiro")
      .eq("user_id", colabUser.user!.id)
      .single();

    try {
      // Promove colab a admin
      const { error: promoteErr } = await admin
        .from("profiles")
        .update({ role: "admin", is_active: true })
        .eq("user_id", colabUser.user!.id);
      expect(promoteErr).toBeNull();

      const midCount = await countActiveAdmins();
      expect(midCount).toBeGreaterThanOrEqual(2);

      // Agora rebaixar o admin original deve ser permitido pelo trigger
      const { error: demoteErr } = await admin
        .from("profiles")
        .update({ role: "colaborador" })
        .eq("user_id", adminUser.user!.id);
      expect(demoteErr).toBeNull();

      // Mas tentar rebaixar o NOVO último admin (colab) deve falhar
      const { error: lastErr } = await admin
        .from("profiles")
        .update({ role: "colaborador" })
        .eq("user_id", colabUser.user!.id);
      expect(lastErr).toBeTruthy();
    } finally {
      // Restaura admin original e estado do colab
      await admin
        .from("profiles")
        .update({ role: "admin", is_active: true })
        .eq("user_id", adminUser.user!.id);
      await admin
        .from("profiles")
        .update({
          role: colabBefore?.role ?? "colaborador",
          is_active: colabBefore?.is_active ?? true,
          is_financeiro: colabBefore?.is_financeiro ?? false,
        })
        .eq("user_id", colabUser.user!.id);
    }
  });

  it("Cenário D — colaborador não consegue rebaixar admin (RLS, não trigger)", async () => {
    const colab = await clientFor("colab");
    const admin = await clientFor("admin");
    const { data: adminUser } = await admin.auth.getUser();

    const { data: before } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", adminUser.user!.id)
      .single();

    // prevent_role_escalation reverte silenciosamente; não esperamos erro,
    // só o estado preservado.
    await colab
      .from("profiles")
      .update({ role: "colaborador" })
      .eq("user_id", adminUser.user!.id);

    const { data: after } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", adminUser.user!.id)
      .single();
    expect(after?.role).toBe(before?.role);
    expect(after?.role).toBe("admin");
  });
});
