import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Loader de página com revelação atrasada.
 *
 * Por que: o padrão antigo de `if (loading) return <FullscreenSpinner/>` causa
 * uma "piscada" visual a cada navegação — a área principal fica em branco por
 * 100–400 ms e depois o conteúdo aparece de uma vez, parecendo um refresh.
 *
 * Este componente fica invisível pelos primeiros `delay` ms (default 300).
 * Como a maioria dos fetches resolve antes disso, o spinner nunca aparece e a
 * transição é instantânea. Para fetches mais lentos, mostra o spinner sutil.
 *
 * Mantém o layout (sidebar/header) estável; só ocupa a área de conteúdo.
 */
export default function PageLoader({ delay = 300 }: { delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!show) return <div className="h-full" aria-hidden />;

  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center" role="status" aria-label="Carregando">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
