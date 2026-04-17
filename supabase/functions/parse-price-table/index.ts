// Recebe uma planilha (xls/xlsx/csv) ou HTML disfarçado de .xls em base64
// e devolve as linhas como matriz + cabeçalhos detectados, para o usuário
// mapear quais colunas são "produto", "preço", "código", etc.
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function looksLikeHtml(bytes: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 500)).toLowerCase().trim();
  return head.startsWith("<") || head.includes("<html") || head.includes("<table") || head.includes("<tr");
}

// Detecta encoding: se houver bytes >= 0x80 sem sequência UTF-8 válida, usa latin1 (cp1252)
function decodeSmart(bytes: Uint8Array): string {
  // Tenta UTF-8 strict
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Fallback latin1 (windows-1252)
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
  "&aacute;": "á", "&eacute;": "é", "&iacute;": "í", "&oacute;": "ó", "&uacute;": "ú",
  "&Aacute;": "Á", "&Eacute;": "É", "&Iacute;": "Í", "&Oacute;": "Ó", "&Uacute;": "Ú",
  "&atilde;": "ã", "&otilde;": "õ", "&Atilde;": "Ã", "&Otilde;": "Õ",
  "&acirc;": "â", "&ecirc;": "ê", "&ocirc;": "ô", "&Acirc;": "Â", "&Ecirc;": "Ê", "&Ocirc;": "Ô",
  "&ccedil;": "ç", "&Ccedil;": "Ç",
};
function decodeEntities(s: string): string {
  let out = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  out = out.replace(/&[a-zA-Z]+;/g, (m) => HTML_ENTITIES[m] ?? m);
  return out;
}

function parseHtmlTables(text: string): string[][] {
  // Coleta TODAS as linhas de TODAS as tabelas, em ordem
  const allRows: string[][] = [];
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  const tables = text.match(tableRegex) || [];
  for (const t of tables) {
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let r: RegExpExecArray | null;
    while ((r = rowRegex.exec(t)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let c: RegExpExecArray | null;
      while ((c = cellRegex.exec(r[1])) !== null) {
        const txt = decodeEntities(c[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
        cells.push(txt);
      }
      if (cells.length) allRows.push(cells);
    }
  }
  return allRows;
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
      const text = decodeSmart(bytes);
      rows = parseHtmlTables(text);
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

    // Detecta a linha de cabeçalho: primeira linha que contém "preço/valor/R$"
    let headerIdx = 0;
    for (let i = 0; i < Math.min(20, rows.length); i++) {
      const r = rows[i];
      const hasPriceLike = r.some((c) => /pre[çc]o|valor|R\$/i.test(String(c)));
      const nonEmpty = r.filter((c) => String(c ?? "").trim() !== "").length;
      if (hasPriceLike && nonEmpty >= 2) { headerIdx = i; break; }
    }
    const headerRow = rows[headerIdx] || [];
    const header = headerRow.map((h, i) => String(h ?? "").trim() || `Coluna ${i + 1}`);

    // Pega dados após o header. Remove linhas que são DUPLICATAS do header
    // (planilhas-HTML repetem o cabeçalho a cada categoria).
    const headerKey = header.join("|").toLowerCase();
    const data = rows.slice(headerIdx + 1).filter((r) => {
      const k = r.map((c) => String(c ?? "").trim()).join("|").toLowerCase();
      // ignora linhas iguais ao header e linhas com apenas 1 célula com texto (subtítulos)
      if (k === headerKey) return false;
      const nonEmpty = r.filter((c) => String(c ?? "").trim() !== "").length;
      if (nonEmpty < 2) return false;
      return true;
    }).slice(0, 1000);

    return new Response(
      JSON.stringify({ success: true, parser, fileName, header, rows: data, totalRows: data.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
