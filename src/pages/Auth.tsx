import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 255;
const MAX_NAME_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 72;
const OTP_COOLDOWN_SECONDS = 60;

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // OTP recovery state
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpLocked, setOtpLocked] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const validateEmail = (email: string): boolean => {
    if (!email || email.length > MAX_EMAIL_LENGTH) return false;
    return EMAIL_REGEX.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
  };

  const handleSendOtp = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateEmail(email)) { toast.error("E-mail inválido"); return; }
    if (cooldown > 0) { toast.error(`Aguarde ${cooldown}s para reenviar`); return; }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/reset-password`,
      },
    });

    if (error) {
      // Don't reveal if email exists or not
      toast.success("Se o e-mail estiver cadastrado, você receberá um código de acesso.");
    } else {
      toast.success("Código enviado! Verifique seu e-mail.");
    }

    // Always set sent state and cooldown (prevents email enumeration)
    setOtpSent(true);
    setOtpAttempts(0);
    setOtpLocked(false);
    setOtpValue("");
    setCooldown(OTP_COOLDOWN_SECONDS);
    setLoading(false);
  }, [email, cooldown]);

  const handleVerifyOtp = useCallback(async (code: string) => {
    if (otpLocked) { toast.error("Muitas tentativas. Solicite um novo código."); return; }
    if (code.length !== OTP_LENGTH) return;

    setLoading(true);
    const newAttempts = otpAttempts + 1;
    setOtpAttempts(newAttempts);

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: "email",
    });

    if (error) {
      if (newAttempts >= MAX_OTP_ATTEMPTS) {
        setOtpLocked(true);
        toast.error("Limite de tentativas atingido. Solicite um novo código.");
      } else {
        toast.error(`Código inválido. ${MAX_OTP_ATTEMPTS - newAttempts} tentativa(s) restante(s).`);
      }
      setOtpValue("");
    }
    // Success is handled by onAuthStateChange
    setLoading(false);
  }, [email, otpAttempts, otpLocked]);

  const handleOtpChange = useCallback((value: string) => {
    // Only allow numeric input
    const sanitized = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setOtpValue(sanitized);
    if (sanitized.length === OTP_LENGTH) {
      handleVerifyOtp(sanitized);
    }
  }, [handleVerifyOtp]);

  const resetOtpMode = () => {
    setOtpMode(false);
    setOtpSent(false);
    setOtpValue("");
    setOtpAttempts(0);
    setOtpLocked(false);
    setCooldown(0);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) { toast.error("E-mail inválido"); return; }
    if (!validatePassword(password)) { toast.error(`Senha deve ter entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres`); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) toast.error(error.message);
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
    if (error) toast.error(error.message);
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
              {otpMode ? (
                <div className="space-y-4 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground"
                    onClick={resetOtpMode}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para o login
                  </Button>

                  {!otpSent ? (
                    <form onSubmit={handleSendOtp} className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span>Enviaremos um código de 6 dígitos para seu e-mail</span>
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
                        Enviar Código
                      </Button>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Digite o código de 6 dígitos enviado para <strong className="text-foreground">{email}</strong>
                      </p>

                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={OTP_LENGTH}
                          value={otpValue}
                          onChange={handleOtpChange}
                          disabled={loading || otpLocked}
                        >
                          <InputOTPGroup>
                            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                              <InputOTPSlot key={i} index={i} />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>

                      {loading && (
                        <div className="flex justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      )}

                      {otpLocked && (
                        <p className="text-sm text-destructive text-center font-medium">
                          Limite de tentativas atingido. Solicite um novo código.
                        </p>
                      )}

                      {!otpLocked && otpAttempts > 0 && (
                        <p className="text-sm text-muted-foreground text-center">
                          {MAX_OTP_ATTEMPTS - otpAttempts} tentativa(s) restante(s)
                        </p>
                      )}

                      <div className="text-center">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          disabled={cooldown > 0 || loading}
                          onClick={() => handleSendOtp()}
                          className="text-sm"
                        >
                          {cooldown > 0
                            ? `Reenviar código em ${cooldown}s`
                            : "Reenviar código"}
                        </Button>
                      </div>
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
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm text-muted-foreground"
                    onClick={() => setOtpMode(true)}
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
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
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
