import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Layers, Edit, Trash2, Users, Shield, Save, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface Grupo {
  id: string;
  nome: string;
  descricao: string;
  empresa_id: string;
  membros_count?: number;
}

interface Permission {
  chave: string;
  descricao_amigavel: string;
  categoria: string;
}

interface Profile {
  user_id: string;
  display_name: string;
  avatar_url: string;
  email?: string;
}

export default function GruposPermissoesTab() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrupo, setSelectedGrupo] = useState<Grupo | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groupPermissions, setGroupPermissions] = useState<Record<string, boolean>>({});
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [membros, setMembros] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [newGrupo, setNewGrupo] = useState({ nome: "", descricao: "" });

  useEffect(() => {
    loadGrupos();
    loadPermissions();
    loadAllUsers();
  }, []);

  const loadGrupos = async () => {
    setLoading(true);
    const { data: gruposData } = await supabase.from("grupos").select("*");
    const { data: counts } = await supabase.from("usuario_grupos").select("grupo_id");
    
    const countMap: Record<string, number> = {};
    counts?.forEach(c => countMap[c.grupo_id] = (countMap[c.grupo_id] || 0) + 1);
    
    setGrupos((gruposData as Grupo[])?.map(g => ({ ...g, membros_count: countMap[g.id] || 0 })) || []);
    setLoading(false);
  };

  const loadPermissions = async () => {
    const { data } = await supabase.from("permissoes_disponiveis").select("*").order("categoria");
    setPermissions(data || []);
  };

  const loadAllUsers = async () => {
    const { data } = await supabase.rpc("list_users_admin");
    setAllUsers((data as any[]) || []);
  };

  const openGrupo = async (grupo: Grupo) => {
    setSelectedGrupo(grupo);
    setPendingChanges({});
    
    // Load group permissions
    const { data } = await supabase
      .from("permissoes_grupo")
      .select("permissao_chave, habilitada")
      .eq("grupo_id", grupo.id);
    
    const gpMap: Record<string, boolean> = {};
    data?.forEach(gp => gpMap[gp.permissao_chave] = gp.habilitada);
    setGroupPermissions(gpMap);

    // Load members
    const { data: membersData } = await supabase
      .from("usuario_grupos")
      .select(`
        user_id,
        profiles!inner(display_name, avatar_url)
      `)
      .eq("grupo_id", grupo.id);
    
    setMembros((membersData as any[])?.map(m => ({
      user_id: m.user_id,
      display_name: m.profiles.display_name,
      avatar_url: m.profiles.avatar_url
    })) || []);
  };

  const handleToggle = (chave: string, currentValue: boolean) => {
    setPendingChanges(prev => ({ ...prev, [chave]: !currentValue }));
  };

  const saveGroupPermissions = async () => {
    if (!selectedGrupo) return;
    setSaving(true);
    try {
      const updates = Object.entries(pendingChanges).map(([chave, habilitada]) => ({
        grupo_id: selectedGrupo.id,
        permissao_chave: chave,
        habilitada,
        empresa_id: selectedGrupo.empresa_id
      }));
      
      await supabase.from("permissoes_grupo").upsert(updates);
      toast.success("Permissões do grupo salvas!");
      setGroupPermissions(prev => ({ ...prev, ...pendingChanges }));
      setPendingChanges({});
    } catch (e) {
      toast.error("Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  const addMember = async (userId: string) => {
    if (!selectedGrupo) return;
    try {
      await supabase.from("usuario_grupos").insert({
        user_id: userId,
        grupo_id: selectedGrupo.id,
        empresa_id: selectedGrupo.empresa_id
      });
      toast.success("Membro adicionado!");
      openGrupo(selectedGrupo); // Refresh
      loadGrupos(); // Refresh counts
    } catch (e) {
      toast.error("Erro ao adicionar membro");
    }
  };

  const removeMember = async (userId: string) => {
    if (!selectedGrupo) return;
    try {
      await supabase
        .from("usuario_grupos")
        .delete()
        .eq("user_id", userId)
        .eq("grupo_id", selectedGrupo.id);
      toast.success("Membro removido!");
      openGrupo(selectedGrupo); // Refresh
      loadGrupos(); // Refresh counts
    } catch (e) {
      toast.error("Erro ao remover membro");
    }
  };

  const handleCreateGroup = async () => {
    setSaving(true);
    try {
      // Get current company ID
      const { data: profile } = await supabase.from("profiles").select("empresa_id").single();
      const { data, error } = await supabase.from("grupos").insert({
        nome: newGrupo.nome,
        descricao: newGrupo.descricao,
        empresa_id: profile?.empresa_id
      }).select().single();
      
      if (error) throw error;
      toast.success("Grupo criado com sucesso!");
      loadGrupos();
      setIsEditing(false);
      setNewGrupo({ nome: "", descricao: "" });
    } catch (e) {
      toast.error("Erro ao criar grupo");
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este grupo?")) return;
    try {
      await supabase.from("grupos").delete().eq("id", id);
      toast.success("Grupo excluído");
      loadGrupos();
    } catch (e) {
      toast.error("Erro ao excluir grupo");
    }
  };

  const categories = useMemo(() => {
    const cats: Record<string, Permission[]> = {};
    permissions.forEach(p => {
      if (!cats[p.categoria]) cats[p.categoria] = [];
      cats[p.categoria].push(p);
    });
    return cats;
  }, [permissions]);

  const availableUsers = allUsers.filter(u => 
    !membros.some(m => m.user_id === u.user_id) &&
    (u.display_name?.toLowerCase().includes(userSearch.toLowerCase()) || 
     u.email?.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar grupos..." className="pl-9" />
        </div>
        <Button onClick={() => setIsEditing(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Grupo
        </Button>
      </div>

      <ScrollArea className="flex-1 border rounded-md p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse h-32" />
            ))
          ) : grupos.map(grupo => (
            <Card key={grupo.id} className="group hover:border-primary/50 transition-colors cursor-pointer" onClick={() => openGrupo(grupo)}>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">{grupo.nome}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteGroup(grupo.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs line-clamp-1">{grupo.descricao || "Sem descrição"}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {grupo.membros_count} membros
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold">Gerenciar</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <Sheet open={!!selectedGrupo} onOpenChange={o => !o && setSelectedGrupo(null)}>
        <SheetContent className="sm:max-w-md flex flex-col h-full">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <div>
                <SheetTitle>{selectedGrupo?.nome}</SheetTitle>
                <SheetDescription>{selectedGrupo?.descricao}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="permissoes" className="flex-1 flex flex-col mt-6 overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="permissoes" className="gap-2">
                <Shield className="h-3.5 w-3.5" /> Permissões
              </TabsTrigger>
              <TabsTrigger value="membros" className="gap-2">
                <Users className="h-3.5 w-3.5" /> Membros
              </TabsTrigger>
            </TabsList>

            <TabsContent value="permissoes" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full pr-4 pb-20">
                <div className="space-y-6">
                  {Object.entries(categories).map(([cat, perms]) => (
                    <div key={cat} className="space-y-3">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{cat}</h4>
                      <div className="space-y-2">
                        {perms.map(p => {
                          const isHabilitada = pendingChanges[p.chave] !== undefined ? pendingChanges[p.chave] : !!groupPermissions[p.chave];
                          return (
                            <div key={p.chave} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                              <span className="text-sm font-medium">{p.descricao_amigavel}</span>
                              <Switch 
                                checked={isHabilitada} 
                                onCheckedChange={() => handleToggle(p.chave, isHabilitada)} 
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {Object.keys(pendingChanges).length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t">
                  <Button className="w-full gap-2" onClick={saveGroupPermissions} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar {Object.keys(pendingChanges).length} alterações
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="membros" className="flex-1 overflow-hidden mt-4 flex flex-col">
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Adicionar membro..." 
                    className="pl-8" 
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                  />
                </div>
                {userSearch && availableUsers.length > 0 && (
                  <Card className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto">
                    <CardContent className="p-2">
                      {availableUsers.map(u => (
                        <div 
                          key={u.user_id} 
                          className="flex items-center justify-between p-2 hover:bg-muted rounded-md cursor-pointer"
                          onClick={() => { addMember(u.user_id); setUserSearch(""); }}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={u.avatar_url} />
                              <AvatarFallback>{u.display_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{u.display_name}</span>
                          </div>
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-2">
                  {membros.map(m => (
                    <div key={m.user_id} className="flex items-center justify-between p-2 border rounded-md">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={m.avatar_url} />
                          <AvatarFallback>{m.display_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{m.display_name}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeMember(m.user_id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {membros.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum membro neste grupo.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <Sheet open={isEditing} onOpenChange={setIsEditing}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Criar Novo Grupo</SheetTitle>
            <SheetDescription>Defina o nome e a descrição do novo grupo de permissões.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Grupo</label>
              <Input 
                placeholder="Ex: Financeiro, Produção, Admins..." 
                value={newGrupo.nome}
                onChange={e => setNewGrupo(prev => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Input 
                placeholder="Ex: Responsável pelo faturamento e contas..." 
                value={newGrupo.descricao}
                onChange={e => setNewGrupo(prev => ({ ...prev, descricao: e.target.value }))}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
            <Button onClick={handleCreateGroup} disabled={saving || !newGrupo.nome}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Grupo"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Add this useMemo import to the top
import { useMemo } from "react";
