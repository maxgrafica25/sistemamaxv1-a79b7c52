import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChipGroup } from "../shared/ChipGroup";
import { FinishingProgressive, type FinishingDef } from "../shared/FinishingProgressive";
import { genId, type V3PrintItem } from "../types";

interface Props {
  onAdd: (item: V3PrintItem) => void;
}

const CORES: { value: NonNullable<V3PrintItem["cores"]>; label: string }[] = [
  { value: "4x0", label: "4x0" },
  { value: "4x4", label: "4x4" },
  { value: "1x0", label: "1x0" },
  { value: "1x1", label: "1x1" },
];

const FORMATOS: { value: NonNullable<V3PrintItem["formato"]>; label: string }[] = [
  { value: "A4", label: "A4" },
  { value: "A3", label: "A3" },
  { value: "SRA3", label: "SRA3" },
];

const FACES: { value: NonNullable<V3PrintItem["face"]>; label: string }[] = [
  { value: "frente", label: "Só frente" },
  { value: "fv", label: "Frente e verso" },
];

const FINISHES: FinishingDef[] = [
  { id: "laminacao", label: "Laminação", hint: "BOPP brilho ou fosco" },
  { id: "verniz", label: "Verniz UV", hint: "Localizado ou total" },
  { id: "vinco", label: "Vinco" },
  { id: "corte_especial", label: "Corte especial" },
  { id: "wire_o", label: "Wire-O / Espiral" },
];

export function PrintForm({ onAdd }: Props) {
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState(100);
  const [formato, setFormato] = useState<V3PrintItem["formato"]>("A4");
  const [cores, setCores] = useState<V3PrintItem["cores"]>("4x0");
  const [face, setFace] = useState<V3PrintItem["face"]>("frente");
  const [valorUnit, setValorUnit] = useState(0);
  const [custoUnit, setCustoUnit] = useState(0);
  const [finEnabled, setFinEnabled] = useState<Record<string, boolean>>({});
  const [pulse, setPulse] = useState(false);

  const canAdd = descricao.trim().length > 0 && quantidade > 0 && valorUnit > 0;

  const submit = () => {
    if (!canAdd) return;
    onAdd({
      id: genId(),
      kind: "print",
      descricao: descricao.trim(),
      quantidade,
      formato,
      cores,
      face,
      valor_unitario: valorUnit,
      custo_unitario: custoUnit,
      finishings: Object.keys(finEnabled).filter((k) => finEnabled[k]),
    });
    setDescricao("");
    setFinEnabled({});
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5">
      <Field label="Descrição">
        <Input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: Cartão de visita 90×50mm couché 300g"
          className="h-9"
        />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Quantidade">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
            className="h-9"
          />
        </Field>
        <Field label="Custo unitário (R$)">
          <Input
            type="number"
            step="0.01"
            min={0}
            value={custoUnit}
            onChange={(e) => setCustoUnit(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
        <Field label="Valor unitário (R$)">
          <Input
            type="number"
            step="0.01"
            min={0}
            value={valorUnit}
            onChange={(e) => setValorUnit(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
      </div>

      <Field label="Cores">
        <ChipGroup options={CORES} value={cores} onChange={setCores} />
      </Field>

      <Field label="Formato">
        <ChipGroup options={FORMATOS} value={formato} onChange={setFormato} />
      </Field>

      <Field label="Face">
        <ChipGroup options={FACES} value={face} onChange={setFace} />
      </Field>

      <Field label="Acabamentos">
        <FinishingProgressive
          items={FINISHES}
          enabled={finEnabled}
          onToggle={(id, on) => setFinEnabled((m) => ({ ...m, [id]: on }))}
        />
      </Field>

      <div className="flex justify-end pt-2">
        <Button
          onClick={submit}
          disabled={!canAdd}
          className={cn(
            "min-w-[200px] transition-colors",
            pulse && "bg-emerald-600 hover:bg-emerald-600",
          )}
        >
          {pulse ? (
            <>
              <Check className="h-4 w-4 mr-2" /> Adicionado!
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" /> Adicionar ao orçamento
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
