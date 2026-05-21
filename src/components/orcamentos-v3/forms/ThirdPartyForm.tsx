import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PaperAutocomplete, type AutocompleteOption } from "../shared/PaperAutocomplete";
import { fmtBRL, roundUp10 } from "../shared/pricing";
import { TierSimulator } from "../shared/TierSimulator";
import { genId, type V3ThirdItem } from "../types";

interface Props {
  onAdd: (item: V3ThirdItem) => void;
  onAddTiers?: (items: V3ThirdItem[]) => void;
}

export function ThirdPartyForm({ onAdd, onAddTiers }: Props) {
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState<AutocompleteOption | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [custo, setCusto] = useState(0);
  const [margem, setMargem] = useState(30);
  const [pulse, setPulse] = useState(false);

  const preview = Math.ceil(quantidade * custo * (1 + margem / 100) * 10) / 10;
  const canAdd = descricao.trim().length > 0 && quantidade > 0 && custo > 0;

  const buildItem = (q: number, tierGroupId?: string): V3ThirdItem => ({
    id: genId(),
    kind: "third",
    descricao: descricao.trim(),
    tier_group_id: tierGroupId ?? null,
    fornecedor: fornecedor?.label ?? "",
    quantidade: q,
    custo,
    margem_pct: margem,
  });

  const submit = () => {
    if (!canAdd) return;
    onAdd(buildItem(quantidade));
    setDescricao("");
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  const submitAsTiers = (qtys: number[], primaryQty: number) => {
    if (!onAddTiers || !canAdd) return;
    const tg = `tg_${genId()}`;
    onAddTiers(qtys.map((q) => ({ ...buildItem(q, tg), tier_primary: q === primaryQty })));
    setDescricao("");
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5">
      <Field label="Descrição">
        <Input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: Brindes personalizados, etiquetas adesivas"
          className="h-9"
        />
      </Field>

      <Field label="Fornecedor">
        <PaperAutocomplete
          table="suppliers"
          searchColumns={["nome", "empresa"]}
          selectColumns="id, nome, empresa"
          placeholder="Buscar fornecedor cadastrado"
          value={fornecedor}
          onChange={setFornecedor}
          mapRow={(r) => ({
            id: String(r.id),
            label: String(r.nome ?? r.empresa ?? "—"),
            hint: r.empresa ? String(r.empresa) : undefined,
          })}
        />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Quantidade">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
              className="h-9"
            />
            <TierSimulator
              currentQty={quantidade}
              disabled={!(custo > 0)}
              compute={(q) => {
                const c = q * (custo || 0);
                return { custo_total: c, preco_total: roundUp10(c * (1 + (margem || 0) / 100)) };
              }}
              onPickQty={(q) => setQuantidade(q)}
              onCloneAsTiers={onAddTiers ? submitAsTiers : undefined}
            />
          </div>
        </Field>
        <Field label="Custo unitário (R$)">
          <Input
            type="number"
            step="0.01"
            min={0}
            value={custo}
            onChange={(e) => setCusto(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
        <Field label="Margem (%)">
          <Input
            type="number"
            step="1"
            min={0}
            value={margem}
            onChange={(e) => setMargem(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">
          Pré-visualização:{" "}
          <span className="font-semibold text-foreground">{fmtBRL(preview)}</span>
        </p>
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
