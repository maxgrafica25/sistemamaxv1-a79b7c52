import { PageHeader } from "@/components/PageHeader";
import { Shield, Users, Layers } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import UsuariosPermissoesTab from "@/components/permissoes/UsuariosPermissoesTab";
import GruposPermissoesTab from "@/components/permissoes/GruposPermissoesTab";

export default function Permissoes() {
  const [activeTab, setActiveTab] = useState("usuarios");

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <PageHeader 
        icon={Shield} 
        title="Gestão de Permissões" 
        description="Controle o acesso de usuários e grupos às funcionalidades do sistema" 
        className="mb-4" 
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-4">
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="grupos" className="gap-2">
            <Layers className="h-4 w-4" />
            Grupos/Setores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="flex-1 min-h-0 overflow-hidden mt-0">
          <UsuariosPermissoesTab />
        </TabsContent>

        <TabsContent value="grupos" className="flex-1 min-h-0 overflow-hidden mt-0">
          <GruposPermissoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
