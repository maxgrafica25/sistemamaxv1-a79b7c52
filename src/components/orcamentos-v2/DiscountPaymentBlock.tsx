import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type DiscountType = "brl" | "percent";

interface Props {
  discountValue: number | null;
  discountType: DiscountType;
  paymentMethod: string;
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

export function DiscountPaymentBlock({
  discountValue, discountType, paymentMethod,
  onDiscountValueChange, onDiscountTypeChange, onPaymentMethodChange,
}: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Desconto</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={discountValue ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onDiscountValueChange(v === "" ? null : Number(v));
            }}
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
