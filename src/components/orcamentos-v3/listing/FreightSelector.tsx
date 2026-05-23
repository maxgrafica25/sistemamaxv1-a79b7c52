import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Truck } from "lucide-react";

export interface FreightType {
  id: string;
  name: string;
  default_value: number;
}

interface Props {
  freightTypeId: string | null;
  freightValue: number;
  onChange: (next: { freightTypeId: string | null; freightValue: number }) => void;
}

export function FreightSelector({ freightTypeId, freightValue, onChange }: Props) {
  const [types, setTypes] = useState<FreightType[]>([]);

  useEffect(() => {
    supabase
      .from("freight_types")
      .select("id, name, default_value")
      .order("sort_order")
      .then(({ data }) => setTypes((data || []) as FreightType[]));
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5" /> Tipo de frete
        </Label>
        <Select
          value={freightTypeId ?? "none"}
          onValueChange={(v) => {
            if (v === "none") {
              onChange({ freightTypeId: null, freightValue: 0 });
              return;
            }
            const t = types.find((x) => x.id === v);
            onChange({
              freightTypeId: v,
              freightValue: freightValue || (t?.default_value ?? 0),
            });
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem frete</SelectItem>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Valor (R$)</Label>
        <Input
          type="number"
          step="0.01"
          min={0}
          value={freightValue || ""}
          onChange={(e) =>
            onChange({
              freightTypeId,
              freightValue: parseFloat(e.target.value) || 0,
            })
          }
          placeholder="0,00"
          className="h-9"
        />
      </div>
    </div>
  );
}
