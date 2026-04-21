// Manifesto de arquivos do Storage com signed URLs (24h) para migração externa.
// Protegida: somente admins podem invocar. Service-role só após validação.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getAdminClient, logAdminOperation } from "../_shared/admin-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BUCKETS = ["chat-attachments", "maintenance-attachments"];
const SIGNED_URL_TTL = 86400; // 24h
const SIGN_BATCH = 50;

interface FileEntry {
  path: string;
  size: number;
  mime_type: string | null;
  signed_url: string | null;
  sign_error?: string;
}

async function listAllFiles(admin: any, bucket: string, prefix = ""): Promise<any[]> {
  const out: any[] = [];
  const { data, error } = await admin.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) {
    console.warn(`[backup-storage] list failed for ${bucket}/${prefix}:`, error.message);
    return out;
  }
  for (const entry of data || []) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Pastas: id === null no Supabase Storage
    if (entry.id === null) {
      const sub = await listAllFiles(admin, bucket, fullPath);
      out.push(...sub);
    } else {
      out.push({
        path: fullPath,
        size: entry.metadata?.size ?? 0,
        mime_type: entry.metadata?.mimetype ?? null,
      });
    }
  }
  return out;
}

async function signInBatches(admin: any, bucket: string, files: { path: string }[]): Promise<Map<string, { url: string | null; error?: string }>> {
  const result = new Map<string, { url: string | null; error?: string }>();
  for (let i = 0; i < files.length; i += SIGN_BATCH) {
    const slice = files.slice(i, i + SIGN_BATCH);
    const signed = await Promise.all(
      slice.map(async (f) => {
        const { data, error } = await admin.storage.from(bucket).createSignedUrl(f.path, SIGNED_URL_TTL);
        return { path: f.path, url: data?.signedUrl ?? null, error: error?.message };
      }),
    );
    for (const s of signed) result.set(s.path, { url: s.url, error: s.error });
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;
  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_profile_admin", {
    _user_id: userId,
  });
  if (adminErr || !isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden: admin required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = getAdminClient({
    fnName: "backup-storage",
    reason: "Export storage manifest with signed URLs for disaster recovery (admin-initiated)",
  });

  const ts = new Date();
  const stamp = ts.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const filename = `storage-manifest-${stamp}.json`;
  const expiresAt = new Date(ts.getTime() + SIGNED_URL_TTL * 1000);

  const encoder = new TextEncoder();
  let bytesWritten = 0;
  let totalFiles = 0;
  let totalBytes = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: string) => {
        const enc = encoder.encode(chunk);
        bytesWritten += enc.byteLength;
        controller.enqueue(enc);
      };

      try {
        write(`{\n  "generated_at": ${JSON.stringify(ts.toISOString())},\n`);
        write(`  "expires_at": ${JSON.stringify(expiresAt.toISOString())},\n`);
        write(`  "instructions": "URLs assinadas validas por 24h. Baixe imediatamente: jq -r '.buckets | to_entries[] | .value[] | .signed_url' manifest.json > urls.txt && wget -i urls.txt -P ./storage-dump/",\n`);
        write(`  "buckets": {\n`);

        for (let bi = 0; bi < BUCKETS.length; bi++) {
          const bucket = BUCKETS[bi];
          const files = await listAllFiles(admin, bucket);
          const signedMap = await signInBatches(admin, bucket, files);
          const enriched: FileEntry[] = files.map((f) => {
            const s = signedMap.get(f.path);
            totalBytes += f.size || 0;
            return {
              path: f.path,
              size: f.size,
              mime_type: f.mime_type,
              signed_url: s?.url ?? null,
              ...(s?.error ? { sign_error: s.error } : {}),
            };
          });
          totalFiles += enriched.length;
          write(`    ${JSON.stringify(bucket)}: ${JSON.stringify(enriched)}`);
          write(bi < BUCKETS.length - 1 ? ",\n" : "\n");
        }

        write(`  },\n`);
        write(`  "totals": { "files": ${totalFiles}, "bytes": ${totalBytes} }\n`);
        write(`}\n`);

        controller.close();

        await Promise.all([
          logAdminOperation(admin, {
            function_name: "backup-storage",
            operation: "export_storage_manifest",
            target_table: "storage.objects",
            target_count: totalFiles,
            invoked_by: userId,
            metadata: {
              buckets: BUCKETS,
              total_files: totalFiles,
              total_bytes: totalBytes,
              size_bytes: bytesWritten,
              expires_at: expiresAt.toISOString(),
            },
          }),
          admin.from("backup_runs").insert({
            created_by: userId,
            format: "storage-json",
            size_bytes: bytesWritten,
            status: "success",
          }),
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[backup-storage] failed:", msg);
        try {
          await admin.from("backup_runs").insert({
            created_by: userId,
            format: "storage-json",
            size_bytes: bytesWritten,
            status: "failed",
            error_message: msg,
          });
        } catch (_) { /* ignore */ }
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
