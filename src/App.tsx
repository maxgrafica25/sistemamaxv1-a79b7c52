import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanySettingsProvider } from "@/hooks/useCompanySettings";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Chat from "./pages/Chat";
import AssistenteButton from "@/components/assistente/AssistenteButton";
import CommandPalette from "@/components/CommandPalette";
import { CommandPaletteProvider } from "@/hooks/useCommandPalette";

import Cadastros from "./pages/Cadastros";
import MateriasPrimas from "./pages/MateriasPrimas";
import ProcessosProducao from "./pages/ProcessosProducao";
import Configuracoes from "./pages/Configuracoes";
import DespesasFixas from "./pages/DespesasFixas";
import PrecoImpressao from "./pages/PrecoImpressao";
import Equipamentos from "./pages/Equipamentos";
import Auditoria from "./pages/Auditoria";
import Monitoramento from "./pages/Monitoramento";
import Produtos from "./pages/Produtos";
import QuotePresets from "./pages/QuotePresets";
import GruposMateriais from "./pages/GruposMateriais";
import KitsProduto from "./pages/KitsProduto";
import Insumos from "./pages/Insumos";
import CadastrosCV from "./pages/CadastrosCV";
import OrcamentosV3 from "./pages/orcamentos-v3/OrcamentosV3";
import Usuarios from "./pages/Usuarios";
import NewQuoteV3 from "./pages/orcamentos-v3/NewQuoteV3";
import ClientViewerV3 from "./pages/orcamentos-v3/ClientViewerV3";


import Pedidos from "./pages/Pedidos";
import ContasReceber from "./pages/ContasReceber";
import CalculadoraEtiquetas from "./pages/CalculadoraEtiquetas";
import Acabamentos from "./pages/Acabamentos";
import Permissoes from "./pages/configuracoes/Permissoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <CompanySettingsProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <CommandPaletteProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/p/:token" element={<ClientViewerV3 />} />
                {/* Rotas antigas — invalidadas pela Migration 6 (links sequenciais permitiam enumeração). */}
                <Route path="/view-quote/:id" element={<NotFound />} />
                <Route path="/view-quote-v2/:id" element={<NotFound />} />
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/pedidos" element={<Pedidos />} />
                  <Route path="/financeiro/receber" element={<RoleProtectedRoute requires="financeiro"><ContasReceber /></RoleProtectedRoute>} />
                  <Route path="/orcamentos" element={<OrcamentosV3 />} />
                  <Route path="/orcamentos/novo" element={<Navigate to="/orcamentos-v3/novo" replace />} />
                  <Route path="/orcamentos-v3/novo" element={<NewQuoteV3 />} />
                  <Route path="/orcamentos-v3/:id/editar" element={<NewQuoteV3 />} />

                  <Route path="/preco-impressao" element={<PrecoImpressao />} />
                  <Route path="/calculadora-etiquetas" element={<CalculadoraEtiquetas />} />
                  <Route path="/acabamentos" element={<Navigate to="/processos-producao?tab=acabamentos" replace />} />
                  <Route path="/equipamentos" element={<Equipamentos />} />
                  <Route path="/cadastros" element={<Cadastros />} />
                  <Route path="/insumos" element={<Insumos />} />
                  <Route path="/materias-primas" element={<Navigate to="/insumos" replace />} />
                  <Route path="/grupos-materiais" element={<Navigate to="/processos-producao?tab=grupos-materiais" replace />} />
                  <Route path="/kits-produto" element={<Navigate to="/processos-producao?tab=kits" replace />} />
                  <Route path="/cadastros-cv" element={<CadastrosCV />} />
                  <Route path="/processos-producao" element={<ProcessosProducao />} />
                  <Route path="/despesas-fixas" element={<DespesasFixas />} />
                   <Route path="/configuracoes" element={<RoleProtectedRoute requires="admin"><Configuracoes /></RoleProtectedRoute>} />
                  <Route path="/configuracoes/permissoes" element={<RoleProtectedRoute requires="admin"><Permissoes /></RoleProtectedRoute>} />
                  <Route path="/auditoria" element={<RoleProtectedRoute requires="admin"><Auditoria /></RoleProtectedRoute>} />
                  <Route path="/monitoramento" element={<RoleProtectedRoute requires="admin"><Monitoramento /></RoleProtectedRoute>} />
                  <Route path="/produtos" element={<Produtos />} />
                  <Route path="/presets-orcamento" element={<QuotePresets />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/usuarios" element={<RoleProtectedRoute requires="admin"><Usuarios /></RoleProtectedRoute>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              <AssistenteButton />
              <CommandPalette />
            </CommandPaletteProvider>
          </BrowserRouter>
          </CompanySettingsProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
