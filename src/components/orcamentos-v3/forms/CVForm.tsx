import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PaperAutocomplete, type AutocompleteOption } from "../shared/PaperAutocomplete";
import { FinishingProgressive, type FinishingDef } from "../shared/FinishingProgressive";
import { fmtBRL } from "../shared/pricing";
import { genId, type V3CVItem } from "../types";

interface Props {
  onAdd: (item: V3CVItem) => void;
}

const CV_FINISHES: FinishingDef[] = [
  { id: "bainha", label: "Bainha" },
  { id: "ilhos", label: "Ilhós", hint: "A cada 50 cm" },
  { id: "bastao", label: "Bastão (banner)" },
  { id: "recorte", label: "Recorte eletrônico" },
];

export function CVForm({ onAdd }: Props) {
  const [descricao, setDescricao] = useState("");
  const [largura, setLargura] = useState(1.0);
  const [altura, setAltura] = useState(1.0);
  const [quantidade, setQuantidade] = useState(1);
  const [midia, setMidia] = useState<AutocompleteOption | null>(null);
  const [custo, setCusto] = useState(0);
  const [margem, setMargem] = useState(60);
  const [finEnabled, setFinEnabled] = useState<Record<string, boolean>>({});
  const [pulse, setPulse] = useState(false);

  const m2 = useMemo(() => Math.max(0, largura) * Math.max(0, altura), [largura, altura]);
  const preview = useMemo(
    () => Math.ceil(m2 * quantidade * custo * (1 + margem / 100) * 10) / 10,
    [m2, quantidade, custo, margem],
  );

  const canAdd =
    descricao.trim().length > 0 && largura > 0 && altura > 0 && quantidade > 0 && custo > 0;

  const submit = () => {
    if (!canAdd) return;
    onAdd({
      id: genId(),
      kind: "cv",
      descricao: descricao.trim(),
      midia_id: midia?.id ?? null,
      midia_nome: midia?.label ?? "",
      custo_mt2: custo,
      margem_mt2_pct: margem,
      largura_m: largura,
      altura_m: altura,
      quantidade,
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
          placeholder="Ex: Banner promocional fachada"
          className="h-9"
        />
      </Field>

      <Field label="Mídia">
        <PaperAutocomplete
          table="midias_cv"
          searchColumns={["nome"]}
          selectColumns="id, nome, tipo_midia, custo_mt2, lucro_mt2"
          placeholder="Buscar mídia (lona, adesivo, chapa...)"
          value={midia}
          onChange={(opt) => {
            setMidia(opt);
            if (opt) {
              const c = Number(opt.custo_mt2) || 0;
              const m = Number(opt.lucro_mt2) || 0;
              if (c > 0) setCusto(c);
              if (m > 0) setMargem(m);
            }
          }}
          mapRow={(r) => ({
            id: String(r.id),
            label: String(r.nome ?? "—"),
            hint: r.tipo_midia ? String(r.tipo_midia) : undefined,
            custo_mt2: Number(r.custo_mt2 ?? 0),
            lucro_mt2: Number(r.lucro_mt2 ?? 0),
          })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Largura (m)">
          <Input
            type="number"
            step="0.01"
            min={0}
            value={largura}
            onChange={(e) => setLargura(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
        <Field label="Altura (m)">
          <Input
            type="number"
            step="0.01"
            min={0}
            value={altura}
            onChange={(e) => setAltura(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Área calculada</span>
        <span className="font-semibold tabular-nums">
          {m2.toFixed(2).replace(".", ",")} m²
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Quantidade">
          <Input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
            className="h-9"
          />
        </Field>
        <Field label="Custo m² (R$)">
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

      <Field label="Acabamentos">
        <FinishingProgressive
          items={CV_FINISHES}
          enabled={finEnabled}
          onToggle={(id, on) => setFinEnabled((m) => ({ ...m, [id]: on }))}
        />
      </Field>

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
