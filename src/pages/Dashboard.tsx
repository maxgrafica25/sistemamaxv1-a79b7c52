import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search, FileText, Clock, CheckCircle2, AlertTriangle, Home,
  ClipboardList, ShoppingCart, Wallet, Wrench, ArrowRight,
} from "lucide-react";
import { useIsFinanceiro } from "@/hooks/useIsFinanceiro";
import { RecorrentesVencendoCard } from "@/components/dashboard/RecorrentesVencendoCard";

// Mock data — substituir por queries reais quando disponível
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

interface ActionItem {
  label: string;
  count: number;
  hint: string;
  to: string;
  icon: typeof ClipboardList;
  tone: "primary" | "warning" | "danger" | "info";
}

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const isFinanceiro = useIsFinanceiro();

  // Itens de "Ações pendentes" — counts são placeholders enquanto não há queries reais
  const actions: ActionItem[] = [
    {
      label: "Orçamentos aguardando",
      count: 23,
      hint: "Cliente ainda não respondeu",
      to: "/orcamentos?status=sent",
      icon: ClipboardList,
      tone: "primary",
    },
    {
      label: "Pedidos em produção",
      count: 8,
      hint: "Acompanhe o kanban",
      to: "/pedidos",
      icon: ShoppingCart,
      tone: "info",
    },
    ...(isFinanceiro
      ? [{
          label: "Contas vencendo",
          count: 4,
          hint: "Próximos 3 dias",
          to: "/financeiro/receber",
          icon: Wallet,
          tone: "warning" as const,
        }]
      : []),
    {
      label: "Estoque baixo",
      count: lowStockMaterials.length,
      hint: "Materiais para repor",
      to: "/insumos",
      icon: AlertTriangle,
      tone: "danger",
    },
    {
      label: "Manutenções pendentes",
      count: 2,
      hint: "Equipamentos",
      to: "/equipamentos",
      icon: Wrench,
      tone: "info",
    },
  ];

  const toneClasses: Record<ActionItem["tone"], string> = {
    primary: "border-primary/20 hover:border-primary/40 [&_[data-icon]]:text-primary [&_[data-icon-bg]]:bg-primary/10",
    info: "border-blue-500/20 hover:border-blue-500/40 [&_[data-icon]]:text-blue-500 [&_[data-icon-bg]]:bg-blue-500/10",
    warning: "border-amber-500/30 hover:border-amber-500/50 [&_[data-icon]]:text-amber-600 [&_[data-icon-bg]]:bg-amber-500/10",
    danger: "border-orange-500/30 hover:border-orange-500/50 [&_[data-icon]]:text-orange-600 [&_[data-icon-bg]]:bg-orange-500/10",
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Home className="h-6 w-6 text-primary" />
          Hoje
        </h1>
        <p className="text-sm text-muted-foreground mt-1">O que precisa da sua atenção agora</p>
      </div>

      {/* Ações pendentes */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
          Ações pendentes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.label}
                to={a.to}
                className={`group rounded-lg border bg-card p-4 transition-all hover:shadow-sm ${toneClasses[a.tone]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div data-icon-bg className="rounded-md p-2">
                    <Icon data-icon className="h-4 w-4" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                </div>
                <p className="mt-3 text-2xl font-bold text-foreground tabular-nums">{a.count}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{a.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.hint}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recorrentes vencendo */}
      <div className="mb-8">
        <RecorrentesVencendoCard />
      </div>

      {/* Stats Grid */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
          Resumo do mês
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
