import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, Send, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AssistenteMensagem } from "./AssistenteMensagem";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; timestamp: number };

const HIDDEN_ROUTES = ["/auth", "/reset-password"];

export default function AssistenteButton() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // auto-scroll para a última mensagem (sentinela — o Viewport do Radix ScrollArea
  // ignora scrollTop manual num div filho).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // limpa contador ao abrir
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  if (!user) return null;
  if (HIDDEN_ROUTES.includes(pathname)) return null;

  async function enviar(override?: string) {
    const pergunta = (override ?? input).trim();
    if (!pergunta || loading) return;
    const novaUser: Msg = { role: "user", content: pergunta, timestamp: Date.now() };
    const historico = messages.slice(-10);
    setMessages((prev) => [...prev, novaUser]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("assistente-virtual", {
        body: { pergunta, historico },
      });

      if (error) {
        // erros HTTP do edge function vêm como FunctionsHttpError
        const ctx: any = (error as any).context;
        const status = ctx?.status;
        let msg = "Não consegui responder agora. Tente novamente.";
        try {
          const body = ctx ? await ctx.json() : null;
          if (body?.error) msg = body.error;
        } catch {
          // ignore
        }
        if (status === 429) {
          toast({
            title: "Muitas perguntas",
            description: "Aguarde alguns segundos antes de perguntar de novo.",
            variant: "destructive",
          });
        } else if (status === 402) {
          toast({
            title: "Créditos esgotados",
            description: "Adicione créditos para continuar usando o assistente.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Erro na Júlia", description: msg, variant: "destructive" });
        }
        setMessages((prev) => [...prev, { role: "assistant", content: msg, timestamp: Date.now() }]);
      } else {
        const resposta: string = data?.resposta ?? "Sem resposta.";
        setMessages((prev) => [...prev, { role: "assistant", content: resposta, timestamp: Date.now() }]);
        if (!open) setUnread((n) => n + 1);
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível contactar a Júlia.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Abrir Júlia, assistente virtual da Max Gráfica"
        onClick={() => setOpen(true)}
        style={{
          // Respeita safe-area do iPhone (home indicator) e mantém o mínimo do mobile
          bottom: "max(5rem, env(safe-area-inset-bottom) + 1rem)",
        }}
        className={cn(
          // Posição: mobile mais alto pra fugir da barra do navegador; desktop volta ao normal
          "fixed right-4 sm:right-6 sm:!bottom-6",
          // Z-index acima de Sheets/Dialogs/Toasts (que usam z-50)
          "z-[60]",
          // Touch target maior no mobile
          "h-14 w-14 sm:h-[52px] sm:w-[52px]",
          "rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "flex items-center justify-center",
          "hover:scale-105 active:scale-95 transition-transform",
          "ring-1 ring-primary/30",
          // Elimina delay de 300ms em alguns Androids
          "[touch-action:manipulation]",
        )}
      >
        <Sparkles className="h-6 w-6" />
        {unread > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs flex items-center justify-center"
          >
            {unread > 9 ? "9+" : unread}
          </Badge>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[420px] p-0 flex flex-col gap-0"
        >
          <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <SheetTitle className="text-base">Júlia</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>

          <ScrollArea className="flex-1 px-4 py-4">
            <div className="space-y-3">
              {messages.length === 0 && !loading && (
                <div className="text-sm text-muted-foreground text-center py-8 px-2">
                  Oi, eu sou a Júlia, assistente da Max Gráfica! Pergunte sobre toners, preços, papéis ou qualquer coisa cadastrada no sistema.
                </div>
              )}
              {messages.map((m, i) => {
                const isLastAssistant =
                  m.role === "assistant" && i === messages.length - 1 && !loading;
                const prevUser = m.role === "assistant"
                  ? [...messages.slice(0, i)].reverse().find((x) => x.role === "user")?.content
                  : undefined;
                return (
                  <AssistenteMensagem
                    key={i}
                    role={m.role}
                    content={m.content}
                    chipsEnabled={isLastAssistant}
                    onChipClick={(text) => enviar(text)}
                    timestamp={m.timestamp}
                    previousUserContent={prevUser}
                  />
                );
              })}
              {loading && (
                <div className="flex gap-2 items-start">
                  <div className="h-7 w-7 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="bg-muted rounded-lg rounded-tl-sm px-3 py-2">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t p-3 flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte algo..."
              className="min-h-[40px] max-h-32 resize-none"
              rows={1}
              disabled={loading}
            />
            <Button
              type="button"
              size="icon"
              onClick={() => enviar()}
              disabled={loading || !input.trim()}
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
