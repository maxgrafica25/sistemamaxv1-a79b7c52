import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
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
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newTelefone, setNewTelefone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuppliers = useCallback(async (force = false) => {
    if (loaded && !force) return;
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

  const openNewSupplier = () => {
    setNewNome(value || "");
    setNewTelefone("");
    setNewEmail("");
    setIsOpen(false);
    setShowNewDialog(true);
  };

  const saveNewSupplier = async () => {
    if (!newNome.trim() || !newTelefone.trim()) {
      toast.error("Preencha Nome e Telefone");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({ nome: newNome.trim(), telefone: newTelefone.trim(), email: newEmail.trim() || "", tipo: "fornecedor" } as any)
      .select("id, nome, telefone, empresa")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Erro ao cadastrar fornecedor");
      return;
    }
    toast.success("Fornecedor cadastrado!");
    setShowNewDialog(false);
    setLoaded(false);
    await fetchSuppliers(true);
    if (data) {
      onChange(data.nome);
      onSelectSupplier?.(data as Supplier);
    }
  };

  return (
    <>
      <div ref={containerRef} className="relative">
        <div className="relative flex gap-1.5">
          <div className="relative flex-1">
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
          <Button type="button" variant="outline" size="icon" className="shrink-0 h-10 w-10" onClick={openNewSupplier} title="Cadastrar fornecedor">
            <Plus className="h-4 w-4" />
          </Button>
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
              <div className="p-3 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Nenhum fornecedor encontrado</p>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openNewSupplier}>
                  <Plus className="h-3.5 w-3.5" /> Cadastrar novo
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Nome do fornecedor" value={newNome} onChange={(e) => setNewNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input placeholder="(00) 00000-0000" value={newTelefone} onChange={(e) => setNewTelefone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" placeholder="email@exemplo.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={saveNewSupplier} disabled={saving}>
                {saving ? "Salvando..." : "Cadastrar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
