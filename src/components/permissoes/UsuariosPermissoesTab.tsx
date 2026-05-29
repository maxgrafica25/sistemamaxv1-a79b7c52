import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Shield, Settings, Info, Loader2, Save, RotateCcw, Layers } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface User {
  user_id: string;
  display_name: string;
  avatar_url: string;
  role: string;
  is_active: boolean;
  email?: string;
}

interface Permission {
  chave: string;
  descricao_amigavel: string;
  categoria: string;
}

interface UserPermissionOverride {
  permissao_chave: string;
  habilitada: boolean;
}

interface GroupPermission {
  permissao_chave: string;
  habilitada: boolean;
  grupo_nome: string;
}

export default function UsuariosPermissoesTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean | null>>({});
  const [groupPermissions, setGroupPermissions] = useState<Record<string, GroupPermission>>({});
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean | null>>({});
  const [saving, setSaving] = useState(false);
  const [showEffective, setShowEffective] = useState(false);

  useEffect(() => {
    loadUsers();
    loadPermissions();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("list_users_admin");
    setUsers((data as any[]) || []);
    setLoading(false);
  };

  const loadPermissions = async () => {
    const { data } = await supabase.from("permissoes_disponiveis").select("*").order("categoria");
    setPermissions(data || []);
  };

  const openUserPermissions = async (user: User) => {
    setSelectedUser(user);
    setPendingChanges({});
    
    // Load overrides
    const { data: overrides } = await supabase
      .from("permissoes_usuario")
      .select("permissao_chave, habilitada")
      .eq("user_id", user.user_id);
    
    const overrideMap: Record<string, boolean> = {};
    overrides?.forEach(o => overrideMap[o.permissao_chave] = o.habilitada);
    setUserOverrides(overrideMap);

    // Load group permissions
    const { data: gpData } = await supabase
      .from("permissoes_grupo")
      .select(`
        permissao_chave, 
        habilitada,
        grupos!inner(nome)
      `)
      .in("grupo_id", (
        await supabase
          .from("usuario_grupos")
          .select("grupo_id")
          .eq("user_id", user.user_id)
      ).data?.map(g => g.grupo_id) || []);

    const gpMap: Record<string, GroupPermission> = {};
    (gpData as any[])?.forEach(gp => {
      // Logic: if multiple groups, if any is enabled, it's enabled? Or just take the first.
      if (!gpMap[gp.permissao_chave] || gp.habilitada) {
        gpMap[gp.permissao_chave] = {
          permissao_chave: gp.permissao_chave,
          habilitada: gp.habilitada,
          grupo_nome: gp.grupos.nome
        };
      }
    });
    setGroupPermissions(gpMap);
  };

  const handleToggle = (chave: string, currentValue: boolean | null) => {
    const nextValue = currentValue === null ? true : currentValue === true ? false : null;
    setPendingChanges(prev => ({ ...prev, [chave]: nextValue }));
  };

  const saveChanges = async () => {
    if (!selectedUser) return;
    setSaving(true);
    
    try {
      const changes = Object.entries(pendingChanges);
      for (const [chave, val] of changes) {
        if (val === null) {
          await supabase
            .from("permissoes_usuario")
            .delete()
            .eq("user_id", selectedUser.user_id)
            .eq("permissao_chave", chave);
        } else {
          await supabase
            .from("permissoes_usuario")
            .upsert({
              user_id: selectedUser.user_id,
              permissao_chave: chave,
              habilitada: val,
              empresa_id: (await supabase.from("profiles").select("empresa_id").eq("user_id", selectedUser.user_id).single()).data?.empresa_id
            });
        }
      }
      toast.success("Permissões atualizadas com sucesso!");
      openUserPermissions(selectedUser); // Refresh
    } catch (error) {
      toast.error("Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.display_name?.toLowerCase().includes(search.toLowerCase()) || 
      u.email?.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  const categories = useMemo(() => {
    const cats: Record<string, Permission[]> = {};
    permissions.forEach(p => {
      if (!cats[p.categoria]) cats[p.categoria] = [];
      cats[p.categoria].push(p);
    });
    return cats;
  }, [permissions]);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou e-mail..." 
            className="pl-9" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
      </div>

      <ScrollArea className="flex-1 border rounded-md p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 h-24" />
              </Card>
            ))
          ) : filteredUsers.map(user => (
            <Card 
              key={user.user_id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => openUserPermissions(user)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback>{user.display_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{user.display_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px] py-0">{user.role}</Badge>
                    {!user.is_active && <Badge variant="destructive" className="text-[10px] py-0">Inativo</Badge>}
                  </div>
                </div>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <Sheet open={!!selectedUser} onOpenChange={o => !o && setSelectedUser(null)}>
        <SheetContent className="sm:max-w-md flex flex-col h-full">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={selectedUser?.avatar_url} />
                <AvatarFallback>{selectedUser?.display_name?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle>{selectedUser?.display_name}</SheetTitle>
                <SheetDescription>{selectedUser?.email}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <Separator className="my-4" />
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Permissões por Categoria</h3>
            <Button variant="outline" size="sm" onClick={() => setShowEffective(true)}>
              Ver Permissões Efetivas
            </Button>
          </div>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 pb-20">
              {Object.entries(categories).map(([cat, perms]) => (
                <div key={cat} className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{cat}</h4>
                  <div className="space-y-2">
                    {perms.map(p => {
                      const override = pendingChanges[p.chave] !== undefined ? pendingChanges[p.chave] : userOverrides[p.chave];
                      const groupPerm = groupPermissions[p.chave];
                      const isInherited = override === undefined || override === null;
                      const effectiveValue = isInherited ? !!groupPerm?.habilitada : !!override;
                      
                      return (
                        <div key={p.chave} className="flex items-center justify-between p-2 rounded-lg border bg-muted/30">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{p.descricao_amigavel}</span>
                            {isInherited && groupPerm && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Layers className="h-3 w-3" /> Herdado: {groupPerm.grupo_nome}
                              </span>
                            )}
                            {!isInherited && (
                              <span className="text-[10px] text-primary font-medium">Individual</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!isInherited && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleToggle(p.chave, null)}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Switch 
                              checked={effectiveValue} 
                              onCheckedChange={() => handleToggle(p.chave, override ?? !!groupPerm?.habilitada)}
                              className={!isInherited ? (override ? "data-[state=checked]:bg-green-500" : "data-[state=unchecked]:bg-red-500") : ""}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t">
            {Object.keys(pendingChanges).length > 0 && (
              <div className="w-full flex items-center gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setPendingChanges({})}>Cancelar</Button>
                <Button className="flex-1 gap-2" onClick={saveChanges} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar {Object.keys(pendingChanges).length} alterações
                </Button>
              </div>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={showEffective} onOpenChange={setShowEffective}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Permissões Efetivas: {selectedUser?.display_name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 mt-4">
            <div className="space-y-4">
              {permissions.map(p => {
                const override = userOverrides[p.chave];
                const gp = groupPermissions[p.chave];
                const isIndividual = override !== undefined && override !== null;
                const habilitada = isIndividual ? !!override : !!gp?.habilitada;
                
                return (
                  <div key={p.chave} className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <div className="font-medium text-sm">{p.descricao_amigavel}</div>
                      <div className="text-xs text-muted-foreground">{p.categoria}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={isIndividual ? "default" : "secondary"} className="text-[10px]">
                        {isIndividual ? "Individual" : gp ? `Grupo: ${gp.grupo_nome}` : "Padrão"}
                      </Badge>
                      <Badge variant={habilitada ? "outline" : "destructive"} className={habilitada ? "bg-green-50 text-green-700 border-green-200" : ""}>
                        {habilitada ? "Habilitado" : "Negado"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
