import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StepCategory {
  id: string;
  slug: string;
  name: string;
  color: string;
  sort_order: number;
  is_system: boolean;
}

export function useStepCategories() {
  return useQuery({
    queryKey: ["production_step_categories"],
    queryFn: async (): Promise<StepCategory[]> => {
      const { data, error } = await supabase
        .from("production_step_categories" as any)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as StepCategory[];
    },
    staleTime: 60_000,
  });
}

const FALLBACK: StepCategory = {
  id: "fallback",
  slug: "outro",
  name: "Outro",
  color: "#6b7280",
  sort_order: 999,
  is_system: true,
};

export function findCategory(categories: StepCategory[] | undefined, slug: string | null | undefined): StepCategory {
  if (!slug || !categories) return FALLBACK;
  return categories.find((c) => c.slug === slug) ?? FALLBACK;
}
