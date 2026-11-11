import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { compararFaixa, podeEnviar, skusEmConflito, type ProdutoTiny } from "@/lib/tinyPrecos";

const produtos: Record<string, ProdutoTiny> = {
  "178": { id: 1, descricao: "TP1", preco: 1.6, promocional: null },
  "1782": { id: 2, descricao: "TP2", preco: 1.2, promocional: null },
  "50": { id: 3, descricao: "Caneta", preco: 4, promocional: null },
  "60": { id: 4, descricao: "Sem preço", preco: null, promocional: null },
};

describe("preços do Tiny na tabela", () => {
  it("compara o preço da faixa com o do Tiny pelo SKU", () => {
    const sem = new Set<string>();
    expect(compararFaixa({ id: "a", tiny_sku: "178", price: 1.6 }, produtos, sem)).toEqual({ situacao: "igual", precoTiny: 1.6 });
    expect(compararFaixa({ id: "b", tiny_sku: " 1782 ", price: 1.1 }, produtos, sem)).toEqual({ situacao: "diferente", precoTiny: 1.2 });
    expect(compararFaixa({ id: "c", tiny_sku: null, price: 1 }, produtos, sem).situacao).toBe("sem_sku");
    expect(compararFaixa({ id: "d", tiny_sku: "999", price: 1 }, produtos, sem).situacao).toBe("nao_achado");
    expect(compararFaixa({ id: "e", tiny_sku: "60", price: 1 }, produtos, sem).situacao).toBe("sem_preco");
  });

  it("SKU repetido em faixas com preços diferentes não pode ser enviado", () => {
    const faixas = [
      { id: "1", tiny_sku: "50", price: 4 },
      { id: "2", tiny_sku: "50", price: 3.5 },
      { id: "3", tiny_sku: "178", price: 1.6 },
      { id: "4", tiny_sku: "178", price: 1.6 },
    ];
    const conflitos = skusEmConflito(faixas);
    expect([...conflitos]).toEqual(["50"]);
    const c = compararFaixa(faixas[1], produtos, conflitos);
    expect(c.situacao).toBe("conflito");
    expect(podeEnviar(c, 3.5)).toBe(false);
  });

  it("só envia o que é diferente e tem preço", () => {
    expect(podeEnviar({ situacao: "diferente", precoTiny: 1.2 }, 1.1)).toBe(true);
    expect(podeEnviar({ situacao: "sem_preco", precoTiny: null }, 1.1)).toBe(true);
    expect(podeEnviar({ situacao: "diferente", precoTiny: 1.2 }, 0)).toBe(false);
    expect(podeEnviar({ situacao: "igual", precoTiny: 1.1 }, 1.1)).toBe(false);
    expect(podeEnviar({ situacao: "nao_achado", precoTiny: null }, 1.1)).toBe(false);
  });
});
