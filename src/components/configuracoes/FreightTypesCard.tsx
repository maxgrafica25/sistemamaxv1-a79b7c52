import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Truck, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  name: string;
  default_value: number;
}

interface Props {
  isAdmin: boolean;
}

export default function FreightTypesCard({ isAdmin }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [val, setVal] = useState("");

  const originals = useRef<Record<string, Row>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("freight_types")
      .select("id, name, default_value")
      .order("sort_order");
    const list = (data || []) as Row[];
    originals.current = Object.fromEntries(list.map((r) => [r.id, { ...r }]));
    setRows(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const v = parseFloat(val) || 0;
    const sort = rows.length;
    const { error } = await supabase.from("freight_types").insert({
      name: n,
      default_value: v,
      sort_order: sort,
    });
    if (error) return toast.error(error.message);
    setName("");
    setVal("");
    toast.success("Tipo de frete adicionado");
    load();
  };

  const [savingId, setSavingId] = useState<string | null>(null);

  const update = async (id: string, patch: Partial<Row>) => {
    setSavingId(id);
    const { error } = await supabase.from("freight_types").update(patch).eq("id", id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (originals.current[id]) {
      originals.current[id] = { ...originals.current[id], ...patch };
    }
    toast.success("Alteração salva");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("freight_types").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((p) => p.filter((r) => r.id !== id));
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          Tipos de frete
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre os modais usados pelos vendedores nos orçamentos (Moto, Correios, Transportadora…).
        </p>
        <p className="text-xs text-muted-foreground mt-1 italic">
          As alterações em itens existentes são salvas automaticamente ao sair do campo.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className={`grid grid-cols-[1fr_140px_40px] gap-2 items-center transition-opacity ${
                  savingId === r.id ? "opacity-60" : ""
                }`}
              >
                <Input
                  value={r.name}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== originals.current[r.id]?.name) update(r.id, { name: v });
                  }}
                  onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))}
                  disabled={!isAdmin}
                  className="h-9"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={r.default_value || ""}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    if (v !== originals.current[r.id]?.default_value) update(r.id, { default_value: v });
                  }}
                  onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, default_value: parseFloat(e.target.value) || 0 } : x)))}
                  disabled={!isAdmin}
                  placeholder="Valor padrão"
                  className="h-9"
                />
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)} className="h-9 w-9 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="grid grid-cols-[1fr_140px_auto] gap-2 pt-2 border-t border-border">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Novo tipo (ex.: SEDEX)"
              className="h-9"
            />
            <Input
              type="number"
              step="0.01"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="Valor padrão"
              className="h-9"
            />
            <Button onClick={add} className="gap-1.5 h-9">
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
