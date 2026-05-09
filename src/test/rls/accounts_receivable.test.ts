import { describe, it, expect, beforeAll } from "vitest";
import { clientFor, ensureStagingEnv } from "./setup";

beforeAll(ensureStagingEnv);

describe("RLS: accounts_receivable — financeiro-only (Fase 1 item 3)", () => {
  it("colaborador NÃO consegue ler contas a receber", async () => {
    const c = await clientFor("colab");
    const { data, error } = await c.from("accounts_receivable").select("id").limit(1);
    // ou erro de policy, ou retorna lista vazia (RLS filtra)
    expect(error?.code === "42501" || (data?.length ?? 0) === 0).toBe(true);
  });

  it("financeiro consegue ler contas a receber", async () => {
    const c = await clientFor("financeiro");
    const { error } = await c.from("accounts_receivable").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("colaborador NÃO consegue inserir conta a receber", async () => {
    const c = await clientFor("colab");
    const { error } = await c.from("accounts_receivable").insert({
      client_name: "test", description: "test", total_value: 1, category: "venda",
    });
    expect(error).not.toBeNull();
  });
});
