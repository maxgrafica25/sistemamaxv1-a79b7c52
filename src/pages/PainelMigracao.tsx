import { useState } from "react";
import {
  Eye, EyeOff, Copy, Check, ShieldAlert, Key, Download,
  Loader2, Code2, Database, AlertTriangle, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type TableInfo = {
  tablename: string;
  row_count: number;
  column_count: number;
  encrypted_columns: number;
  has_user_id: boolean;
};

type PanelData = {
  project_url: string;
  anon_key: string;
  service_role_key: string;
  secrets: Record<string, string>;
  edge_functions: string[];
  edge_functions_count: number;
  database_tables: TableInfo[];
  database_error: string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function mask(value: string): string {
  if (!value) return "";
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}•••••${value.slice(-8)}`;
}

function classifyTable(t: TableInfo): "Essencial" | "Histórico" | "Ignorar" {
  const name = t.tablename.toLowerCase();
  if (name.includes("log") || name.includes("audit") || name.includes("history") || name.includes("historico")) return "Histórico";
  if (name.includes("rate_limit") || name.includes("cache") || name.includes("temp")) return "Ignorar";
  if (t.row_count === 0) return "Ignorar";
  return "Essencial";
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(label ? `${label} copiado` : "Copiado");
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="text-primary" /> : <Copy />}
    </Button>
  );
}

function SecretRow({ label, value }: { label: string; value: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="font-mono text-sm break-all">{visible ? value : mask(value)}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={() => setVisible((v) => !v)}>
        {visible ? <EyeOff /> : <Eye />}
      </Button>
      <CopyButton value={value} label={label} />
    </div>
  );
}

export default function PainelMigracao() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PanelData | null>(null);

  const revelarTudo = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/painel-migracao`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: "{}",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PanelData;
      setData(json);
      toast.success("Tudo revelado!");
    } catch (e) {
      toast.error(`Falhou: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const baixarEdgeFunctions = () => {
    const modules = import.meta.glob("/supabase/functions/*/index.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const parts: string[] = [];
    for (const [path, src] of Object.entries(modules)) {
      const name = path.split("/").slice(-2, -1)[0];
      parts.push(`// ═══ ${name} ═══\n${src}`);
    }
    const blob = new Blob([parts.join("\n\n")], { type: "text/typescript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "edge-functions.ts";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`${Object.keys(modules).length} função(ões) exportadas`);
  };

  const baixarSecrets = () => {
    if (!data) return;
    const entries = Object.entries(data.secrets)
      .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
      .join("\n");
    const content =
      `export const SECRETS = {\n${entries}\n} as const;\n\nexport type SecretKey = keyof typeof SECRETS;\n`;
    const blob = new Blob([content], { type: "text/typescript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "secrets.ts";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("secrets.ts gerado");
  };

  const copiarTudo = async () => {
    if (!data) return;
    const blocks: string[] = [];
    blocks.push("═══════════════ CREDENCIAIS ═══════════════");
    blocks.push(`PROJECT_URL=${data.project_url}`);
    blocks.push(`ANON_KEY=${data.anon_key}`);
    blocks.push(`SERVICE_ROLE_KEY=${data.service_role_key}`);
    blocks.push("");
    blocks.push("═══════════════ EDGE FUNCTIONS ═══════════════");
    blocks.push(data.edge_functions.join("\n"));
    blocks.push("");
    blocks.push("═══════════════ SECRETS ═══════════════");
    for (const [k, v] of Object.entries(data.secrets)) blocks.push(`${k}=${v}`);
    await navigator.clipboard.writeText(blocks.join("\n"));
    toast.success("Tudo copiado");
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Painel de Migração</h1>
          <p className="text-muted-foreground">
            Copie os itens abaixo na ordem e cole na extensão CloneSupa.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={revelarTudo} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Eye />}
            Revelar Tudo
          </Button>
          <Button size="lg" variant="outline" onClick={copiarTudo} disabled={!data}>
            <Copy /> Copiar Tudo
          </Button>
        </div>

        {/* Passo 1 — Credenciais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="text-primary" />
              Passo 1 — Credenciais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data ? (
              <>
                <SecretRow label="Project URL" value={data.project_url} />
                <SecretRow label="Anon Key" value={data.anon_key} />
                <SecretRow label="Service Role Key" value={data.service_role_key} />
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={() => { navigator.clipboard.writeText(data.project_url); toast.success("Project URL copiado"); }}>
                    <Copy /> Copiar Project URL
                  </Button>
                  <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(data.service_role_key); toast.success("Service Role Key copiado"); }}>
                    <Copy /> Copiar Service Role Key
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Clique em "Revelar Tudo" para carregar.</p>
            )}
          </CardContent>
        </Card>

        {/* Passo 2 — Edge Functions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="text-primary" />
              Passo 2 — Edge Functions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {data.edge_functions.map((n) => (
                    <span key={n} className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-mono">
                      {n}
                    </span>
                  ))}
                </div>
                <Button onClick={baixarEdgeFunctions}>
                  <Download /> Baixar edge-functions.ts
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Aguardando "Revelar Tudo".</p>
            )}
          </CardContent>
        </Card>

        {/* Passo 3 — Secrets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="text-primary" />
              Passo 3 — Secrets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data ? (
              <>
                <div className="space-y-2">
                  {Object.entries(data.secrets).map(([k, v]) => (
                    <SecretRow key={k} label={k} value={v} />
                  ))}
                  {Object.keys(data.secrets).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum secret extra configurado.</p>
                  )}
                </div>
                <Button onClick={baixarSecrets}>
                  <Download /> Baixar secrets.ts
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Aguardando "Revelar Tudo".</p>
            )}
          </CardContent>
        </Card>

        {/* Passo 4 — Conferência */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="text-primary" />
              Passo 4 — Conferência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data ? (
              <>
                <p className="text-sm">
                  Total de tabelas: <strong>{data.database_tables.length}</strong>
                </p>
                {data.database_error && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                    <AlertTriangle className="text-destructive shrink-0" />
                    <span>{data.database_error}</span>
                  </div>
                )}
                <div className="max-h-72 overflow-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-xs uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Tabela</th>
                        <th className="px-3 py-2 text-right">Linhas</th>
                        <th className="px-3 py-2 text-right">Colunas</th>
                        <th className="px-3 py-2 text-left">Categoria</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.database_tables.map((t) => {
                        const cat = classifyTable(t);
                        return (
                          <tr key={t.tablename} className="border-t border-border">
                            <td className="px-3 py-1.5 font-mono text-xs">{t.tablename}</td>
                            <td className="px-3 py-1.5 text-right">{t.row_count}</td>
                            <td className="px-3 py-1.5 text-right">{t.column_count}</td>
                            <td className="px-3 py-1.5">
                              <span
                                className={
                                  cat === "Essencial"
                                    ? "rounded px-2 py-0.5 text-xs bg-primary/15 text-primary"
                                    : cat === "Histórico"
                                    ? "rounded px-2 py-0.5 text-xs bg-muted text-muted-foreground"
                                    : "rounded px-2 py-0.5 text-xs bg-destructive/15 text-destructive"
                                }
                              >
                                {cat}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <Info className="text-primary shrink-0" />
                  <span>
                    Senhas são copiadas como hash bcrypt. Se o JWT secret do destino mudar, sessões antigas caem,
                    mas a senha do usuário continua válida.
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Aguardando "Revelar Tudo".</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
