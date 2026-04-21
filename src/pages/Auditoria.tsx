import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: string | null;
  created_at: string;
}

const actionBadge = (action: string) => {
  switch (action) {
    case "criação": return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Criação</Badge>;
    case "edição": return <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]">Edição</Badge>;
    case "exclusão": return <Badge className="bg-destructive text-destructive-foreground">Exclusão</Badge>;
    default: return <Badge variant="outline">{action}</Badge>;
  }
};

export default function Auditoria() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, entity_type, entity_id, entity_name, details, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) handleError(error, "carregar logs de auditoria");
      if (data) setLogs(data as AuditLog[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const entityTypes = [...new Set(logs.map(l => l.entity_type))].sort();

  const filtered = logs.filter(l => {
    if (filterAction !== "all" && l.action !== filterAction) return false;
    if (filterEntity !== "all" && l.entity_type !== filterEntity) return false;
    if (search) {
      const s = search.toLowerCase();
      return (l.entity_name || "").toLowerCase().includes(s) ||
        (l.details || "").toLowerCase().includes(s) ||
        l.entity_type.toLowerCase().includes(s);
    }
    return true;
  });

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Auditoria do Sistema
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Histórico de todas as alterações realizadas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-[hsl(var(--success))]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Criações</p>
            <p className="text-2xl font-bold">{logs.filter(l => l.action === "criação").length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[hsl(var(--warning))]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Edições</p>
            <p className="text-2xl font-bold">{logs.filter(l => l.action === "edição").length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Exclusões</p>
            <p className="text-2xl font-bold">{logs.filter(l => l.action === "exclusão").length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas ações</SelectItem>
            <SelectItem value="criação">Criação</SelectItem>
            <SelectItem value="edição">Edição</SelectItem>
            <SelectItem value="exclusão">Exclusão</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Entidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas entidades</SelectItem>
            {entityTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Registros ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum registro encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{actionBadge(log.action)}</TableCell>
                      <TableCell className="text-sm">{log.entity_type}</TableCell>
                      <TableCell className="text-sm font-medium">{log.entity_name || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{log.details || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
