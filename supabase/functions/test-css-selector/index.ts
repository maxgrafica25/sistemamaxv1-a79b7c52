// Edge function para testar um seletor CSS contra uma URL antes de salvar.
// Busca a página, parseia o HTML e tenta extrair o texto do primeiro elemento que casa com o seletor.

import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseBRLPrice(raw: string): number | null {
  if (!raw) return null;
  // Remove tudo que não é dígito, vírgula ou ponto
  const cleaned = raw
    .replace(/[^\d,.\-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // remove pontos de milhar
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url, selector } = await req.json();
    if (!url || !selector) {
      return new Response(JSON.stringify({ error: "url e selector são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Falha ao buscar página (HTTP ${res.status})` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) {
      return new Response(JSON.stringify({ error: "Não foi possível parsear o HTML" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let elements: any[] = [];
    try {
      elements = Array.from(doc.querySelectorAll(selector));
    } catch (e) {
      return new Response(
        JSON.stringify({ error: `Seletor CSS inválido: ${(e as Error).message}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (elements.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Seletor não encontrou nenhum elemento na página. Verifique se você copiou o seletor correto pelo DevTools (F12).",
          found: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawText = (elements[0].textContent || "").trim();
    const parsed = parseBRLPrice(rawText);

    return new Response(
      JSON.stringify({
        success: true,
        found: elements.length,
        rawText: rawText.slice(0, 200),
        parsedPrice: parsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
