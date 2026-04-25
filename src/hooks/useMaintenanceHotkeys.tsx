import { useEffect } from "react";

/**
 * Atalhos do submódulo Manutenções:
 *  - "M" (sem modificadores, fora de campos editáveis e sem dialog aberto) → onOpenNew()
 *  - Esc é tratado nativamente pelo Radix Dialog
 *  - Ctrl/Cmd+Enter é tratado dentro do <DialogContent> via onKeyDown local
 */
function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  const role = t.getAttribute("role");
  if (role === "textbox" || role === "combobox") return true;
  return false;
}

export function useMaintenanceHotkeys(opts: {
  enabled: boolean;
  onOpenNew: () => void;
}) {
  const { enabled, onOpenNew } = opts;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== "m") return;
      if (isEditableTarget(e.target)) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      e.preventDefault();
      onOpenNew();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onOpenNew]);
}
