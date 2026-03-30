import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Pin, Users, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AddMemberDialog from "./AddMemberDialog";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Channel {
  id: string;
  name: string;
  type: string;
  description: string | null;
  sector: string | null;
  is_archived: boolean;
  created_by: string | null;
}

interface Member {
  user_id: string;
  role: string;
  profiles: { display_name: string; role: string } | null;
}

interface PinnedMsg {
  id: string;
  message_id: string;
  content: string;
  author_name: string;
}

interface Props {
  channel: Channel;
  onClose: () => void;
}

export default function ChannelDetailsPanel({ channel, onClose }: Props) {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [pinned, setPinned] = useState<PinnedMsg[]>([]);
  const [tab, setTab] = useState<"members" | "pinned">("members");
  const [showAddMember, setShowAddMember] = useState(false);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);

  const canManageMembers = profile?.role === "admin" || channel.created_by === profile?.user_id;

  useEffect(() => {
    loadData();
  }, [channel.id]);

  const loadData = async () => {
    // Load members
    const { data: memberData } = await supabase
      .from("channel_members")
      .select("user_id, role")
      .eq("channel_id", channel.id);

    const members = memberData || [];
    const userIds = members.map(m => m.user_id);

    let profileMap: Record<string, { display_name: string; role: string }> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name, role")
        .in("user_id", userIds);
      (profilesData || []).forEach(p => { profileMap[p.user_id] = p; });
    }
    setMembers(members.map(m => ({ ...m, profiles: profileMap[m.user_id] || null })) as Member[]);

    // Load pinned messages - separate queries since no direct join
    const { data: pinnedData } = await supabase
      .from("pinned_messages")
      .select("id, message_id")
      .eq("channel_id", channel.id);

    if (pinnedData && pinnedData.length > 0) {
      const msgIds = pinnedData.map(p => p.message_id);
      const { data: messagesData } = await supabase
        .from("messages")
        .select("id, content, user_id")
        .in("id", msgIds);

      const msgUserIds = [...new Set((messagesData || []).map(m => m.user_id))];
      let msgProfileMap: Record<string, string> = {};
      if (msgUserIds.length > 0) {
        const { data: msgProfiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", msgUserIds);
        (msgProfiles || []).forEach(p => { msgProfileMap[p.user_id] = p.display_name; });
      }

      const msgMap: Record<string, { content: string; user_id: string }> = {};
      (messagesData || []).forEach(m => { msgMap[m.id] = m; });

      setPinned(pinnedData.map(p => ({
        id: p.id,
        message_id: p.message_id,
        content: msgMap[p.message_id]?.content || "",
        author_name: msgProfileMap[msgMap[p.message_id]?.user_id] || "Usuário",
      })));
    } else {
      setPinned([]);
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;
    const { error } = await supabase
      .from("channel_members")
      .delete()
      .eq("channel_id", channel.id)
      .eq("user_id", removingMember.user_id);

    if (error) {
      toast.error("Erro ao remover participante");
    } else {
      toast.success("Participante removido!");
      loadData();
    }
    setRemovingMember(null);
  };

  return (
    <div className="flex h-full w-72 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Detalhes do Canal</h3>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-3 border-b border-border">
        <h4 className="font-semibold text-sm">#{channel.name}</h4>
        {channel.description && <p className="text-xs text-muted-foreground mt-1">{channel.description}</p>}
        <div className="flex gap-2 mt-2">
          <Badge variant="secondary" className="text-[10px]">{channel.type === "private" ? "Privado" : "Público"}</Badge>
          {channel.sector && <Badge variant="outline" className="text-[10px]">{channel.sector}</Badge>}
        </div>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("members")}
          className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === "members" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >
          <Users className="h-3 w-3 inline mr-1" /> Participantes ({members.length})
        </button>
        <button
          onClick={() => setTab("pinned")}
          className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === "pinned" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >
          <Pin className="h-3 w-3 inline mr-1" /> Fixadas ({pinned.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "members" && (
          <div className="space-y-1">
            {canManageMembers && (
              <Button
                size="sm"
                variant="outline"
                className="w-full mb-2 gap-1.5 text-xs"
                onClick={() => setShowAddMember(true)}
              >
                <UserPlus className="h-3.5 w-3.5" /> Adicionar Participante
              </Button>
            )}
            {members.map(m => (
              <div key={m.user_id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted group">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                  {m.profiles?.display_name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{m.profiles?.display_name || "Usuário"}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{m.profiles?.role || m.role}</p>
                </div>
                {canManageMembers && m.user_id !== profile?.user_id && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                    onClick={() => setRemovingMember(m)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum participante</p>
            )}
          </div>
        )}

        {tab === "pinned" && (
          <div className="space-y-2">
            {pinned.map(p => (
              <div key={p.id} className="rounded border border-border p-2 text-xs group relative">
                <p className="font-medium">{p.author_name}</p>
                <p className="text-muted-foreground mt-0.5">{p.content?.slice(0, 100)}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    await supabase.from("pinned_messages").delete().eq("id", p.id);
                    toast.success("Mensagem desafixada");
                    loadData();
                  }}
                  title="Desafixar"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {pinned.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem fixada</p>
            )}
          </div>
        )}
      </div>

      <AddMemberDialog
        channelId={channel.id}
        existingMemberIds={members.map(m => m.user_id)}
        open={showAddMember}
        onOpenChange={setShowAddMember}
        onMemberAdded={() => { loadData(); setShowAddMember(false); }}
      />

      <ConfirmDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
        title="Remover Participante"
        description={`Tem certeza que deseja remover ${removingMember?.profiles?.display_name || "este usuário"} do canal?`}
        onConfirm={handleRemoveMember}
      />
    </div>
  );
}
