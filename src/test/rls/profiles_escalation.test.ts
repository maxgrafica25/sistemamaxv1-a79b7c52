import { describe, it, expect, beforeAll } from "vitest";
import { clientFor, ensureStagingEnv } from "./setup";

beforeAll(ensureStagingEnv);

describe("RLS: profiles — privilege escalation guard (Fase 1 item 1)", () => {
  it("colaborador não consegue setar is_financeiro=true em si mesmo", async () => {
    const c = await clientFor("colab");
    const { data: me } = await c.auth.getUser();
    const { error } = await c.from("profiles")
      .update({ is_financeiro: true })
      .eq("user_id", me.user!.id);
    // Aceitamos: ou a policy bloqueia (error), ou o trigger reverte silenciosamente.
    const { data: after } = await c.from("profiles")
      .select("is_financeiro").eq("user_id", me.user!.id).single();
    expect(after?.is_financeiro).toBe(false);
    void error; // pode ser null se o trigger reverteu
  });

  it("colaborador não consegue mudar display_name de outro usuário", async () => {
    const colab = await clientFor("colab");
    const fin = await clientFor("financeiro");
    const { data: finUser } = await fin.auth.getUser();
    const { data: before } = await fin.from("profiles")
      .select("display_name").eq("user_id", finUser.user!.id).single();

    await colab.from("profiles")
      .update({ display_name: "HACKED" }).eq("user_id", finUser.user!.id);

    const { data: after } = await fin.from("profiles")
      .select("display_name").eq("user_id", finUser.user!.id).single();
    expect(after?.display_name).toBe(before?.display_name);
  });

  it("admin consegue setar is_financeiro em outro usuário", async () => {
    const admin = await clientFor("admin");
    const colab = await clientFor("colab");
    const { data: colabUser } = await colab.auth.getUser();

    await admin.from("profiles").update({ is_financeiro: true }).eq("user_id", colabUser.user!.id);
    const { data: after } = await admin.from("profiles")
      .select("is_financeiro").eq("user_id", colabUser.user!.id).single();
    expect(after?.is_financeiro).toBe(true);

    // cleanup
    await admin.from("profiles").update({ is_financeiro: false }).eq("user_id", colabUser.user!.id);
  });
});
