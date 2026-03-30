import { Button } from "@/components/ui/button";
import { Hash, Lock, Users, UserPlus, PanelRightOpen } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  type: string;
  description: string | null;
  sector: string | null;
}

interface Props {
  channel: Channel | null;
  memberCount: number;
  onToggleDetails: () => void;
  onAddMember?: () => void;
}

export default function ChannelHeader({ channel, memberCount, onToggleDetails, onAddMember }: Props) {
  if (!channel) {
    return (
      <div className="flex h-14 items-center border-b border-border bg-card px-4">
        <span className="text-sm text-muted-foreground">Selecione um canal para começar</span>
      </div>
    );
  }

  return (
    <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2 min-w-0">
        {channel.type === "private" ? <Lock className="h-4 w-4 text-muted-foreground shrink-0" /> : <Hash className="h-4 w-4 text-muted-foreground shrink-0" />}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{channel.name}</h3>
          {channel.description && (
            <p className="text-[11px] text-muted-foreground truncate">{channel.description}</p>
          )}
        </div>
        {channel.sector && (
          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {channel.sector}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {onAddMember && (
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={onAddMember} title="Adicionar participante">
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={onToggleDetails}>
          <Users className="h-3.5 w-3.5" /> {memberCount}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onToggleDetails}>
          <PanelRightOpen className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
