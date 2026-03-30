import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChannelHeader from "@/components/chat/ChannelHeader";
import ChatMessages from "@/components/chat/ChatMessages";
import ChatInput from "@/components/chat/ChatInput";
import ChannelDetailsPanel from "@/components/chat/ChannelDetailsPanel";
import AddMemberDialog from "@/components/chat/AddMemberDialog";

interface Channel {
  id: string;
  name: string;
  type: string;
  sector: string | null;
  description: string | null;
  is_archived: boolean;
  created_by: string | null;
}

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  parent_message_id: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  is_edited: boolean;
  deleted_at: string | null;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null; role: string } | null;
  reactions?: { emoji: string; user_id: string }[];
}

export default function Chat() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [showAddMember, setShowAddMember] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const canManageMembers = profile?.role === "admin" || 
    channels.find(c => c.id === activeChannelId)?.created_by === user?.id;

  // Load channels
  const loadChannels = useCallback(async () => {
    const { data } = await supabase.from("channels").select("*").eq("is_archived", false).order("created_at");
    if (data) {
      setChannels(data as Channel[]);
      if (!activeChannelId && data.length > 0) setActiveChannelId(data[0].id);
    }
  }, [activeChannelId]);

  useEffect(() => {
    if (user) {
      loadChannels();
    }
  }, [user, loadChannels]);

  // Load messages for active channel
  const loadMessages = useCallback(async () => {
    if (!activeChannelId) return;
    setLoadingMessages(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("channel_id", activeChannelId)
      .order("created_at", { ascending: true })
      .limit(200);

    // Fetch profiles for message authors
    const userIds = [...new Set((data || []).map(m => m.user_id))];
    const { data: profilesData } = userIds.length > 0
      ? await supabase.from("profiles").select("user_id, display_name, avatar_url, role").in("user_id", userIds)
      : { data: [] };
    const profileMap: Record<string, { display_name: string; avatar_url: string | null; role: string }> = {};
    (profilesData || []).forEach(p => { profileMap[p.user_id] = p; });

    if (data) {
      // Load reactions for all messages
      const msgIds = data.map(m => m.id);
      const { data: reactions } = await supabase
        .from("message_reactions")
        .select("message_id, emoji, user_id")
        .in("message_id", msgIds.length > 0 ? msgIds : ["none"]);

      const reactionMap: Record<string, { emoji: string; user_id: string }[]> = {};
      (reactions || []).forEach(r => {
        if (!reactionMap[r.message_id]) reactionMap[r.message_id] = [];
        reactionMap[r.message_id].push({ emoji: r.emoji, user_id: r.user_id });
      });

      setMessages((data || []).map(m => ({ ...m, profiles: profileMap[m.user_id] || null, reactions: reactionMap[m.id] || [] })) as Message[]);
    }

    // Update member count and ids
    const { data: membersData } = await supabase.from("channel_members").select("user_id").eq("channel_id", activeChannelId);
    setMemberCount(membersData?.length || 0);
    setMemberIds((membersData || []).map(m => m.user_id));

    // Mark as read
    if (user) {
      await supabase.from("message_reads").upsert(
        { channel_id: activeChannelId, user_id: user.id, last_read_at: new Date().toISOString() },
        { onConflict: "channel_id,user_id" }
      );
    }

    setLoadingMessages(false);
  }, [activeChannelId, user]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!activeChannelId) return;

    const channel = supabase
      .channel(`messages-${activeChannelId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `channel_id=eq.${activeChannelId}`,
      }, () => {
        loadMessages();
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "message_reactions",
      }, () => {
        loadMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChannelId, loadMessages]);

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) return null;

  const activeChannel = channels.find(c => c.id === activeChannelId) || null;

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={setActiveChannelId}
        unreadMap={unreadMap}
        onChannelCreated={loadChannels}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <ChannelHeader
          channel={activeChannel}
          memberCount={memberCount}
          onToggleDetails={() => setShowDetails(p => !p)}
          onAddMember={canManageMembers ? () => setShowAddMember(true) : undefined}
        />

        {activeChannelId ? (
          <>
            {loadingMessages ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <ChatMessages
                messages={messages}
                onReply={setReplyTo}
                onRefresh={loadMessages}
              />
            )}

            <ChatInput
              channelId={activeChannelId}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(null)}
              onSent={loadMessages}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Selecione um canal para começar
          </div>
        )}
      </div>

      {showDetails && activeChannel && (
        <ChannelDetailsPanel
          channel={activeChannel}
          onClose={() => setShowDetails(false)}
        />
      )}

      {activeChannelId && (
        <AddMemberDialog
          channelId={activeChannelId}
          existingMemberIds={memberIds}
          open={showAddMember}
          onOpenChange={setShowAddMember}
          onMemberAdded={() => { loadMessages(); setShowAddMember(false); }}
        />
      )}
    </div>
  );
}
