import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Chat from "./pages/Chat";
import AssistenteButton from "@/components/assistente/AssistenteButton";

import Cadastros from "./pages/Cadastros";
import NewQuote from "./pages/NewQuote";
import MateriasPrimas from "./pages/MateriasPrimas";
import ProcessosProducao from "./pages/ProcessosProducao";
import Configuracoes from "./pages/Configuracoes";
import DespesasFixas from "./pages/DespesasFixas";
import Orcamentos from "./pages/Orcamentos";
import PrecoImpressao from "./pages/PrecoImpressao";
import Equipamentos from "./pages/Equipamentos";
import Auditoria from "./pages/Auditoria";
import Monitoramento from "./pages/Monitoramento";
import Produtos from "./pages/Produtos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orcamentos" element={<Orcamentos />} />
              <Route path="/orcamentos/novo" element={<NewQuote />} />
              <Route path="/preco-impressao" element={<PrecoImpressao />} />
              <Route path="/equipamentos" element={<Equipamentos />} />
              <Route path="/cadastros" element={<Cadastros />} />
              <Route path="/materias-primas" element={<MateriasPrimas />} />
              <Route path="/processos-producao" element={<ProcessosProducao />} />
              <Route path="/despesas-fixas" element={<DespesasFixas />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/auditoria" element={<Auditoria />} />
              <Route path="/monitoramento" element={<Monitoramento />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/chat" element={<Chat />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AssistenteButton />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
