import { cn } from "@/lib/utils";

export type StepType = "impressao" | "acabamento" | "corte" | "outro";

export const STEP_TYPES: { value: StepType; label: string; classes: string }[] = [
  {
    value: "impressao",
    label: "Impressão",
    classes: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
  },
  {
    value: "acabamento",
    label: "Acabamento",
    classes: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  },
  {
    value: "corte",
    label: "Corte",
    classes: "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-300",
  },
  {
    value: "outro",
    label: "Outro",
    classes: "bg-muted text-muted-foreground border-border",
  },
];

export function getStepTypeMeta(type: string | null | undefined) {
  return STEP_TYPES.find((s) => s.value === type) ?? STEP_TYPES[3];
}

interface Props {
  type: string | null | undefined;
  className?: string;
}

export function StepTypeBadge({ type, className }: Props) {
  const meta = getStepTypeMeta(type);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        meta.classes,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
