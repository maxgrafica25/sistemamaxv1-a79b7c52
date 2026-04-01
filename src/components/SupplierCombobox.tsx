import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Supplier {
  id: string;
  nome: string;
  telefone: string;
  empresa: string | null;
}

interface SupplierComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelectSupplier?: (supplier: Supplier) => void;
  placeholder?: string;
}

export default function SupplierCombobox({ value, onChange, onSelectSupplier, placeholder = "Selecione um fornecedor" }: SupplierComboboxProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuppliers = useCallback(async () => {
    if (loaded) return;
    const { data } = await supabase
      .from("clients")
      .select("id, nome, telefone, empresa")
      .or("tipo.eq.fornecedor,tipo.eq.ambos")
      .order("nome");
    if (data) setSuppliers(data);
    setLoaded(true);
  }, [loaded]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = suppliers.filter(s =>
    s.nome.toLowerCase().includes((value || "").toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            fetchSuppliers();
            setIsOpen(true);
          }}
          className="pl-10"
        />
      </div>
      {isOpen && loaded && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-auto">
          {filtered.length > 0 ? (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(s.nome);
                  onSelectSupplier?.(s);
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent transition-colors border-b last:border-0"
              >
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.nome}</p>
                  {s.empresa && <p className="text-xs text-muted-foreground truncate">{s.empresa}</p>}
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-4 text-center text-sm text-muted-foreground">
              Nenhum fornecedor encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}
