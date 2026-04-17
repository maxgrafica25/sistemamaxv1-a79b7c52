import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProdutoCatalogo } from "@/lib/produtoCatalogo";

type Props = {
  /** Quando o usuário seleciona um produto existente: id + nome canônico. Quando digita um novo: id=null. */
  selectedId: string | null;
  selectedName: string;
  onChange: (val: { id: string | null; name: string }) => void;
};

export default function ProductPicker({ selectedId, selectedName, onChange }: Props) {
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: prods }, { data: sites }] = await Promise.all([
        supabase.from("produtos_catalogo").select("*").order("nome_canonico"),
        supabase.from("sites_monitorados").select("produto_catalogo_id"),
      ]);
      const idsComSite = new Set(
        (sites || [])
          .map((s: any) => s.produto_catalogo_id)
          .filter(Boolean) as string[],
      );
      const visiveis = (prods || []).filter(
        (p: any) => idsComSite.has(p.id) || p.id === selectedId,
      ) as ProdutoCatalogo[];
      setProdutos(visiveis);
    })();
  }, [selectedId]);

  const selected = produtos.find((p) => p.id === selectedId);
  const triggerLabel = selected
    ? selected.nome_canonico
    : selectedName
      ? `${selectedName} (novo)`
      : "Selecione ou digite um novo nome...";

  const trimmedSearch = search.trim();
  const hasExactMatch = produtos.some(
    (p) => p.nome_canonico.toLowerCase() === trimmedSearch.toLowerCase(),
  );

  const handleCreateNew = () => {
    if (!trimmedSearch) return;
    onChange({ id: null, name: trimmedSearch });
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="space-y-2">
      <Label>Vincular ao catálogo *</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar produto existente..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <div className="p-2 border-b sticky top-0 bg-popover z-10">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    const nome = trimmedSearch || window.prompt("Digite o nome do novo produto:")?.trim() || "";
                    if (!nome) return;
                    onChange({ id: null, name: nome });
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {trimmedSearch ? `Cadastrar: "${trimmedSearch}"` : "Cadastrar novo nome"}
                </Button>
              </div>
              <CommandEmpty>
                <p className="py-6 text-sm text-muted-foreground text-center">
                  Nenhum produto encontrado. Use o botão acima para cadastrar.
                </p>
              </CommandEmpty>
              {produtos.length > 0 && (
                <CommandGroup heading="Produtos do catálogo">
                  {produtos.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.nome_canonico}
                      onSelect={() => {
                        onChange({ id: p.id, name: p.nome_canonico });
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check className={cn("h-4 w-4", selectedId === p.id ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1 truncate">{p.nome_canonico}</span>
                      {p.categoria && <Badge variant="outline" className="text-xs ml-2">{p.categoria}</Badge>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected && (
        <p className="text-xs text-muted-foreground">
          Os preços deste link serão agrupados sob "<strong>{selected.nome_canonico}</strong>" no monitoramento.
        </p>
      )}
      {!selected && selectedName && (
        <p className="text-xs text-muted-foreground">
          Será criado um novo produto: "<strong>{selectedName}</strong>".
        </p>
      )}
    </div>
  );
}
