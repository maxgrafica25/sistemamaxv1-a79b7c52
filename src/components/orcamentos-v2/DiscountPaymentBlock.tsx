import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";

export type DiscountType = "brl" | "percent";

const MAX_DISCOUNT_PCT = 7;

interface Props {
  discountValue: number | null;
  discountType: DiscountType;
  paymentMethod: string;
  /** Subtotal antes do desconto (R$). Usado para calcular limite máximo. */
  subtotal?: number;
  onDiscountValueChange: (v: number | null) => void;
  onDiscountTypeChange: (t: DiscountType) => void;
  onPaymentMethodChange: (m: string) => void;
}

const PAYMENT_METHODS = [
  "Pix",
  "Dinheiro",
  "Boleto",
  "Cartão à vista",
  "Cartão 2x",
  "Cartão 3x",
  "Cartão 4x",
  "Cartão 5x",
  "Cartão 6x",
  "Transferência bancária",
];

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DiscountPaymentBlock({
  discountValue, discountType, paymentMethod, subtotal = 0,
  onDiscountValueChange, onDiscountTypeChange, onPaymentMethodChange,
}: Props) {
  const maxDiscountBRL = Math.max(0, subtotal * MAX_DISCOUNT_PCT / 100);

  const handleChange = (raw: string) => {
    if (raw === "") return onDiscountValueChange(null);
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    if (discountType === "percent" && n > MAX_DISCOUNT_PCT) {
      toast.error(`Desconto máximo permitido: ${MAX_DISCOUNT_PCT}%`);
      return onDiscountValueChange(MAX_DISCOUNT_PCT);
    }
    if (discountType === "brl" && maxDiscountBRL > 0 && n > maxDiscountBRL) {
      toast.error(`Desconto máximo: ${formatBRL(maxDiscountBRL)} (${MAX_DISCOUNT_PCT}% do total)`);
      return onDiscountValueChange(maxDiscountBRL);
    }
    onDiscountValueChange(n);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Desconto</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            max={discountType === "percent" ? MAX_DISCOUNT_PCT : maxDiscountBRL || undefined}
            value={discountValue ?? ""}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="0"
            className="flex-1"
          />
          <ToggleGroup
            type="single"
            value={discountType}
            onValueChange={(v) => v && onDiscountTypeChange(v as DiscountType)}
            className="bg-muted rounded-md p-0.5"
          >
            <ToggleGroupItem value="brl" className="h-9 px-3 text-xs">R$</ToggleGroupItem>
            <ToggleGroupItem value="percent" className="h-9 px-3 text-xs">%</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Máx. {MAX_DISCOUNT_PCT}%{maxDiscountBRL > 0 ? ` (${formatBRL(maxDiscountBRL)})` : ""}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Forma de pagamento</Label>
        <Select value={paymentMethod} onValueChange={onPaymentMethodChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export const MAX_DISCOUNT_PERCENT = MAX_DISCOUNT_PCT;
