import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import PageLoader from "@/components/PageLoader";

interface Fornecedor {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cnpj: string | null;
  endereco: string | null;
}

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { requireAdmin } = usePermissionGuard();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");

  const fetchFornecedores = async () => {
    setLoading(true);
    const { data } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
    if (data) setFornecedores(data);
    setLoading(false);
  };

  useEffect(() => { fetchFornecedores(); }, []);

  const openNewDialog = () => {
    setEditingFornecedor(null);
    setNome(""); setEmail(""); setTelefone(""); setCnpj(""); setEndereco("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (f: Fornecedor) => {
    setEditingFornecedor(f);
    setNome(f.nome); setEmail(f.email); setTelefone(f.telefone);
    setCnpj(f.cnpj || ""); setEndereco(f.endereco || "");
    setIsDialogOpen(true);
  };

  const saveFornecedor = async () => {
    if (!nome.trim() || !email.trim() || !telefone.trim()) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    if (!requireAdmin(editingFornecedor ? "atualizar fornecedor" : "cadastrar fornecedor")) return;
    if (editingFornecedor) {
      const { error } = await supabase.from("suppliers").update({ nome, email, telefone, cnpj: cnpj || null, endereco: endereco || null }).eq("id", editingFornecedor.id);
      if (error) return handleError(error, "atualizar fornecedor");
      toast.success("Fornecedor atualizado!");
    } else {
      const { error } = await supabase.from("suppliers").insert({ nome, email, telefone, cnpj: cnpj || null, endereco: endereco || null });
      if (error) return handleError(error, "cadastrar fornecedor");
      toast.success("Fornecedor cadastrado!");
    }
    setIsDialogOpen(false);
    fetchFornecedores();
  };

  const deleteFornecedor = async (id: string) => {
    if (!requireAdmin("excluir fornecedor")) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return handleError(error, "excluir fornecedor");
    toast.success("Fornecedor excluído!");
    fetchFornecedores();
  };

  const filteredFornecedores = fornecedores.filter((f) =>
    f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) { return <PageLoader />; }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fornecedores</h1>
          <p className="mt-1 text-muted-foreground">Gerencie seus parceiros de serviços</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <span>
              <AdminOnly mode="disable" action="cadastrar fornecedor">
                <Button size="lg" className="gap-2 bg-accent hover:bg-accent-hover" onClick={openNewDialog}>
                  <Plus className="h-5 w-5" /> Novo Fornecedor
                </Button>
              </AdminOnly>
            </span>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFornecedor ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2"><Label>Nome da Empresa *</Label><Input placeholder="Nome do fornecedor" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
              <div className="space-y-2"><Label>E-mail *</Label><Input type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>Telefone *</Label><Input placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
              <div className="space-y-2"><Label>CNPJ</Label><Input placeholder="00.000.000/0000-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
              <div className="space-y-2"><Label>Endereço</Label><Input placeholder="Endereço completo" value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={saveFornecedor} className="flex-1 bg-accent hover:bg-accent-hover">{editingFornecedor ? "Atualizar" : "Cadastrar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-6 shadow-card">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar fornecedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader><CardTitle>Lista de Fornecedores</CardTitle></CardHeader>
        <CardContent>
          {filteredFornecedores.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{searchTerm ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFornecedores.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>{f.email}</TableCell>
                    <TableCell>{f.telefone}</TableCell>
                    <TableCell>{f.cnpj || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <AdminOnly mode="disable" action="editar fornecedor">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(f)} className="hover:bg-primary/10 hover:text-primary"><Edit className="h-4 w-4" /></Button>
                        </AdminOnly>
                        <AdminOnly mode="disable" action="excluir fornecedor">
                          <Button variant="ghost" size="icon" onClick={() => deleteFornecedor(f.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AdminOnly>
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
  );
}
