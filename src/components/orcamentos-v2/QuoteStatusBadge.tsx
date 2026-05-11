import { Badge } from "@/components/ui/badge";

interface Props {
  status: string;
  /** Itens aprovados (apenas para partial/approved) */
  approved?: number;
  /** Total de itens (apenas para partial/approved) */
  total?: number;
  /** Mostra dot vermelho de "novo aceite não visto" (apenas equipe interna) */
  hasUnseen?: boolean;
  /** Variante visual: lista interna (com dot) ou pública (sem dot, sem link) */
  size?: "sm" | "md";
}

export function QuoteStatusBadge({ status, approved, total, hasUnseen, size = "sm" }: Props) {
  const fraction =
    typeof approved === "number" && typeof total === "number" && total > 0
      ? ` (${approved}/${total})`
      : "";

  const dot = hasUnseen ? (
    <span
      aria-label="Nova aprovação não vista"
      className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5 shrink-0"
    />
  ) : null;

  const base = size === "md" ? "" : "";

  if (status === "approved") {
    return (
      <Badge className={`bg-green-600 hover:bg-green-600 ${base}`}>
        {dot}
        Aprovado{fraction}
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge className={`bg-blue-600 hover:bg-blue-600 ${base}`}>
        {dot}
        Parcial{fraction}
      </Badge>
    );
  }
  if (status === "rejected") {
    return <Badge className="bg-red-600 hover:bg-red-600">Recusado</Badge>;
  }
  if (status === "pending") {
    return <Badge className="bg-yellow-500 hover:bg-yellow-500">Aguardando aprovação</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}
