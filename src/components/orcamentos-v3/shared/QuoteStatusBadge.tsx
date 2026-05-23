import { Badge } from "@/components/ui/badge";

interface Props {
  status: string;
  /** Itens aprovados (apenas para partial/approved) */
  approved?: number;
  /** Total de itens (apenas para partial/approved) */
  total?: number;
  /** Reservado para variações futuras (não usado visualmente aqui) */
  hasUnseen?: boolean;
  size?: "sm" | "md";
}

function SegmentedBar({ approved, total }: { approved: number; total: number }) {
  if (total <= 0) return null;
  // Para totais grandes, usa barra contínua para não ficar serrilhada
  if (total > 12) {
    const pct = Math.round((approved / total) * 100);
    return (
      <div className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-white/30">
        <div
          className="h-full bg-green-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }
  return (
    <div className="mt-1 flex h-1 w-full gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${i < approved ? "bg-green-400" : "bg-white/30"}`}
        />
      ))}
    </div>
  );
}

export function QuoteStatusBadge({ status, approved, total }: Props) {
  const hasFraction = typeof approved === "number" && typeof total === "number" && total > 0;
  const fraction = hasFraction ? ` (${approved}/${total})` : "";

  if (status === "approved") {
    return (
      <Badge className="bg-green-600 hover:bg-green-600 flex-col items-stretch !rounded-md px-2 py-1">
        <span className="text-center leading-tight">Aprovado{fraction}</span>
        {hasFraction && <SegmentedBar approved={approved!} total={total!} />}
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge className="bg-blue-600 hover:bg-blue-600 flex-col items-stretch !rounded-md px-2 py-1">
        <span className="text-center leading-tight">Parcial{fraction}</span>
        {hasFraction && <SegmentedBar approved={approved!} total={total!} />}
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
