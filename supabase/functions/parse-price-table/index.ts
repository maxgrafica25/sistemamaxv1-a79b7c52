// Recebe uma planilha (xls/xlsx/csv) ou HTML disfarçado de .xls em base64
// e devolve as linhas como matriz + cabeçalhos detectados, para o usuário
// mapear quais colunas são "produto", "preço", "código", etc.
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function looksLikeHtml(bytes: Uint8Array): boolean {
  const head = new TextDecoder().decode(bytes.slice(0, 200)).toLowerCase().trim();
  return head.startsWith("<") || head.includes("<html") || head.includes("<table");
}

function parseHtmlTable(text: string): string[][] {
  // Extrai a primeira <table> mais "rica" (com mais linhas)
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  const tables = text.match(tableRegex) || [];
  let best: string[][] = [];
  for (const t of tables) {
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let r: RegExpExecArray | null;
    while ((r = rowRegex.exec(t)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let c: RegExpExecArray | null;
      while ((c = cellRegex.exec(r[1])) !== null) {
        const txt = c[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
        cells.push(txt);
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length > best.length) best = rows;
  }
  return best;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { fileBase64, fileName } = await req.json();
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "fileBase64 obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));

    let rows: string[][] = [];
    let parser = "xlsx";
    if (looksLikeHtml(bytes)) {
      const text = new TextDecoder("utf-8").decode(bytes);
      rows = parseHtmlTable(text);
      parser = "html-table";
    } else {
      const wb = XLSX.read(bytes, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];
    }

    // Remove linhas totalmente vazias
    rows = rows.filter((r) => r && r.some((c) => String(c ?? "").trim() !== ""));

    if (!rows.length) {
      return new Response(JSON.stringify({ success: false, error: "Nenhuma linha encontrada na planilha." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Detecta a linha de cabeçalho: a primeira linha com várias células de texto e nenhum número grande
    let headerIdx = 0;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const r = rows[i];
      const nonEmpty = r.filter((c) => String(c ?? "").trim() !== "").length;
      const hasPriceLike = r.some((c) => /pre[çc]o|valor|R\$/i.test(String(c)));
      if (hasPriceLike && nonEmpty >= 2) { headerIdx = i; break; }
      if (nonEmpty >= 3 && i === 0) headerIdx = 0;
    }
    const header = (rows[headerIdx] || []).map((h, i) => String(h ?? "").trim() || `Coluna ${i + 1}`);
    const data = rows.slice(headerIdx + 1).slice(0, 500); // limite de segurança 500 linhas

    return new Response(
      JSON.stringify({ success: true, parser, fileName, header, rows: data, totalRows: data.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
