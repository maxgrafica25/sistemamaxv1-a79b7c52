import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Package, Download, Server, Info } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sessionToken: string | null;
}

interface PackageResult {
  filename: string;
  size_bytes: number;
  download_url: string;
  expires_in_days: number;
  split_mode?: boolean;
  storage_filename?: string | null;
  storage_download_url?: string | null;
  storage_size_bytes?: number;
  contents: {
    users: number;
    cron_jobs: number;
    realtime_tables: number;
    edge_functions?: number;
    storage_files_total: number;
    storage_size_bytes: number;
  };
  note?: string;
}

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 2 : 0)} ${u[i]}`;
}

export default function VpsPackageCard({ sessionToken }: Props) {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<PackageResult | null>(null);
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const handleGenerate = async () => {
    if (!sessionToken) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    setGenerating(true);
    setResult(null);
    const toastId = toast.loading("Gerando pacote VPS... (pode levar até 5 minutos com Storage)");
    try {
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/generate-vps-package`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body?.error || `Erro ${resp.status}`);
      setResult(body);
      toast.success(`Pacote gerado: ${fmtBytes(body.size_bytes)}`, { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar pacote", { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" /> Pacote de instalação na VPS
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Gera um ZIP com tudo que você precisa pra instalar o sistema num servidor próprio.
            Inclui banco, usuários, cron jobs reescritos e manual passo-a-passo em português.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Fase 1:</strong> banco + usuários + cron + manual. Arquivos do Storage ainda
              não inclusos no ZIP — baixe pelo botão antigo de exportação. Cada pacote fica
              disponível por 7 dias e mantemos apenas os 3 mais recentes.
            </AlertDescription>
          </Alert>

          <Button onClick={handleGenerate} disabled={generating} size="lg" className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            {generating ? "Gerando..." : "Gerar pacote de instalação VPS"}
          </Button>

          {result && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{result.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtBytes(result.size_bytes)} • válido por {result.expires_in_days} dias
                  </p>
                </div>
                <Button asChild size="sm" className="gap-2">
                  <a href={result.download_url} download={result.filename}>
                    <Download className="h-4 w-4" /> Baixar
                  </a>
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted-foreground border-t pt-3">
                <div><span className="font-mono text-foreground">{result.contents.users}</span> usuários</div>
                <div><span className="font-mono text-foreground">{result.contents.cron_jobs}</span> cron jobs</div>
                <div><span className="font-mono text-foreground">{result.contents.realtime_tables}</span> tabelas realtime</div>
                <div><span className="font-mono text-foreground">{result.contents.storage_files_total}</span> arquivos ({fmtBytes(result.contents.storage_size_bytes)})</div>
              </div>
              {result.note && <p className="text-xs text-muted-foreground italic">{result.note}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
