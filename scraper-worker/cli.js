// CLI standalone: lê urls.json, scrapeia tudo e grava /app/results.json.
// Uso: node cli.js [caminho-opcional-do-urls.json]

const fs = require("fs");
const path = require("path");
const { scrapeMany } = require("./index");

async function main() {
  const urlsPath = process.argv[2] || path.join(__dirname, "urls.json");
  if (!fs.existsSync(urlsPath)) {
    console.error(`urls.json não encontrado em ${urlsPath}`);
    process.exit(1);
  }
  const urls = JSON.parse(fs.readFileSync(urlsPath, "utf-8"));
  if (!Array.isArray(urls) || !urls.length) {
    console.error("urls.json deve ser um array não-vazio");
    process.exit(1);
  }

  console.log(`[cli] scrapeando ${urls.length} URL(s)...`);
  const results = await scrapeMany(urls);

  const outPath = "/app/results.json";
  try {
    fs.writeFileSync(outPath, JSON.stringify({ results }, null, 2));
    console.log(`[cli] resultado salvo em ${outPath}`);
  } catch (e) {
    // fallback se /app não existir (ex.: rodando localmente)
    const local = path.join(__dirname, "results.json");
    fs.writeFileSync(local, JSON.stringify({ results }, null, 2));
    console.log(`[cli] /app indisponível, salvo em ${local}`);
  }
}

main().catch((e) => {
  console.error("[cli] erro fatal:", e);
  process.exit(1);
});
