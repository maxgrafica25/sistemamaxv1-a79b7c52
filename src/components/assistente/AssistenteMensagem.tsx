import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, User, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHIP_MARKER = "[JULIA_CHIPS:lead_time]";

interface AssistenteMensagemProps {
  role: "user" | "assistant";
  content: string;
  chipsEnabled?: boolean;
  onChipClick?: (text: string) => void;
  timestamp?: number;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  if (isToday(d)) return format(d, "HH:mm", { locale: ptBR });
  if (isYesterday(d)) return `ontem ${format(d, "HH:mm", { locale: ptBR })}`;
  return format(d, "dd/MM HH:mm", { locale: ptBR });
}

export function AssistenteMensagem({ role, content, chipsEnabled, onChipClick, timestamp }: AssistenteMensagemProps) {
  const isUser = role === "user";
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const hasChips = !isUser && content.includes(CHIP_MARKER);
  const cleanContent = hasChips ? content.replace(CHIP_MARKER, "").trim() : content;

  function handleChip(text: string) {
    if (!chipsEnabled || !onChipClick) return;
    onChipClick(text);
  }

  function submitCustom() {
    const v = customValue.trim();
    if (!v || !chipsEnabled || !onChipClick) return;
    onChipClick(v);
    setCustomValue("");
    setCustomMode(false);
  }

  return (
    <div className={cn("flex gap-2 items-start", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className="flex flex-col gap-2 max-w-[85%]">
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm",
          )}
        >
          {cleanContent}
        </div>
        {hasChips && chipsEnabled && (
          <div className="flex flex-col gap-2">
            {!customMode ? (
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleChip("na hora")}>
                  Na hora
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleChip("1 hora antes")}>
                  1 hora antes
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleChip("3 horas antes")}>
                  3 horas antes
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCustomMode(true)}>
                  Personalizar
                </Button>
              </div>
            ) : (
              <div className="flex gap-1.5 items-center">
                <Input
                  autoFocus
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitCustom();
                    }
                  }}
                  placeholder="Ex.: 30min, 2h, 1 dia"
                  className="h-7 text-xs"
                />
                <Button size="icon" className="h-7 w-7 shrink-0" onClick={submitCustom} disabled={!customValue.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
