import { cn } from "@/lib/utils";
import { Sparkles, User } from "lucide-react";

interface AssistenteMensagemProps {
  role: "user" | "assistant";
  content: string;
}

export function AssistenteMensagem({ role, content }: AssistenteMensagemProps) {
  const isUser = role === "user";
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
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm",
        )}
      >
        {content}
      </div>
    </div>
  );
}
