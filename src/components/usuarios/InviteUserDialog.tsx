import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const Schema = z.object({
  display_name: z.string().trim().min(2, "Nome muito curto").max(100, "Nome muito longo"),
  email: z.string().trim().email("E-mail inválido").max(255),
  role: z.enum(["admin", "colaborador"]),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: () => void;
}

export default function InviteUserDialog({ open, onOpenChange, onInvited }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "colaborador">("colaborador");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setDisplayName("");
    setEmail("");
    setRole("colaborador");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Schema.safeParse({ display_name: displayName, email, role });
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      toast.error(first ?? "Dados inválidos");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          ...parsed.data,
          redirect_to: `${window.location.origin}/reset-password`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Convite enviado!", {
        description: `${parsed.data.display_name} receberá um e-mail para definir a senha.`,
      });
      reset();
      onInvited();
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.message ?? "Erro ao enviar convite";
      toast.error(msg.toLowerCase().includes("already")
        ? "Este e-mail já está cadastrado no sistema."
        : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Convidar Usuário
          </DialogTitle>
          <DialogDescription>
            O convidado receberá um e-mail com um link para definir a própria senha e entrar no sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-name">Nome Completo</Label>
            <Input
              id="invite-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex.: Maria Silva"
              maxLength={100}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email">E-mail</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@empresa.com.br"
              maxLength={255}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Perfil de acesso</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "colaborador")} disabled={loading}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="colaborador">Colaborador</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === "admin"
                ? "Acesso completo: gestão de usuários, backups, financeiro e configurações."
                : "Acesso operacional ao sistema, sem áreas restritas."}
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
