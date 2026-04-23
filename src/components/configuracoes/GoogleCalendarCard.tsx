import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Link2, Unlink, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TokenRow {
  email_google: string | null;
  connected_at: string;
}

export default function GoogleCalendarCard() {
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<TokenRow | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_google_tokens" as any)
      .select("email_google, connected_at")
      .maybeSingle();
    setToken((data as unknown as TokenRow) || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Trata retorno do OAuth
  useEffect(() => {
    const status = params.get("gcal");
    if (!status) return;
    if (status === "ok") {
      toast.success("Google Calendar conectado!");
      load();
    } else if (status === "error") {
      const reason = params.get("reason") || "desconhecido";
      toast.error(`Falha ao conectar: ${reason}`);
    }
    params.delete("gcal");
    params.delete("reason");
    setParams(params, { replace: true });
  }, [params, setParams]);

  const handleConnect = async () => {
    if (!session?.access_token) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    setConnecting(true);
    try {
      // Detecta origem real do app (top window, mesmo dentro de iframe do editor)
      let appOrigin = window.location.origin;
      try {
        if (window.top && window.top !== window.self) {
          appOrigin = window.top.location.origin;
        }
      } catch {
        // Cross-origin: usa document.referrer como pista, senão fica com window.location.origin
        if (document.referrer) {
          try { appOrigin = new URL(document.referrer).origin; } catch { /* keep */ }
        }
      }

      const { data, error } = await supabase.functions.invoke("google-oauth-init", {
        body: { app_origin: appOrigin },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Resposta inválida");

      // Sair do iframe: navega a janela topo se possível, senão abre nova aba
      const inIframe = window.self !== window.top;
      if (inIframe) {
        try {
          window.top!.location.href = data.url;
        } catch {
          window.open(data.url, "_blank", "noopener,noreferrer");
          setConnecting(false);
        }
      } else {
        window.location.href = data.url;
      }
    } catch (e) {
      toast.error(`Falha: ${e instanceof Error ? e.message : String(e)}`);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar Google Calendar? Lembretes futuros não serão mais sincronizados.")) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("google-disconnect");
      if (error) throw error;
      toast.success("Google Calendar desconectado");
      setToken(null);
    } catch (e) {
      toast.error(`Falha: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Google Calendar
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Sincroniza os lembretes criados pela Júlia com a sua agenda Google. Cada usuário conecta a própria conta.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : token ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent/5 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
              <div>
                <div className="font-medium text-foreground">Conectado{token.email_google ? ` como ${token.email_google}` : ""}</div>
                <div className="text-xs text-muted-foreground">Desde {new Date(token.connected_at).toLocaleString("pt-BR")}</div>
              </div>
            </div>
            <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="gap-2">
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Desconectar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Você ainda não conectou sua conta Google. Ao conectar, lembretes criados pela Júlia aparecerão automaticamente na sua agenda Google (com notificação nativa do Google).
            </p>
            <Button onClick={handleConnect} disabled={connecting} className="gap-2">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Conectar Google Calendar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
