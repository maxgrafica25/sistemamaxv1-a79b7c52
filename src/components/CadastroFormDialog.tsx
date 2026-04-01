import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Building2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

interface CadastroFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill the nome field */
  initialNome?: string;
  /** Force tipo to "fornecedor" and hide selector */
  forceSupplier?: boolean;
  /** Called after successful save with the new record */
  onSaved?: (record: { id: string; nome: string; telefone: string; empresa: string | null }) => void;
}

export default function CadastroFormDialog({ open, onOpenChange, initialNome = "", forceSupplier = false, onSaved }: CadastroFormDialogProps) {
  const [nome, setNome] = useState(initialNome);
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [tipo, setTipo] = useState(forceSupplier ? "fornecedor" : "cliente");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [cep, setCep] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [estado, setEstado] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setNome(initialNome);
      setEmail(""); setTelefone(""); setEmpresa("");
      setTipo(forceSupplier ? "fornecedor" : "cliente");
      setCnpj(""); setEndereco(""); setNumero(""); setComplemento("");
      setCep(""); setMunicipio(""); setEstado("");
      setObservacoes(""); setTags([]); setTagInput("");
    }
    onOpenChange(v);
  };

  const addTag = () => {
    const newTags = tagInput.split(",").map(t => t.trim()).filter(t => t && !tags.includes(t));
    if (newTags.length > 0) setTags([...tags, ...newTags]);
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

  const showSupplierFields = tipo === "fornecedor" || tipo === "ambos";

  const save = async () => {
    if (!nome.trim() || !telefone.trim()) {
      toast.error("Preencha Nome e Telefone");
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      nome, email: email || "", telefone, tipo,
      empresa: empresa || null,
      cnpj: cnpj || null, endereco: endereco || null,
      numero: numero || null, complemento: complemento || null,
      cep: cep || null, municipio: municipio || null, estado: estado || null,
      observacoes: observacoes || null,
      tags: tags.length > 0 ? tags : [],
    };

    const { data, error } = await supabase.from("clients").insert(payload as any).select("id, nome, telefone, empresa").single();
    setSaving(false);
    if (error) {
      toast.error("Erro ao cadastrar");
      return;
    }
    await logAudit({ action: "criação", entity_type: "Cadastro", entity_id: data?.id, entity_name: nome, details: `Tipo: ${tipo}` });
    toast.success("Cadastro criado!");
    onOpenChange(false);
    if (data) onSaved?.(data as any);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Cadastro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Tipo selector */}
          {!forceSupplier && (
            <div className="flex gap-2">
              <Button type="button" variant={tipo === "cliente" ? "default" : "outline"} size="sm"
                onClick={() => setTipo("cliente")} className="flex-1 gap-1.5">
                <Users className="h-3.5 w-3.5" /> Cliente
              </Button>
              <Button type="button" variant={tipo === "fornecedor" ? "default" : "outline"} size="sm"
                onClick={() => setTipo("fornecedor")} className="flex-1 gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Fornecedor
              </Button>
              <Button type="button" variant={tipo === "ambos" ? "default" : "outline"} size="sm"
                onClick={() => setTipo("ambos")} className="flex-1 gap-1.5">
                Ambos
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label>{tipo === "fornecedor" ? "Nome da Empresa *" : tipo === "ambos" ? "Nome / Empresa *" : "Nome *"}</Label>
            <Input placeholder={tipo === "fornecedor" ? "Razão social ou nome fantasia" : "Nome"} value={nome} onChange={e => setNome(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input placeholder="(00) 00000-0000" value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>

          <div className={`grid gap-3 ${showSupplierFields ? "grid-cols-2" : "grid-cols-1"}`}>
            {showSupplierFields && (
              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Input placeholder="Nome do vendedor/contato" value={empresa} onChange={e => setEmpresa(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>CNPJ/CPF</Label>
              <Input placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Endereço</Label>
              <Input placeholder="Rua, Avenida..." value={endereco} onChange={e => setEndereco(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input placeholder="Nº" value={numero} onChange={e => setNumero(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input placeholder="Sala, Bloco..." value={complemento} onChange={e => setComplemento(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input placeholder="00000-000" value={cep} onChange={e => setCep(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Município</Label>
              <Input placeholder="Cidade" value={municipio} onChange={e => setMunicipio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <select
                value={estado}
                onChange={e => setEstado(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione</option>
                {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>

          {showSupplierFields && (
            <>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea placeholder="Informações adicionais..." value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Tags (produtos fornecidos)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: Papel, Toner, Tinta..."
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addTag}>Adicionar</Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map(t => (
                      <Badge key={t} variant="secondary" className="gap-1 pr-1">
                        {t}
                        <button onClick={() => removeTag(t)} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
            <Button onClick={save} className="flex-1" disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
