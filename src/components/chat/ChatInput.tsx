import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, X, Reply, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";

interface ReplyTo {
  id: string;
  content: string;
  profiles?: { display_name: string } | null;
}

interface Props {
  channelId: string;
  replyTo: ReplyTo | null;
  onClearReply: () => void;
  onSent: () => void;
}

export default function ChatInput({ channelId, replyTo, onClearReply, onSent }: Props) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 20MB)");
      return;
    }
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("chat-attachments").upload(path, file);
    if (uploadError) {
      handleError(uploadError, "enviar arquivo");
      setUploading(true);
      return;
    }
    // Para buckets privados, precisamos de uma URL assinada. 
    // Usamos uma validade longa (1 ano) para a URL persistida na mensagem.
    const { data: signData, error: signError } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signError) {
      handleError(signError, "gerar link do arquivo");
      setUploading(false);
      return;
    }
    setAttachment({ url: signData.signedUrl, name: file.name });
    setUploading(false);
  };

  const handleSend = async () => {
    if ((!content.trim() && !attachment) || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      channel_id: channelId,
      user_id: user.id,
      content: content.trim(),
      parent_message_id: replyTo?.id || null,
      attachment_url: attachment?.url || null,
      attachment_name: attachment?.name || null,
    });
    setSending(false);
    if (error) return handleError(error, "enviar mensagem");
    setContent("");
    setAttachment(null);
    onClearReply();
    onSent();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-card px-4 py-3">
      {/* Reply indicator */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded bg-muted px-3 py-1.5 text-xs">
          <Reply className="h-3 w-3 text-primary" />
          <span className="text-muted-foreground">Respondendo a</span>
          <span className="font-medium">{replyTo.profiles?.display_name || "Usuário"}</span>
          <span className="truncate text-muted-foreground flex-1">— {replyTo.content.slice(0, 60)}</span>
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onClearReply}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Attachment preview */}
      {attachment && (
        <div className="mb-2 flex items-center gap-2 rounded bg-muted px-3 py-1.5 text-xs">
          📎 <span className="truncate">{attachment.name}</span>
          <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto" onClick={() => setAttachment(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect} />
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[36px] max-h-[120px]"
          style={{ height: "36px" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "36px";
            target.style.height = Math.min(target.scrollHeight, 120) + "px";
          }}
        />

        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={(!content.trim() && !attachment) || sending || uploading}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
