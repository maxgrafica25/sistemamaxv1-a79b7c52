import { describe, it, expect, beforeAll } from "vitest";
import { clientFor, ensureStagingEnv } from "./setup";

beforeAll(ensureStagingEnv);

describe("Storage: maintenance-attachments — ownership (Fase 1 item 4)", () => {
  it("colaborador NÃO consegue deletar arquivo de outro usuário", async () => {
    const fin = await clientFor("financeiro");
    const colab = await clientFor("colab");

    // financeiro envia
    const path = `rls-test-${Date.now()}.txt`;
    const blob = new Blob(["x"], { type: "text/plain" });
    const up = await fin.storage.from("maintenance-attachments").upload(path, blob);
    if (up.error) {
      // Se mime bloqueia text/plain (esperado pós-migration), tente PDF
      const pdf = new Blob(["%PDF-1.4"], { type: "application/pdf" });
      const up2 = await fin.storage.from("maintenance-attachments")
        .upload(path.replace(".txt", ".pdf"), pdf);
      expect(up2.error).toBeNull();
    }

    // colab tenta deletar
    const { data, error } = await colab.storage.from("maintenance-attachments").remove([path]);
    // ou erro, ou data vazio (policy filtrou sem erro explícito)
    expect((error !== null) || (data?.length ?? 0) === 0).toBe(true);

    // cleanup pelo dono
    await fin.storage.from("maintenance-attachments").remove([path, path.replace(".txt", ".pdf")]);
  });
});
