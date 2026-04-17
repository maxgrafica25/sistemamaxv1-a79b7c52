import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProdutoCatalogo } from "@/lib/produtoCatalogo";

type Mode = "existing" | "new";

type Props = {
  /** Quando o usuário seleciona um produto existente: id + nome canônico. Quando digita um novo: id=null. */
  selectedId: string | null;
  selectedName: string;
  onChange: (val: { id: string | null; name: string }) => void;
};

export default function ProductPicker({ selectedId, selectedName, onChange }: Props) {
  const [mode, setMode] = useState<Mode>(selectedId ? "existing" : "new");
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      // Lista apenas produtos do catálogo que já possuem 1+ sites monitorados vinculados.
      // Para criar um nome novo o usuário usa o botão "Criar novo nome".
      const [{ data: prods }, { data: sites }] = await Promise.all([
        supabase.from("produtos_catalogo").select("*").order("nome_canonico"),
        supabase.from("sites_monitorados").select("produto_catalogo_id"),
      ]);
      const idsComSite = new Set(
        (sites || [])
          .map((s: any) => s.produto_catalogo_id)
          .filter(Boolean) as string[],
      );
      // Mantém o produto selecionado mesmo se ainda não tiver sites (edição em curso)
      const visiveis = (prods || []).filter(
        (p: any) => idsComSite.has(p.id) || p.id === selectedId,
      ) as ProdutoCatalogo[];
      setProdutos(visiveis);
    })();
  }, [selectedId]);

  // Sincroniza modo se vier um id de fora
  useEffect(() => {
    if (selectedId && mode !== "existing") setMode("existing");
  }, [selectedId]);

  const selected = produtos.find((p) => p.id === selectedId);

  return (
    <div className="space-y-2">
      <Label>Vincular ao catálogo *</Label>

      {mode === "existing" ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              className="w-full justify-between font-normal"
            >
              <span className="truncate">
                {selected ? selected.nome_canonico : "Selecione um produto do catálogo..."}
              </span>
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar produto..." />
              <CommandList>
                <CommandEmpty>
                  <div className="py-3 px-2 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="gap-1.5"
                      onClick={() => {
                        setMode("new");
                        onChange({ id: null, name: selectedName });
                        setOpen(false);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Criar novo nome
                    </Button>
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {produtos.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.nome_canonico}
                      onSelect={() => {
                        onChange({ id: p.id, name: p.nome_canonico });
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("h-4 w-4", selectedId === p.id ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1 truncate">{p.nome_canonico}</span>
                      {p.categoria && <Badge variant="outline" className="text-xs ml-2">{p.categoria}</Badge>}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__criar_novo__"
                    onSelect={() => {
                      setMode("new");
                      onChange({ id: null, name: selectedName });
                      setOpen(false);
                    }}
                    className="text-primary"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="flex-1">Criar novo nome</span>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        <div className="space-y-2">
          <Input
            value={selectedName}
            onChange={(e) => onChange({ id: null, name: e.target.value })}
            placeholder="Ex: Panfleto 10x14 Couché 90g"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setMode("existing")}
          >
            ← Voltar para selecionar existente
          </Button>
        </div>
      )}
      {mode === "existing" && selected && (
        <p className="text-xs text-muted-foreground">
          Os preços deste link serão agrupados sob "<strong>{selected.nome_canonico}</strong>" no monitoramento.
        </p>
      )}
    </div>
  );
}
