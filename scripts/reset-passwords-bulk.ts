/**
 * reset-passwords-bulk.ts
 *
 * Dispara reset de senha em lote contra um endpoint GoTrue/Supabase Auth no destino
 * de uma migração. Usado quando senhas não foram exportadas (caso normal — hashes
 * não são acessíveis via Auth API) e todos os usuários precisam redefinir.
 *
 * USO:
 *   AUTH_URL=https://api.dest.com \
 *   AUTH_ANON_KEY=eyJ... \
 *     deno run --allow-net --allow-env --allow-read --allow-write \
 *     scripts/reset-passwords-bulk.ts users.json
 *
 * INPUT (users.json):
 *   Array JSON extraído do bloco AUTH_USERS_JSON do backup SQL.
 *   Formato esperado: [{ "id": "...", "email": "...", ... }, ...]
 *
 * OUTPUT:
 *   - reset-log-YYYYMMDD.csv com colunas: email,status,http_code,error
 *   - resumo final em stdout
 *
 * RATE LIMIT:
 *   Batches de 5 paralelos com 1s de pausa entre batches.
 *   1 retry após 5s em caso de 429 ou 5xx.
 *
 *   ANTES DE RODAR: aumente GOTRUE_RATE_LIMIT_EMAIL_SENT no destino.
 *   Default GoTrue (30/hora) é muito baixo para reset em lote.
 */

interface AuthUser {
  id?: string;
  email?: string;
  [k: string]: unknown;
}

interface ResetResult {
  email: string;
  status: "ok" | "skipped" | "failed";
  http_code: number;
  error: string;
}

const BATCH_SIZE = 5;
const BATCH_PAUSE_MS = 1000;
const RETRY_DELAY_MS = 5000;

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) {
    console.error(`ERRO: variável de ambiente ${name} não definida.`);
    Deno.exit(1);
  }
  return v;
}

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function postRecover(
  authUrl: string,
  apiKey: string,
  email: string,
): Promise<{ ok: boolean; status: number; error: string }> {
  try {
    const res = await fetch(`${authUrl.replace(/\/$/, "")}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ email }),
    });
    if (res.ok) return { ok: true, status: res.status, error: "" };
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text.slice(0, 200) };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function resetWithRetry(
  authUrl: string,
  apiKey: string,
  email: string,
): Promise<ResetResult> {
  let r = await postRecover(authUrl, apiKey, email);
  // Retry 1x em 429/5xx
  if (!r.ok && (r.status === 429 || r.status >= 500 || r.status === 0)) {
    await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
    r = await postRecover(authUrl, apiKey, email);
  }
  return {
    email,
    status: r.ok ? "ok" : "failed",
    http_code: r.status,
    error: r.error,
  };
}

async function main() {
  const args = Deno.args;
  if (args.length < 1) {
    console.error("Uso: deno run --allow-net --allow-env --allow-read --allow-write scripts/reset-passwords-bulk.ts <users.json>");
    Deno.exit(1);
  }
  const inputPath = args[0];
  const authUrl = getEnv("AUTH_URL");
  const apiKey = getEnv("AUTH_ANON_KEY");

  let raw: string;
  try {
    raw = await Deno.readTextFile(inputPath);
  } catch (e) {
    console.error(`ERRO ao ler ${inputPath}:`, e instanceof Error ? e.message : e);
    Deno.exit(1);
  }

  let users: AuthUser[];
  try {
    users = JSON.parse(raw);
    if (!Array.isArray(users)) throw new Error("JSON não é array");
  } catch (e) {
    console.error(`ERRO: ${inputPath} não é um JSON array válido:`, e instanceof Error ? e.message : e);
    Deno.exit(1);
  }

  // Filtrar emails válidos
  const targets: string[] = [];
  const skipped: ResetResult[] = [];
  const seen = new Set<string>();
  for (const u of users) {
    const email = typeof u.email === "string" ? u.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) {
      skipped.push({ email: email || "(sem email)", status: "skipped", http_code: 0, error: "email inválido ou ausente" });
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    targets.push(email);
  }

  console.log(`Total entradas: ${users.length}`);
  console.log(`Emails únicos válidos: ${targets.length}`);
  console.log(`Ignorados: ${skipped.length}`);
  console.log(`Endpoint: ${authUrl}/auth/v1/recover`);
  console.log(`Batch size: ${BATCH_SIZE}, pausa entre batches: ${BATCH_PAUSE_MS}ms\n`);

  const results: ResetResult[] = [...skipped];

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((email) => resetWithRetry(authUrl, apiKey, email)),
    );
    results.push(...batchResults);
    const done = Math.min(i + BATCH_SIZE, targets.length);
    const okCount = batchResults.filter((r) => r.status === "ok").length;
    const failCount = batchResults.length - okCount;
    console.log(`[${done}/${targets.length}] batch ok=${okCount} fail=${failCount}`);
    if (i + BATCH_SIZE < targets.length) {
      await new Promise((res) => setTimeout(res, BATCH_PAUSE_MS));
    }
  }

  // Escrever CSV
  const logPath = `reset-log-${todayStamp()}.csv`;
  const header = "email,status,http_code,error\n";
  const body = results
    .map((r) => `${csvEscape(r.email)},${r.status},${r.http_code},${csvEscape(r.error)}`)
    .join("\n");
  await Deno.writeTextFile(logPath, header + body + "\n");

  const ok = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skip = results.filter((r) => r.status === "skipped").length;

  console.log(`\n===== RESUMO =====`);
  console.log(`Sucesso: ${ok}`);
  console.log(`Falhas:  ${failed}`);
  console.log(`Pulados: ${skip}`);
  console.log(`Log:     ${logPath}`);

  if (failed > 0) Deno.exit(2);
}

main();
