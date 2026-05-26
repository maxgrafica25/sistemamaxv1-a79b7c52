import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Copy, Eye, MessageCircle, Pencil, Plus, Search, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ClientOption {
  id: string;
  nome: string;
  empresa: string | null;
  telefone: string | null;
  email: string | null;
  tipo: string | null;
}

interface Props {
  value: { id: string | null; nome: string };
  onChange: (next: { id: string | null; nome: string; telefone?: string | null }) => void;
}

export function ClientCombobox({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ClientOption | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate selected when an id is present and we have it in results / fetch direct
  useEffect(() => {
    if (!value.id) { setSelected(null); return; }
    if (selected?.id === value.id) return;
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, nome, empresa, telefone, email, tipo")
        .eq("id", value.id)
        .maybeSingle();
      if (data) setSelected(data as ClientOption);
    })();
  }, [value.id, selected?.id]);

  // Search with debounce
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const q = query.trim();
      let req = supabase
        .from("clients")
        .select("id, nome, empresa, telefone, email, tipo")
        .eq("tipo", "cliente")
        .order("nome")
        .limit(20);
      if (q) {
        const like = `%${q}%`;
        req = req.or(
          `nome.ilike.${like},empresa.ilike.${like},telefone.ilike.${like},email.ilike.${like}`,
        );
      }
      const { data } = await req;
      setResults((data || []) as ClientOption[]);
      setLoading(false);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open]);

  const handleSelect = (c: ClientOption) => {
    setSelected(c);
    onChange({ id: c.id, nome: c.nome, telefone: c.telefone });
    setOpen(false);
    setQuery("");
  };

  const handleClear = () => {
    setSelected(null);
    onChange({ id: null, nome: "" });
  };

  const exactMatch = useMemo(
    () => results.some((r) => r.nome.toLowerCase() === query.trim().toLowerCase()),
    [results, query],
  );

  // Selected chip view
  if (selected && selected.id === value.id) {
    const meta = [selected.empresa, selected.telefone].filter(Boolean).join(" · ");
    return (
      <>
        <div
          className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-background pl-2 pr-1"
          title={meta || undefined}
        >
          <User className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="flex-1 min-w-0 text-sm font-medium truncate">{selected.nome}</span>
          {selected.tipo && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
              {selected.tipo}
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDetailsOpen(true)}
            className="h-7 w-7"
            title="Ver dados do cliente"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="h-7 w-7"
            title="Trocar cliente"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ClientDetailsDialog
          clientId={selected.id}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      </>
    );
  }

  // Search/select view (also covers legacy free-text quotes)
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !value.nome && "text-muted-foreground")}>
              {value.nome || "Buscar cliente por nome, empresa, telefone..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite nome, empresa, telefone..."
              className="h-10 border-0 focus-visible:ring-0 shadow-none px-0"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {loading && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Buscando...</div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado
              </div>
            )}
            {!loading && results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className={cn(
                  "w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                  value.id === c.id && "bg-accent",
                )}
              >
                <Check className={cn("mt-0.5 h-4 w-4 shrink-0", value.id === c.id ? "opacity-100" : "opacity-0")} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[c.empresa, c.telefone, c.email].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                {c.tipo && <Badge variant="outline" className="text-[10px] shrink-0">{c.tipo}</Badge>}
              </button>
            ))}
          </div>
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4 text-primary" />
              {query.trim() && !exactMatch
                ? <>Cadastrar novo cliente <span className="font-medium ml-1">&ldquo;{query.trim()}&rdquo;</span></>
                : "Cadastrar novo cliente"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <QuickCreateClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialName={query.trim()}
        onCreated={(c) => {
          setCreateOpen(false);
          handleSelect(c);
        }}
      />
    </>
  );
}

function QuickCreateClientDialog({
  open, onOpenChange, initialName, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialName: string;
  onCreated: (c: ClientOption) => void;
}) {
  const [nome, setNome] = useState(initialName);
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [tipo, setTipo] = useState<string>("cliente");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(initialName);
      setTelefone(""); setEmail(""); setEmpresa(""); setTipo("cliente");
    }
  }, [open, initialName]);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Informe o nome do cliente"); return; }
    if (!telefone.trim()) { toast.error("Informe o telefone"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim() || null,
        empresa: empresa.trim() || null,
        tipo,
      })
      .select("id, nome, empresa, telefone, email, tipo")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("Erro ao cadastrar cliente: " + (error?.message ?? ""));
      return;
    }
    toast.success("Cliente cadastrado!");
    onCreated(data as ClientOption);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Telefone *</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(51) 99999-9999" />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="parceiro">Parceiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Empresa</Label>
            <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Cadastrar e selecionar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
