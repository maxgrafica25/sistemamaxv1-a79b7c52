import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAuthEvent } from "@/lib/audit";
import { handleError } from "@/lib/handleError";


const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let resolved = false;

    const finish = (recovery: boolean) => {
      if (resolved) return;
      resolved = true;
      setIsRecovery(recovery);
      setChecking(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        finish(true);
      }
    });

    (async () => {
      const url = new URL(window.location.href);
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

      // 1) Novo fluxo PKCE: ?code=...
      const code = url.searchParams.get("code");
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data.session) {
          // limpa o code da URL
          url.searchParams.delete("code");
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
          finish(true);
          return;
        }
      }

      // 2) Fluxo token_hash (OTP verify): ?token_hash=...&type=recovery
      const tokenHash = url.searchParams.get("token_hash");
      const typeParam = url.searchParams.get("type");
      if (tokenHash && (typeParam === "recovery" || typeParam === "magiclink")) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: typeParam as "recovery" | "magiclink",
        });
        if (!error && data.session) {
          url.searchParams.delete("token_hash");
          url.searchParams.delete("type");
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
          finish(true);
          return;
        }
      }

      // 3) Fluxo antigo: #access_token=...&type=recovery (já processado automaticamente pelo SDK)
      const hashType = hashParams.get("type");
      if (hashType === "recovery" || hashType === "magiclink") {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          finish(true);
          return;
        }
      }

      // 4) Já existe sessão (link já consumido)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        finish(true);
        return;
      }

      // Sem nenhum método válido — espera o onAuthStateChange por mais 2s
      setTimeout(() => finish(false), 2000);
    })();

    const timeout = setTimeout(() => finish(false), 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Loga evento de token inválido quando a checagem terminar e não for sessão de recovery
  useEffect(() => {
    if (!checking && !isRecovery) {
      logAuthEvent("password_reset_failed_token_invalid", {
        details: { url_hash: window.location.hash || null },
      });
    }
  }, [checking, isRecovery]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      toast.error(`Senha deve ter entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres`);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData.user?.email;
    const userId = userData.user?.id;
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      const isExpired = /expired|invalid token|jwt/i.test(error.message);
      const isHibp = /pwned|leaked|compromised/i.test(error.message);
      if (isExpired) {
        await logAuthEvent("password_reset_failed_token_expired", {
          email: userEmail,
          details: { error: error.message },
        });
        toast.error("Link expirado. Solicite um novo link de recuperação.");
      } else if (isHibp) {
        toast.error("Esta senha apareceu em vazamentos públicos. Escolha outra mais forte.");
      } else {
        handleError(error, "redefinir senha");
      }
    } else {
      // Sucesso — registra log e dispara e-mail de confirmação (se já configurado)
      await logAuthEvent("password_reset_succeeded", {
        email: userEmail,
        details: { user_id: userId },
      });
      // Tenta enviar e-mail de confirmação (não bloqueia o sucesso se falhar)
      try {
        await supabase.functions.invoke("notify-password-changed");
      } catch (e) {
        console.warn("[notify-password-changed] envio falhou", e);
      }
      setSuccess(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => navigate("/"), 2000);
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-primary">OrçaGráfica</CardTitle>
            <CardDescription className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando link de recuperação...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isRecovery && !success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-primary">OrçaGráfica</CardTitle>
            <CardDescription>Link de recuperação inválido ou expirado.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => navigate("/auth")}>
              Voltar para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-2" />
            <CardTitle className="text-2xl font-bold text-primary">Senha Redefinida!</CardTitle>
            <CardDescription>Você será redirecionado em instantes...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">OrçaGráfica</CardTitle>
          <CardDescription>Defina sua nova senha</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Mínimo 6 caracteres"
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Nova Senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repita a nova senha"
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Redefinir Senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
