import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  display_name: string;
  role: string;
}

interface Props {
  channelId: string;
  existingMemberIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: () => void;
}

export default function AddMemberDialog({ channelId, existingMemberIds, open, onOpenChange, onMemberAdded }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (open) loadProfiles();
  }, [open]);

  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("user_id, display_name, role");
    if (data) setProfiles(data);
  };

  const available = profiles.filter(
    p => !existingMemberIds.includes(p.user_id) &&
      p.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (userId: string) => {
    setAdding(userId);
    const { error } = await supabase.from("channel_members").insert({
      channel_id: channelId,
      user_id: userId,
      role: "member",
    });
    if (error) {
      toast.error("Sem permissão para adicionar membros neste canal");
    } else {
      toast.success("Membro adicionado!");
      onMemberAdded();
    }
    setAdding(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Adicionar Participante</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1">
          {available.map(p => (
            <div key={p.user_id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                  {p.display_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-medium">{p.display_name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{p.role}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                disabled={adding === p.user_id}
                onClick={() => handleAdd(p.user_id)}
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {available.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              {profiles.length === 0 ? "Carregando..." : "Nenhum usuário disponível"}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
