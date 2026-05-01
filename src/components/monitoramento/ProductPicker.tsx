import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProdutoCatalogo } from "@/lib/produtoCatalogo";
import NovoProdutoCatalogoDialog from "./NovoProdutoCatalogoDialog";

type Props = {
  selectedId: string | null;
  selectedName: string;
  onChange: (val: { id: string; name: string }) => void;
  defaultCategoria?: string;
};

export default function ProductPicker({ selectedId, selectedName, onChange, defaultCategoria }: Props) {
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);

  const fetchProdutos = async () => {
    const { data } = await supabase
      .from("produtos_catalogo")
      .select("*")
      .order("nome_canonico");
    setProdutos((data || []) as ProdutoCatalogo[]);
  };

  useEffect(() => {
    fetchProdutos();
  }, []);

  const selected = produtos.find((p) => p.id === selectedId);
  const triggerLabel = selected
    ? selected.nome_canonico
    : selectedName || "Selecione uma referência...";

  const openNovo = () => {
    setOpen(false);
    setNovoOpen(true);
  };

  const handleCreated = async (produto: ProdutoCatalogo) => {
    setProdutos((prev) =>
      [...prev.filter((p) => p.id !== produto.id), produto].sort((a, b) =>
        a.nome_canonico.localeCompare(b.nome_canonico),
      ),
    );
    onChange({ id: produto.id, name: produto.nome_canonico });
    setSearch("");
  };

  return (
    <div className="space-y-2">
      <Label>Vincular à referência *</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
            title={triggerLabel}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-[420px] max-w-[90vw] p-0"
          align="start"
        >
          <Command>
            <CommandInput
              placeholder="Buscar produto..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-4 px-4 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={openNovo}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Cadastrar novo produto
                  </Button>
                </div>
              </CommandEmpty>
              {produtos.length > 0 && (
                <CommandGroup heading="Produtos do catálogo">
                  {produtos.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.nome_canonico}
                      title={p.nome_canonico}
                      className="items-start gap-2"
                      onSelect={() => {
                        onChange({ id: p.id, name: p.nome_canonico });
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0 mt-0.5",
                          selectedId === p.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="flex-1 break-words leading-snug">{p.nome_canonico}</span>
                      {p.categoria && (
                        <Badge
                          variant="outline"
                          className="text-xs ml-2 shrink-0 self-start mt-0.5"
                        >
                          {p.categoria}
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-8 text-sm font-normal"
                onClick={openNovo}
              >
                <Plus className="h-3.5 w-3.5 text-primary" />
                Cadastrar novo produto no catálogo
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      {selected && (
        <p className="text-xs text-muted-foreground">
          Os preços deste link serão agrupados sob "
          <strong>{selected.nome_canonico}</strong>" no monitoramento.
        </p>
      )}

      <NovoProdutoCatalogoDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        initialName={search.trim()}
        initialCategoria={defaultCategoria}
        onCreated={handleCreated}
      />
    </div>
  );
}
