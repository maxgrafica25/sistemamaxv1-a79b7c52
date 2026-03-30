import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Package } from "lucide-react";

interface Material {
  id: string;
  name: string;
  unit: string;
  lastPrice: number;
}

interface MaterialCatalogSearchProps {
  materials: Material[];
  onSelect: (materialId: string) => void;
}

export default function MaterialCatalogSearch({ materials, onSelect }: MaterialCatalogSearchProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = materials.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onSelect(id);
    setSearch("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar matéria-prima no catálogo..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10"
        />
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-64 overflow-auto">
          {filtered.length > 0 ? (
            filtered.map((material) => (
              <button
                key={material.id}
                onClick={() => handleSelect(material.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent transition-colors border-b last:border-0"
              >
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{material.name}</p>
                  <p className="text-xs text-muted-foreground">R$ {material.lastPrice.toFixed(2)} / {material.unit}</p>
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum material encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}
