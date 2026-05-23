import { cn } from "@/lib/utils";
import { useStepCategories, findCategory } from "@/hooks/useStepCategories";

// Legacy type — kept for compatibility with existing imports.
// Categories are now dynamic; this is just a string slug.
export type StepType = string;

// Legacy export, used only as fallback in a few places before categories load.
export const STEP_TYPES: { value: string; label: string; classes: string }[] = [
  { value: "impressao", label: "Impressão", classes: "" },
  { value: "acabamento", label: "Acabamento", classes: "" },
  { value: "corte", label: "Corte", classes: "" },
  { value: "outro", label: "Outro", classes: "" },
];

export function getStepTypeMeta(type: string | null | undefined) {
  return STEP_TYPES.find((s) => s.value === type) ?? STEP_TYPES[3];
}

interface Props {
  type: string | null | undefined;
  className?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function StepTypeBadge({ type, className }: Props) {
  const { data: categories } = useStepCategories();
  const cat = findCategory(categories, type);
  const { r, g, b } = hexToRgb(cat.color);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        className,
      )}
      style={{
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
        color: cat.color,
        borderColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
      }}
    >
      {cat.name}
    </span>
  );
}
