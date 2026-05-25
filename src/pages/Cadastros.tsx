import { PageHeader } from "@/components/PageHeader";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Search, Loader2, Users, Building2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import ConfirmDialog from "@/components/ConfirmDialog";
import { handleError } from "@/lib/handleError";
import PageLoader from "@/components/PageLoader";
import { DotTabs } from "@/components/ui/dot-tabs";

interface Cadastro {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  empresa: string | null;
  tipo: string;
  cnpj: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  cep: string | null;
  municipio: string | null;
  estado: string | null;
  observacoes: string | null;
  tags: string[] | null;
}

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

export default function Cadastros() {
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Cadastro | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("todos");

  // Form fields
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [tipo, setTipo] = useState("cliente");
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

  // Confirm delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (data) setCadastros(data as unknown as Cadastro[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openNewDialog = () => {
    setEditing(null);
    setNome(""); setEmail(""); setTelefone(""); setEmpresa("");
    setTipo("cliente"); setCnpj(""); setEndereco("");
    setNumero(""); setComplemento(""); setCep(""); setMunicipio(""); setEstado("");
    setObservacoes(""); setTags([]); setTagInput("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (c: Cadastro) => {
    setEditing(c);
    setNome(c.nome); setEmail(c.email || ""); setTelefone(c.telefone || "");
    setEmpresa(c.empresa || ""); setTipo(c.tipo);
    setCnpj(c.cnpj || ""); setEndereco(c.endereco || "");
    setNumero(c.numero || ""); setComplemento(c.complemento || "");
    setCep(c.cep || ""); setMunicipio(c.municipio || ""); setEstado(c.estado || "");
    setObservacoes(c.observacoes || ""); setTags(c.tags || []); setTagInput("");
    setIsDialogOpen(true);
  };

  const addTag = () => {
    const newTags = tagInput
      .split(",")
      .map(t => t.trim())
      .filter(t => t && !tags.includes(t));
    if (newTags.length > 0) {
      setTags([...tags, ...newTags]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

  const save = async () => {
    if (!nome.trim() || !telefone.trim()) {
      toast.error("Preencha Nome e Telefone");
      return;
    }
    const payload: Record<string, unknown> = {
      nome, email: email || "", telefone,
      empresa: empresa || null, tipo,
      cnpj: cnpj || null, endereco: endereco || null,
      numero: numero || null, complemento: complemento || null,
      cep: cep || null, municipio: municipio || null, estado: estado || null,
      observacoes: observacoes || null,
      tags: tags.length > 0 ? tags : [],
    };

    if (editing) {
      const { error } = await supabase.from("clients").update(payload as any).eq("id", editing.id);
      if (error) return handleError(error, "atualizar cadastro");
      await logAudit({ action: "edição", entity_type: "Cadastro", entity_id: editing.id, entity_name: nome, details: `Tipo: ${tipo}` });
      toast.success("Cadastro atualizado!");
    } else {
      const { data, error } = await supabase.from("clients").insert(payload as any).select("id").single();
      if (error) return handleError(error, "criar cadastro");
      await logAudit({ action: "criação", entity_type: "Cadastro", entity_id: data?.id, entity_name: nome, details: `Tipo: ${tipo}` });
      toast.success("Cadastro criado!");
    }
    setIsDialogOpen(false);
    fetchAll();
  };

  const requestDelete = (id: string, name: string) => {
    setDeleteId(id);
    setDeleteName(name);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("clients").delete().eq("id", deleteId);
    if (error) { handleError(error, "excluir cadastro"); setConfirmOpen(false); return; }
    await logAudit({ action: "exclusão", entity_type: "Cadastro", entity_id: deleteId, entity_name: deleteName });
    toast.success("Cadastro excluído!");
    setConfirmOpen(false);
    fetchAll();
  };

  const filtered = cadastros.filter((c) => {
    if (activeTab === "clientes" && c.tipo !== "cliente" && c.tipo !== "ambos") return false;
    if (activeTab === "fornecedores" && c.tipo !== "fornecedor" && c.tipo !== "ambos") return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return c.nome.toLowerCase().includes(s) ||
        (c.email || "").toLowerCase().includes(s) ||
        (c.empresa || "").toLowerCase().includes(s) ||
        (c.tags || []).some(t => t.toLowerCase().includes(s));
    }
    return true;
  });

  const clientCount = cadastros.filter(c => c.tipo === "cliente" || c.tipo === "ambos").length;
  const supplierCount = cadastros.filter(c => c.tipo === "fornecedor" || c.tipo === "ambos").length;

  const tipoLabel = (t: string) => {
    if (t === "ambos") return "Cliente/Fornecedor";
    if (t === "fornecedor") return "Fornecedor";
    return "Cliente";
  };

  if (loading) { return <PageLoader />; }

  const showSupplierFields = tipo === "fornecedor" || tipo === "ambos";

  return (
    <div className="p-3 sm:p-4 lg:p-6 xl:p-8 space-y-4 lg:space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <PageHeader icon={Users} title="Cadastros" description="Clientes e fornecedores em um só lugar" />
        <Button onClick={openNewDialog} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Cadastro
        </Button>
      </div>

      <DotTabs
        tabs={[
          { key: "todos", label: `Todos (${cadastros.length})` },
          { key: "clientes", label: `Clientes (${clientCount})` },
          { key: "fornecedores", label: `Fornecedores (${supplierCount})` },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        className="mb-4"
      />

      <div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, email, empresa ou tag..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
          </div>

          <Card>
            <CardContent className="pt-4">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">Nenhum cadastro encontrado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Vendedor/Contato</TableHead>
                      <TableHead>Município</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>
                          {c.tipo === "ambos" ? (
                            <Badge className="bg-accent text-accent-foreground text-xs">Ambos</Badge>
                          ) : c.tipo === "cliente" ? (
                            <Badge className="bg-primary text-primary-foreground text-xs">Cliente</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-[hsl(var(--warning))] text-[hsl(var(--warning))]">Fornecedor</Badge>
                          )}
                        </TableCell>
                        <TableCell>{c.telefone}</TableCell>
                        <TableCell>{c.empresa || "-"}</TableCell>
                        <TableCell>{c.municipio || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(c.tags || []).slice(0, 3).map(t => (
                              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                            ))}
                            {(c.tags || []).length > 3 && (
                              <Badge variant="secondary" className="text-[10px]">+{(c.tags || []).length - 3}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(c)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => requestDelete(c.id, c.nome)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cadastro" : "Novo Cadastro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Tipo selector */}
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

            <div className="space-y-2">
              <Label>{tipo === "fornecedor" ? "Nome da Empresa *" : tipo === "ambos" ? "Nome / Empresa *" : "Nome *"}</Label>
              <Input placeholder={tipo === "fornecedor" ? "Razão social ou nome fantasia" : tipo === "ambos" ? "Nome do cliente ou empresa" : "Nome do cliente"} value={nome} onChange={e => setNome(e.target.value)} />
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

            {/* Supplier-only fields */}
            {showSupplierFields && (
              <>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea placeholder="Informações adicionais sobre o fornecedor..." value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} />
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
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={save} className="flex-1">{editing ? "Atualizar" : "Cadastrar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir cadastro?"
        description={`Tem certeza que deseja excluir "${deleteName}"? Esta ação não pode ser desfeita.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
