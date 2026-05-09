import { describe, it, expect, beforeAll } from "vitest";
import { clientFor, ensureStagingEnv } from "./setup";

beforeAll(ensureStagingEnv);

describe("RLS: audit_logs — admin only (Fase 1 item 2)", () => {
  it("colaborador NÃO consegue ler audit_logs", async () => {
    const c = await clientFor("colab");
    const { data, error } = await c.from("audit_logs").select("id").limit(1);
    expect(error?.code === "42501" || (data?.length ?? 0) === 0).toBe(true);
  });

  it("admin consegue ler audit_logs", async () => {
    const c = await clientFor("admin");
    const { error } = await c.from("audit_logs").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("colaborador NÃO consegue INSERT direto em audit_logs", async () => {
    const c = await clientFor("colab");
    const { error } = await c.from("audit_logs").insert({
      action: "fake", entity_type: "fake",
    });
    expect(error).not.toBeNull(); // policy bloqueia
  });

  it("colaborador consegue gravar via RPC log_audit_event", async () => {
    const c = await clientFor("colab");
    const { error } = await c.rpc("log_audit_event", {
      p_action: "test_event", p_entity_type: "test",
      p_entity_id: null, p_entity_name: null, p_details: "rls test",
    });
    expect(error).toBeNull();
  });

  it("anon NÃO consegue chamar log_auth_event com action arbitrária", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const c = createClient(process.env.STAGING_SUPABASE_URL!, process.env.STAGING_SUPABASE_ANON_KEY!);
    const { error } = await c.rpc("log_auth_event", {
      p_action: "evil_action", p_entity_name: null, p_details: null,
    });
    expect(error).not.toBeNull();
  });
});
