// =============================================================================
// generate-jwt.ts — gera ANON_KEY e SERVICE_ROLE_KEY assinados com JWT_SECRET
// =============================================================================
// Compatível com GoTrue/PostgREST self-hosted (HS256, payload Supabase-style).
//
// Uso:
//   JWT_SECRET="..." deno run --allow-env scripts/generate-jwt.ts
//
// Saída: 2 JWTs prontos para colar no .env (ANON_KEY e SERVICE_ROLE_KEY).
// =============================================================================

const secret = Deno.env.get("JWT_SECRET");
if (!secret || secret.length < 32) {
  console.error("Erro: JWT_SECRET ausente ou muito curto (>=32 chars).");
  console.error("Gere com: openssl rand -base64 64");
  Deno.exit(1);
}

const EXP_YEARS = 10;
const iat = Math.floor(Date.now() / 1000);
const exp = iat + EXP_YEARS * 365 * 24 * 60 * 60;

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function encodeJson(obj: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function sign(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const head = encodeJson(header);
  const body = encodeJson(payload);
  const data = `${head}.${body}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return `${data}.${base64url(new Uint8Array(sigBuf))}`;
}

const anon = await sign({ role: "anon", iss: "supabase", iat, exp });
const service = await sign({ role: "service_role", iss: "supabase", iat, exp });

console.log("# Cole no .env:");
console.log("");
console.log(`ANON_KEY=${anon}`);
console.log("");
console.log(`SERVICE_ROLE_KEY=${service}`);
console.log("");
console.log(`# Tokens válidos por ${EXP_YEARS} anos (até ${new Date(exp * 1000).toISOString()})`);
console.log(`# VITE_SUPABASE_PUBLISHABLE_KEY deve ter o MESMO valor de ANON_KEY.`);
