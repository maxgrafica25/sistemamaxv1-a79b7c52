import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, TrendingUp, Clock, CheckCircle2, AlertTriangle, LayoutDashboard } from "lucide-react";

// Mock data
const recentQuotes = [
  { id: "2025-001", client: "João Silva", product: "Cartões de Visita 500un", value: 450, status: "approved", date: "2025-01-08" },
  { id: "2025-002", client: "Maria Santos", product: "Banner em Lona 2x1m", value: 280, status: "sent", date: "2025-01-09" },
  { id: "2025-003", client: "Tech Solutions", product: "Folders A4 1000un", value: 1200, status: "rejected", date: "2025-01-09" },
  { id: "2025-004", client: "Café Central", product: "Cardápio Plastificado", value: 650, status: "sent", date: "2025-01-10" },
];

const lowStockMaterials = [
  { name: "Papel Couché 300g", currentStock: 50, minStock: 100, unit: "folhas" },
  { name: "Tinta Ciano CMYK", currentStock: 0.5, minStock: 1, unit: "litro" },
  { name: "Papel Offset 75g", currentStock: 3, minStock: 5, unit: "resmas" },
];

const stats = [
  { name: "Total de Orçamentos", value: "124", icon: FileText, change: "+12%" },
  { name: "Aprovados", value: "87", icon: CheckCircle2, change: "+8%" },
  { name: "Aguardando", value: "23", icon: Clock, change: "+3%" },
  { name: "Valor Total (mês)", value: "R$ 45.680", icon: TrendingUp, change: "+15%" },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-800 border-green-300">Aprovado</Badge>;
    case "sent":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Enviado</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-800 border-red-300">Recusado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral dos seus orçamentos</p>
        </div>
        <Link to="/orcamento/novo">
          <Button size="lg" className="gap-2 bg-accent hover:bg-accent-hover">
            <Plus className="h-5 w-5" />
            Criar Novo Orçamento
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
                  <p className="mt-1 text-xs font-medium text-success">{stat.change} vs mês anterior</p>
                </div>
                <div className="rounded-full bg-primary/10 p-3">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, cliente ou produto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockMaterials.length > 0 && (
        <Card className="mb-6 shadow-card border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-5 w-5" />
              Alerta: Matérias-Primas com Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockMaterials.map((material, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                  <div>
                    <p className="font-medium text-foreground">{material.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Estoque atual: {material.currentStock} {material.unit} | 
                      Mínimo: {material.minStock} {material.unit}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                    {material.currentStock === 0 ? "Esgotado" : "Baixo"}
                  </Badge>
                </div>
              ))}
            </div>
            <Link to="/materias-primas" className="mt-4 block">
              <Button variant="outline" className="w-full">
                Gerenciar Matérias-Primas
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Recent Quotes Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Orçamentos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm font-medium text-muted-foreground">
                  <th className="pb-3 pl-4">Nº Orçamento</th>
                  <th className="pb-3">Cliente</th>
                  <th className="pb-3">Produto/Serviço</th>
                  <th className="pb-3">Valor</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Data</th>
                  <th className="pb-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {recentQuotes.map((quote) => (
                  <tr key={quote.id} className="border-b border-border last:border-0 transition-colors hover:bg-muted/50">
                    <td className="py-4 pl-4 text-sm font-medium text-primary">{quote.id}</td>
                    <td className="py-4 text-sm text-foreground">{quote.client}</td>
                    <td className="py-4 text-sm text-foreground">{quote.product}</td>
                    <td className="py-4 text-sm font-medium text-foreground">
                      R$ {quote.value.toFixed(2)}
                    </td>
                    <td className="py-4">{getStatusBadge(quote.status)}</td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {new Date(quote.date).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <Button variant="ghost" size="sm">
                        Ver detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
