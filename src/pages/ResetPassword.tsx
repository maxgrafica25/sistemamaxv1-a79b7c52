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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolved) return;
      // Accept PASSWORD_RECOVERY, SIGNED_IN, or magiclink events
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (session) {
          resolved = true;
          setIsRecovery(true);
          setChecking(false);
        }
      }
    });

    // Also check if there's already a session (token already processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (resolved) return;
      const hash = window.location.hash;
      // Accept both recovery and magiclink types
      if (session && hash && (hash.includes("type=recovery") || hash.includes("type=magiclink"))) {
        resolved = true;
        setIsRecovery(true);
        setChecking(false);
      } else if (!hash || (!hash.includes("type=recovery") && !hash.includes("type=magiclink"))) {
        setTimeout(() => {
          if (!resolved) {
            // If there's a session but no hash, user might have been redirected after magic link
            supabase.auth.getSession().then(({ data: { session: s } }) => {
              if (s && !resolved) {
                resolved = true;
                setIsRecovery(true);
                setChecking(false);
              } else if (!resolved) {
                resolved = true;
                setChecking(false);
              }
            });
          }
        }, 2000);
      }
    });

    // Fallback timeout
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Last chance: check if there's a valid session
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            setIsRecovery(true);
          }
          setChecking(false);
        });
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

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
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
    } else {
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
