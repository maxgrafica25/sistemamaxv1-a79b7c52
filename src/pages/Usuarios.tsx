import { PageHeader } from "@/components/PageHeader";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { UserCog, UserPlus, Mail, ShieldCheck, ShieldOff, UserX, UserCheck, RefreshCw, Loader2, LogOut, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ConfirmDialog from "@/components/ConfirmDialog";
import InviteUserDialog from "@/components/usuarios/InviteUserDialog";
import { handleError } from "@/lib/handleError";

interface UserRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  email: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  created_at: string;
}

type ConfirmAction =
  | { kind: "toggle-role"; user: UserRow; nextRole: "admin" | "colaborador" }
  | { kind: "toggle-active"; user: UserRow; nextActive: boolean }
  | null;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function Usuarios() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [actingUserId, setActingUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_users_admin");
    if (error) {
      toast.error("Erro ao carregar usuários", { description: error.message });
      setRows([]);
    } else {
      setRows((data ?? []) as UserRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  // Restrição de acesso
  if (!isAdmin) {
    return (
      <div className="p-3 sm:p-4 md:p-6 lg:p-8">
        <Card className="p-8 md:p-12 text-center max-w-md mx-auto">
          <ShieldOff className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold mb-1">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Esta área é exclusiva para administradores do sistema.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={() => navigate("/")} className="gap-2">
              <Home className="h-4 w-4" />
              Voltar ao Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const handleToggleRole = async (user: UserRow) => {
    const nextRole = user.role === "admin" ? "colaborador" : "admin";
    setActingUserId(user.user_id);
    const { error } = await supabase
      .from("profiles")
      .update({ role: nextRole })
      .eq("user_id", user.user_id);

    setActingUserId(null);
    setConfirm(null);

    if (error) {
      handleError(error, "alterar perfil do usuário");
      return;
    }
    await supabase.from("audit_logs").insert({
      action: "change_user_role",
      entity_type: "profile",
      entity_id: user.user_id,
      entity_name: user.display_name ?? user.email ?? user.user_id,
      details: `Perfil alterado para "${nextRole}" por ${profile?.display_name ?? "admin"}`,
    });
    toast.success(`${user.display_name ?? "Usuário"} agora é ${nextRole === "admin" ? "Administrador" : "Colaborador"}.`);
    load();
  };

  const handleToggleActive = async (user: UserRow) => {
    const nextActive = !user.is_active;
    setActingUserId(user.user_id);
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: nextActive })
      .eq("user_id", user.user_id);

    setActingUserId(null);
    setConfirm(null);

    if (error) {
      handleError(error, "alterar status do usuário");
      return;
    }
    await supabase.from("audit_logs").insert({
      action: nextActive ? "activate_user" : "deactivate_user",
      entity_type: "profile",
      entity_id: user.user_id,
      entity_name: user.display_name ?? user.email ?? user.user_id,
      details: `Usuário ${nextActive ? "ativado" : "desativado"} por ${profile?.display_name ?? "admin"}`,
    });
    toast.success(`Usuário ${nextActive ? "ativado" : "desativado"}.`);
    load();
  };

  const handleResendInvite = async (user: UserRow) => {
    if (!user.email) return;
    setActingUserId(user.user_id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Link de acesso reenviado", {
        description: `Um novo e-mail foi enviado para ${user.email}.`,
      });
    } catch (e: any) {
      toast.error("Falha ao reenviar", { description: e?.message ?? "Tente novamente." });
    } finally {
      setActingUserId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader icon={UserCog} title="Usuários" description="Gerencie quem tem acesso ao sistema e seus perfis de permissão." />
        <Button onClick={() => setInviteOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Convidar Usuário
        </Button>
      </div>

      {/* Tabela */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full max-w-[140px]" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">
                  Nenhum usuário cadastrado ainda.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((u) => {
                const pending = !u.email_confirmed_at;
                const isMe = u.user_id === profile?.user_id;
                const acting = actingUserId === u.user_id;
                return (
                  <TableRow key={u.user_id} className={!u.is_active ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{u.display_name ?? "—"}</span>
                        {isMe && (
                          <Badge variant="outline" className="text-[10px] uppercase">você</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      {u.role === "admin" ? (
                        <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-primary/20">
                          Administrador
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Colaborador</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!u.is_active ? (
                        <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground inline-block" />
                          Inativo
                        </Badge>
                      ) : pending ? (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                          Convite pendente
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                          Ativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(u.last_sign_in_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <TooltipProvider delayDuration={200}>
                          {pending && u.is_active && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon" variant="ghost"
                                  disabled={acting}
                                  onClick={() => handleResendInvite(u)}
                                  aria-label="Reenviar convite"
                                >
                                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Reenviar convite por e-mail</TooltipContent>
                            </Tooltip>
                          )}

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon" variant="ghost"
                                disabled={acting || isMe}
                                onClick={() => setConfirm({
                                  kind: "toggle-role", user: u,
                                  nextRole: u.role === "admin" ? "colaborador" : "admin",
                                })}
                                aria-label="Alterar perfil"
                              >
                                {u.role === "admin" ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isMe ? "Você não pode alterar o próprio perfil" :
                                u.role === "admin" ? "Tornar Colaborador" : "Tornar Administrador"}
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon" variant="ghost"
                                disabled={acting || isMe}
                                onClick={() => setConfirm({
                                  kind: "toggle-active", user: u, nextActive: !u.is_active,
                                })}
                                aria-label={u.is_active ? "Desativar" : "Ativar"}
                              >
                                {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isMe ? "Você não pode desativar a si mesmo" :
                                u.is_active ? "Desativar usuário" : "Reativar usuário"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{rows.length} usuário(s)</span>
        <Button size="sm" variant="ghost" onClick={load} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={load}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title={
          confirm?.kind === "toggle-role"
            ? `Alterar perfil de ${confirm.user.display_name ?? "usuário"}?`
            : confirm?.kind === "toggle-active"
              ? (confirm.nextActive ? "Reativar este usuário?" : "Desativar este usuário?")
              : undefined
        }
        description={
          confirm?.kind === "toggle-role"
            ? `O perfil será alterado para "${confirm.nextRole === "admin" ? "Administrador" : "Colaborador"}". A mudança vale no próximo carregamento de página do usuário.`
            : confirm?.kind === "toggle-active"
              ? (confirm.nextActive
                  ? "O usuário voltará a aparecer normalmente. Ele continuará com o mesmo perfil que tinha antes."
                  : "O usuário continuará no banco, mas será marcado como inativo e não deveria mais ser usado para acessar o sistema. Você pode reativá-lo a qualquer momento.")
              : undefined
        }
        confirmText={
          confirm?.kind === "toggle-role" ? "Confirmar alteração" :
          confirm?.kind === "toggle-active" && confirm.nextActive ? "Reativar" :
          "Desativar"
        }
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "toggle-role") handleToggleRole(confirm.user);
          else handleToggleActive(confirm.user);
        }}
      />
    </div>
  );
}
