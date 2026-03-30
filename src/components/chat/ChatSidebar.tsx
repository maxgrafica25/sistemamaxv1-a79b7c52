import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Hash, Lock, Plus, Search, MessageSquare, LogOut, ChevronDown, ChevronRight, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import CreateChannelDialog from "./CreateChannelDialog";

interface Channel {
  id: string;
  name: string;
  type: string;
  sector: string | null;
  description: string | null;
  is_archived: boolean;
}

interface UnreadMap {
  [channelId: string]: number;
}

interface Props {
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (id: string) => void;
  unreadMap: UnreadMap;
  onChannelCreated: () => void;
}

export default function ChatSidebar({ channels, activeChannelId, onSelectChannel, unreadMap, onChannelCreated }: Props) {
  const { profile, signOut } = useAuth();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [sectorsOpen, setSectorsOpen] = useState<Record<string, boolean>>({ "Canais": true, "Setores": true });

  const filtered = channels.filter(c => !c.is_archived && c.name.toLowerCase().includes(search.toLowerCase()));

  const generalChannels = filtered.filter(c => !c.sector && c.type !== 'direct');
  const sectors = [...new Set(filtered.filter(c => c.sector).map(c => c.sector!))];
  const sectorGroups = sectors.map(s => ({
    name: s,
    channels: filtered.filter(c => c.sector === s),
  }));

  const toggle = (key: string) => setSectorsOpen(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-lg font-bold text-primary">Chat</h2>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar canal..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {/* General channels */}
        <SectionHeader label="Canais" isOpen={sectorsOpen["Canais"]} onToggle={() => toggle("Canais")} />
        {sectorsOpen["Canais"] && generalChannels.map(ch => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            active={ch.id === activeChannelId}
            unread={unreadMap[ch.id] || 0}
            onClick={() => onSelectChannel(ch.id)}
          />
        ))}

        {/* Sector groups */}
        {sectorGroups.map(group => (
          <div key={group.name}>
            <SectionHeader label={group.name} isOpen={sectorsOpen[group.name] !== false} onToggle={() => toggle(group.name)} />
            {sectorsOpen[group.name] !== false && group.channels.map(ch => (
              <ChannelItem
                key={ch.id}
                channel={ch}
                active={ch.id === activeChannelId}
                unread={unreadMap[ch.id] || 0}
                onClick={() => onSelectChannel(ch.id)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="border-t border-border px-3 py-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
          {profile?.display_name?.charAt(0).toUpperCase() || <User className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{profile?.display_name || "Usuário"}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{profile?.role}</p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={signOut}>
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>

      <CreateChannelDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onChannelCreated} />
    </div>
  );
}

function SectionHeader({ label, isOpen, onToggle }: { label: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex w-full items-center gap-1 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      {label}
    </button>
  );
}

function ChannelItem({ channel, active, unread, onClick }: { channel: Channel; active: boolean; unread: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-muted",
      )}
    >
      {channel.type === "private" ? <Lock className="h-3.5 w-3.5 shrink-0" /> : channel.type === "direct" ? <MessageSquare className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{channel.name}</span>
      {unread > 0 && <Badge className="ml-auto h-4 min-w-[16px] px-1 text-[10px] bg-destructive">{unread}</Badge>}
    </button>
  );
}
