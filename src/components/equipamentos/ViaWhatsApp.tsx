import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Etiqueta discreta para o que a Júlia registrou pelo WhatsApp (origem = 'julia'). */
export function ViaWhatsApp({ className }: { className?: string }) {
  return (
    <span
      title="Registrado pela Júlia a partir do WhatsApp"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium leading-none text-emerald-700 dark:text-emerald-400",
        className,
      )}
    >
      <MessageCircle className="h-3 w-3" aria-hidden />
      WhatsApp
    </span>
  );
}
