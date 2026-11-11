import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pin, Reply, Smile, Pencil, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VisualizadorPdf, type PdfParaAbrir } from "@/components/shared/VisualizadorPdf";
import { renovarLink } from "@/lib/anexos";

/** Imagem do chat: se o link guardado venceu, gera um novo sozinho. */
function ImagemAnexo({ url, nome }: { url: string; nome: string | null }) {
  const [src, setSrc] = useState(url);
  const tentou = useRef(false);
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="mt-1 block">
      <img
        src={src}
        alt={nome || "Imagem"}
        onError={() => {
          if (tentou.current) return;
          tentou.current = true;
          void renovarLink(url).then((novo) => { if (novo !== url) setSrc(novo); });
        }}
        className="max-w-[240px] max-h-[180px] rounded-lg border border-border object-cover"
      />
      <span className="text-[10px] text-muted-foreground mt-0.5 block">{nome}</span>
    </a>
  );
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

interface Props {
  messages: Message[];
  onReply: (msg: Message) => void;
  onRefresh: () => void;
}

const EMOJIS = ["👍", "❤️", "😂", "🔥", "✅", "👀", "🎉", "⚠️"];

export default function ChatMessages({ messages, onReply, onRefresh }: Props) {
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [pdf, setPdf] = useState<PdfParaAbrir | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleReact = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = messages.find(m => m.id === messageId)?.reactions?.find(r => r.emoji === emoji && r.user_id === user.id);
    if (existing) {
      await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", user.id).eq("emoji", emoji);
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    }
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("messages").update({ deleted_at: new Date().toISOString(), content: "[mensagem removida]" }).eq("id", id);
    onRefresh();
    toast.success("Mensagem removida");
  };

  const handlePin = async (msg: Message) => {
    if (!user) return;
    // Check if already pinned
    const { data: existing } = await supabase
      .from("pinned_messages")
      .select("id")
      .eq("message_id", msg.id)
      .eq("channel_id", msg.channel_id)
      .maybeSingle();

    if (existing) {
      await supabase.from("pinned_messages").delete().eq("id", existing.id);
      toast.success("Mensagem desafixada");
    } else {
      await supabase.from("pinned_messages").insert({ message_id: msg.id, channel_id: msg.channel_id, pinned_by: user.id });
      toast.success("Mensagem fixada");
    }
    onRefresh();
  };

  const saveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    await supabase.from("messages").update({ content: editContent, is_edited: true }).eq("id", editingId);
    setEditingId(null);
    onRefresh();
  };

  // Group messages by date
  let lastDate = "";

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {messages.map((msg) => {
        const msgDate = format(new Date(msg.created_at), "dd 'de' MMMM", { locale: ptBR });
        const showDate = msgDate !== lastDate;
        lastDate = msgDate;
        const isOwn = msg.user_id === user?.id;
        const isDeleted = !!msg.deleted_at;
        const displayName = msg.profiles?.display_name || "Usuário";
        const initial = displayName.charAt(0).toUpperCase();

        // Group reactions
        const reactionMap: Record<string, string[]> = {};
        (msg.reactions || []).forEach(r => {
          if (!reactionMap[r.emoji]) reactionMap[r.emoji] = [];
          reactionMap[r.emoji].push(r.user_id);
        });

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground">{msgDate}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {/* Thread indicator */}
            {msg.parent_message_id && (
              <div className="ml-10 mb-0.5 text-[10px] text-muted-foreground flex items-center gap-1">
                <Reply className="h-3 w-3" /> em resposta
              </div>
            )}

            <div className={cn("group flex gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors", isDeleted && "opacity-50")}>
              {/* Avatar */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                {initial}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{displayName}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(msg.created_at), "HH:mm")}
                  </span>
                  {msg.is_edited && <span className="text-[10px] text-muted-foreground italic">(editado)</span>}
                </div>

                {editingId === msg.id ? (
                  <div className="flex gap-2 mt-1">
                    <input
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveEdit()}
                      className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                    <Button size="sm" onClick={saveEdit}>Salvar</Button>
                  </div>
                ) : (
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{msg.content}</p>
                )}

                {/* Attachment */}
                {msg.attachment_url && !isDeleted && (() => {
                  const name = (msg.attachment_name || "").toLowerCase();
                  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
                  const isPdf = /\.pdf$/i.test(name);

                  if (isImage) {
                    return <ImagemAnexo url={msg.attachment_url!} nome={msg.attachment_name} />;
                  }

                  if (isPdf) {
                    return (
                      <button
                        type="button"
                        onClick={() => setPdf({ nome: msg.attachment_name || "Documento.pdf", obterUrl: () => renovarLink(msg.attachment_url!) })}
                        title="Abrir o PDF aqui no sistema"
                        className="mt-1 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs hover:bg-muted transition-colors"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded bg-red-100 text-red-600 text-[10px] font-bold">PDF</span>
                        <span className="truncate max-w-[180px]">{msg.attachment_name || "Documento PDF"}</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      type="button"
                      onClick={() => void renovarLink(msg.attachment_url!).then((u) => window.open(u, "_blank", "noopener,noreferrer"))}
                      className="mt-1 inline-flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-xs text-primary hover:underline"
                    >
                      📎 {msg.attachment_name || "Anexo"}
                    </button>
                  );
                })()}

                {/* Reactions */}
                {Object.keys(reactionMap).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(reactionMap).map(([emoji, users]) => (
                      <button
                        key={emoji}
                        onClick={() => handleReact(msg.id, emoji)}
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                          users.includes(user?.id || "")
                            ? "border-primary/30 bg-primary/10"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        {emoji} <span className="text-[10px]">{users.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              {!isDeleted && (
                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6"><Smile className="h-3.5 w-3.5" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2 flex gap-1">
                      {EMOJIS.map(e => (
                        <button key={e} onClick={() => handleReact(msg.id, e)} className="text-lg hover:scale-125 transition-transform">{e}</button>
                      ))}
                    </PopoverContent>
                  </Popover>

                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onReply(msg)} title="Responder">
                    <Reply className="h-3.5 w-3.5" />
                  </Button>

                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handlePin(msg)} title="Fixar/Desafixar">
                    <Pin className="h-3.5 w-3.5" />
                  </Button>

                  {isOwn && (
                    <>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDelete(msg.id)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
      <VisualizadorPdf arquivo={pdf} onClose={() => setPdf(null)} />
    </div>
  );
}
