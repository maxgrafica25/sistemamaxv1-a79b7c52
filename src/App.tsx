import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanySettingsProvider } from "@/hooks/useCompanySettings";
import ProtectedRoute from "@/components/ProtectedRoute";
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
import GruposMateriais from "./pages/GruposMateriais";
import CadastrosCV from "./pages/CadastrosCV";
import OrcamentosV2 from "./pages/orcamentos-v2/OrcamentosV2";
import Usuarios from "./pages/Usuarios";
import NewQuoteV2 from "./pages/orcamentos-v2/NewQuoteV2";
import EditQuoteV2 from "./pages/orcamentos-v2/EditQuoteV2";
import ClientViewer from "./pages/orcamentos-v2/ClientViewer";
import Pedidos from "./pages/Pedidos";
import ContasReceber from "./pages/ContasReceber";
import CalculadoraEtiquetas from "./pages/CalculadoraEtiquetas";
import Acabamentos from "./pages/Acabamentos";
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
                <Route path="/view-quote/:id" element={<ClientViewer />} />
                <Route path="/p/:quoteNumber" element={<ClientViewer />} />
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/pedidos" element={<Pedidos />} />
                  <Route path="/financeiro/receber" element={<ContasReceber />} />
                  <Route path="/orcamentos" element={<Navigate to="/orcamentos-v2" replace />} />
                  <Route path="/orcamentos/novo" element={<Navigate to="/orcamentos-v2/novo" replace />} />
                  <Route path="/orcamentos-v2" element={<OrcamentosV2 />} />
                  <Route path="/orcamentos-v2/novo" element={<NewQuoteV2 />} />
                  <Route path="/orcamentos-v2/:id" element={<EditQuoteV2 />} />
                  <Route path="/preco-impressao" element={<PrecoImpressao />} />
                  <Route path="/calculadora-etiquetas" element={<CalculadoraEtiquetas />} />
                  <Route path="/acabamentos" element={<Acabamentos />} />
                  <Route path="/equipamentos" element={<Equipamentos />} />
                  <Route path="/cadastros" element={<Cadastros />} />
                  <Route path="/materias-primas" element={<MateriasPrimas />} />
                  <Route path="/grupos-materiais" element={<GruposMateriais />} />
                  <Route path="/cadastros-cv" element={<CadastrosCV />} />
                  <Route path="/processos-producao" element={<ProcessosProducao />} />
                  <Route path="/despesas-fixas" element={<DespesasFixas />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                  <Route path="/auditoria" element={<Auditoria />} />
                  <Route path="/monitoramento" element={<Monitoramento />} />
                  <Route path="/produtos" element={<Produtos />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/usuarios" element={<Usuarios />} />
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
