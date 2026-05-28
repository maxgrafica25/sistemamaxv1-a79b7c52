import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, ShieldCheck, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAuthEvent } from "@/lib/audit";
import { handleError } from "@/lib/handleError";


const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 255;
const MAX_NAME_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;
const COOLDOWN_SECONDS = 60;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const LOCKOUT_MS = LOCKOUT_MINUTES * 60 * 1000;


/**
 * Retorna a URL pública estável do app.
 * Evita usar a URL de preview privada do Lovable (id-preview--*.lovable.app)
 * que exige login no workspace e gera "Access denied" em links de e-mail.
 */
function getPublicAppUrl(): string {
  if (typeof window === "undefined") return "https://sistemamaxv1.lovable.app";
  const host = window.location.hostname;
  if (host.includes("id-preview--") || host.endsWith("lovable.dev")) {
    return "https://sistemamaxv1.lovable.app";
  }
  return window.location.origin;
}

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Recovery mode state
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState<number | null>(null);


  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);
  
  // Lockout timer
  useEffect(() => {
    if (!email || !validateEmail(email)) {
      setLockoutRemaining(null);
      return;
    }

    const checkLockout = () => {
      const attemptsData = localStorage.getItem(`login_attempts_${email.trim()}`);
      if (!attemptsData) {
        setLockoutRemaining(null);
        return;
      }

      const { lockoutUntil } = JSON.parse(attemptsData);
      if (lockoutUntil) {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000 / 60);
        if (remaining > 0) {
          setLockoutRemaining(remaining);
        } else {
          // Lockout expired, but keep the count for now or clear if desired
          // Actually, if we are here, we should check if we should reset it
          setLockoutRemaining(null);
        }
      } else {
        setLockoutRemaining(null);
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [email]);


  const validateEmail = (email: string): boolean => {
    if (!email || email.length > MAX_EMAIL_LENGTH) return false;
    return EMAIL_REGEX.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
  };

  const handleSendRecoveryLink = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateEmail(email)) { toast.error("E-mail inválido"); return; }
    if (cooldown > 0) { toast.error(`Aguarde ${cooldown}s para reenviar`); return; }

    setLoading(true);
    // Use signInWithOtp which sends a magic link
    // Redirect to /reset-password so user must set a new password
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${getPublicAppUrl()}/reset-password`,
      },
    });

    // Audit log (sempre — sucesso ou e-mail inexistente, para evitar enumeração)
    await logAuthEvent("password_reset_requested", { email: email.trim() });

    // Always show success (prevents email enumeration)
    toast.success("Se o e-mail estiver cadastrado, você receberá um link de acesso.");
    setLinkSent(true);
    setCooldown(COOLDOWN_SECONDS);
    setLoading(false);
  }, [email, cooldown]);

  const resetRecoveryMode = () => {
    setRecoveryMode(false);
    setLinkSent(false);
    setCooldown(0);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!validateEmail(trimmedEmail)) { toast.error("E-mail inválido"); return; }
    if (!validatePassword(password)) { toast.error(`Senha deve ter entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres`); return; }

    // Check brute force lockout
    const attemptsKey = `login_attempts_${trimmedEmail}`;
    const attemptsData = JSON.parse(localStorage.getItem(attemptsKey) || '{"count": 0}');
    
    if (attemptsData.lockoutUntil && attemptsData.lockoutUntil > Date.now()) {
      const remaining = Math.ceil((attemptsData.lockoutUntil - Date.now()) / 1000 / 60);
      toast.error(`Muitas tentativas incorretas. Aguarde ${remaining} minutos antes de tentar novamente.`);
      return;
    }

    setLoading(true);

    // Backend brute force check
    try {
      const { data: checkData, error: checkError } = await supabase.functions.invoke('check-login-attempts', {
        body: { email: trimmedEmail }
      });

      if (checkError || (checkData && checkData.error)) {
        const errorMsg = checkError?.message || checkData?.error;
        toast.error(errorMsg || "Muitas tentativas. Tente novamente em 15 minutos.");
        setLoading(false);
        return;
      }
    } catch (e) {
      console.error("Erro ao verificar tentativas:", e);
      // Fallback to local check if function fails
    }

    const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
    
    // Record attempt result in background via Edge Function
    supabase.functions.invoke('check-login-attempts', {
      body: { email: trimmedEmail, success: !error }
    }).catch(err => console.error("Erro ao registrar tentativa:", err));
    
    if (error) {

      const newCount = (attemptsData.count || 0) + 1;
      let lockoutUntil = null;
      
      if (newCount >= MAX_LOGIN_ATTEMPTS) {
        lockoutUntil = Date.now() + LOCKOUT_MS;
        const remaining = Math.ceil(LOCKOUT_MS / 1000 / 60);
        toast.error(`Muitas tentativas incorretas. Aguarde ${remaining} minutos antes de tentar novamente.`);
        setLockoutRemaining(remaining);
      } else {
        handleError(error, "realizar login");
      }
      
      localStorage.setItem(attemptsKey, JSON.stringify({
        count: newCount,
        lockoutUntil
      }));
    } else {
      // Success: clear attempts
      localStorage.removeItem(attemptsKey);
      setLockoutRemaining(null);
    }

    setLoading(false);
  };


  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH) { toast.error(`Nome deve ter entre 1 e ${MAX_NAME_LENGTH} caracteres`); return; }
    if (!validateEmail(email)) { toast.error("E-mail inválido"); return; }
    if (!validatePassword(password)) { toast.error(`Senha deve ter entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres`); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: trimmedName } },
    });
    if (error) {
      if (/pwned|leaked|compromised/i.test(error.message)) {
        toast.error("Esta senha apareceu em vazamentos públicos. Escolha outra mais forte.");
      } else {
        handleError(error, "criar conta");
      }
    }

    else toast.success("Conta criada! Você já está logado.");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">OrçaGráfica</CardTitle>
          <CardDescription>Acesse a plataforma de gestão</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              {recoveryMode ? (
                <div className="space-y-4 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground"
                    onClick={resetRecoveryMode}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para o login
                  </Button>

                  {!linkSent ? (
                    <form onSubmit={handleSendRecoveryLink} className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span>Enviaremos um link seguro para redefinir sua senha</span>
                      </div>
                      <div className="space-y-2">
                        <Label>E-mail cadastrado</Label>
                        <Input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          placeholder="seu@email.com"
                          maxLength={MAX_EMAIL_LENGTH}
                          autoComplete="email"
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enviar Link de Recuperação
                      </Button>
                    </form>
                  ) : (
                    <div className="space-y-4 text-center">
                      <div className="flex justify-center">
                        <div className="rounded-full bg-primary/10 p-3">
                          <Mail className="h-8 w-8 text-primary" />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Verifique seu e-mail</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Enviamos um link de acesso para <strong>{email}</strong>.
                          Clique no link para definir uma nova senha.
                        </p>
                      </div>

                      <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground text-left space-y-1">
                        <p>• Verifique também a pasta de spam</p>
                        <p>• O link expira em poucos minutos</p>
                        <p>• Ao clicar, você será direcionado para criar uma nova senha</p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={cooldown > 0 || loading}
                        onClick={() => handleSendRecoveryLink()}
                        className="text-sm"
                      >
                        {cooldown > 0
                          ? `Reenviar em ${cooldown}s`
                          : "Reenviar link"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" maxLength={MAX_EMAIL_LENGTH} autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" maxLength={MAX_PASSWORD_LENGTH} autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || (lockoutRemaining !== null && lockoutRemaining > 0)}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {lockoutRemaining !== null && lockoutRemaining > 0 
                      ? `Bloqueado (${lockoutRemaining} min)` 
                      : "Entrar"}
                  </Button>

                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm text-muted-foreground"
                    onClick={() => setRecoveryMode(true)}
                  >
                    Esqueci minha senha
                  </Button>
                </form>
              )}
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} required placeholder="Seu nome completo" maxLength={MAX_NAME_LENGTH} autoComplete="name" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" maxLength={MAX_EMAIL_LENGTH} autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar Conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
