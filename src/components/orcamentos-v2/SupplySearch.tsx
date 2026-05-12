import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface SupplyOption {
  id: string;
  produto: string;
  fornecedor: string;
  valor_unitario: number;
  margem_pct?: number;
}

interface Props {
  onSelect: (supply: SupplyOption) => void;
  placeholder?: string;
  initialLabel?: string;
}

export default function SupplySearch({ onSelect, placeholder = "Buscar suprimento cadastrado...", initialLabel }: Props) {
  const [supplies, setSupplies] = useState<SupplyOption[]>([]);
  const [search, setSearch] = useState(initialLabel || "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("supplies")
      .select("id, produto, fornecedor, valor_unitario")
      .order("produto")
      .then(({ data }) => setSupplies((data as SupplyOption[]) || []));
  }, []);

  useEffect(() => {
    const onClickOut = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOut);
    return () => document.removeEventListener("mousedown", onClickOut);
  }, []);

  const filtered = supplies.filter((s) =>
    s.produto.toLowerCase().includes(search.toLowerCase()),
  );

  const pick = (s: SupplyOption) => {
    onSelect(s);
    setSearch(s.produto);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="pl-10"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-64 overflow-auto">
          {filtered.length > 0 ? (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent border-b last:border-0"
              >
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.produto}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.fornecedor || "Sem fornecedor"} · R$ {Number(s.valor_unitario).toFixed(2)}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Nenhum suprimento encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}
