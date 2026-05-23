import { Snowflake, Eye, Flame, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeTemperature, temperatureLabel, type EngagementStats } from "@/lib/quotes/temperature";

interface Props {
  stats?: EngagementStats;
  className?: string;
}

const styles = {
  cold: {
    wrapper: "bg-muted text-muted-foreground border border-border",
    Icon: Snowflake,
  },
  warm: {
    wrapper: "bg-blue-500/15 text-blue-700 border border-blue-300 dark:text-blue-300 dark:border-blue-700",
    Icon: Eye,
  },
  hot: {
    wrapper: "bg-green-500/15 text-green-700 border border-green-300 dark:text-green-300 dark:border-green-700",
    Icon: Flame,
  },
  live: {
    wrapper: "bg-orange-500/15 text-orange-700 border border-orange-300 dark:text-orange-300 dark:border-orange-700",
    Icon: Radio,
  },
} as const;

export function EngagementBadge({ stats, className }: Props) {
  const temp = computeTemperature(stats);
  const { wrapper, Icon } = styles[temp];
  const label = temperatureLabel(temp);
  const viewCount = stats?.viewCount ?? 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
        wrapper,
        className,
      )}
    >
      {temp === "live" && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
        </span>
      )}
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      {viewCount > 0 && temp !== "live" && (
        <span className="opacity-70">· {viewCount}</span>
      )}
    </span>
  );
}
