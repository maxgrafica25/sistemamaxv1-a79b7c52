// =============================================================================
// Card de Produção (PPR) — exibe metragem linear + tempo estimado de plotter
// =============================================================================

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Ruler, Zap } from "lucide-react";
import {
  estimateProductionTime,
  formatDuration,
  type LabelShape,
} from "@/lib/labels/production-time";
import type { HardwareProfile } from "@/lib/labels/hardware";

interface Props {
  shape: LabelShape;
  labelW: number;
  labelH: number;
  totalLabels: number;
  sheets: number;
  hardware: HardwareProfile;
}

const BADGE_LABEL: Record<string, string> = {
  "pronta-entrega": "Pronta entrega",
  padrao: "Produção padrão",
  intensa: "Produção intensa",
};

const BADGE_CLASS: Record<string, string> = {
  "pronta-entrega":
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  padrao: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  intensa: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

export function ProductionTimeCard(props: Props) {
  const result = estimateProductionTime({
    shape: props.shape,
    labelW: props.labelW,
    labelH: props.labelH,
    totalLabels: props.totalLabels,
    sheets: props.sheets,
    hardware: props.hardware,
  });

  if (!result) return null;

  const meters = result.totalPerimeterM.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: result.totalPerimeterM < 10 ? 1 : 0,
  });

  return (
    <Card className="p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-sm font-semibold">Produção</h3>
          <span className="text-[10px] text-muted-foreground">
            · {props.hardware.label}
          </span>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] ${BADGE_CLASS[result.loadBadge]}`}
        >
          {BADGE_LABEL[result.loadBadge]}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-start gap-1.5">
          <Ruler className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
              Metragem linear
            </div>
            <div className="font-semibold tabular-nums">{meters} m</div>
          </div>
        </div>
        <div className="flex items-start gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
              Tempo de plotter
            </div>
            <div className="font-semibold tabular-nums">
              ~{formatDuration(result.totalSec)}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Corte ~{formatDuration(result.cuttingSec)} + setup ~
        {formatDuration(result.setupSec)} ({props.sheets}{" "}
        {props.sheets === 1 ? "folha" : "folhas"} ×{" "}
        {props.hardware.sheetSetupSec}s).
      </p>
    </Card>
  );
}
