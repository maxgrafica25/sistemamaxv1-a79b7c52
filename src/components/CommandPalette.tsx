import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { useUrgentAlerts } from "@/hooks/useUrgentAlerts";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, ClipboardList, Users, Package, Cpu, Factory,
  Receipt, Calculator, TrendingUp, BookOpen, MessageSquare, Settings, Shield,
  FilePlus2, Wrench, Sparkles, Printer, Droplet, Flame,
} from "lucide-react";

interface Equipment { id: string; name: string }

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Orçamentos", path: "/orcamentos", icon: ClipboardList },
  { label: "Clientes/Fornecedores", path: "/cadastros", icon: Users },
  { label: "Matérias-Primas", path: "/materias-primas", icon: Package },
  { label: "Equipamentos", path: "/equipamentos", icon: Cpu },
  { label: "Processos de Produção", path: "/processos-producao", icon: Factory },
  { label: "Despesas Fixas", path: "/despesas-fixas", icon: Receipt },
  { label: "Preço Impressão", path: "/preco-impressao", icon: Calculator },
  { label: "Monitoramento", path: "/monitoramento", icon: TrendingUp },
  { label: "Catálogo Produtos", path: "/produtos", icon: BookOpen },
  { label: "Chat Interno", path: "/chat", icon: MessageSquare },
  { label: "Configurações", path: "/configuracoes", icon: Settings },
  { label: "Auditoria", path: "/auditoria", icon: Shield },
];

export default function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const navigate = useNavigate();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const { alerts: urgentAlerts } = useUrgentAlerts(open);

  // Carregar equipamentos quando abrir
  useEffect(() => {
    if (!open || equipments.length > 0) return;
    supabase
      .from("equipments")
      .select("id, name")
      .order("sort_order")
      .then(({ data }) => { if (data) setEquipments(data); });
  }, [open, equipments.length]);

  // Quando há urgência, força a primeira como item selecionado por padrão.
  // O cmdk usa o `value` do item — definimos um `defaultValue` no Command via key reset.
  const defaultValue = useMemo(() => {
    if (urgentAlerts.length > 0) return `urgent-${urgentAlerts[0].equipment_id}`;
    return undefined;
  }, [urgentAlerts]);

  const close = () => setOpen(false);

  const run = (action: () => void) => {
    close();
    // Pequeno delay pro modal fechar antes de navegar/abrir outro
    setTimeout(action, 50);
  };

  const goTo = (path: string) => run(() => navigate(path));

  const openJulia = () => run(() => {
    window.dispatchEvent(new CustomEvent("open-assistente"));
  });

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      // Força reset do defaultValue cada vez que abre/atualiza urgências
    >
      <CommandInput placeholder="Digite um comando ou busque..." autoFocus />
      <CommandList key={defaultValue ?? "no-urgent"}>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {/* 🔥 SUGESTÕES DE URGÊNCIA */}
        {urgentAlerts.length > 0 && (
          <>
            <CommandGroup heading="🔥 Sugestões de Urgência">
              {urgentAlerts.map((a) => (
                <CommandItem
                  key={`urgent-${a.equipment_id}`}
                  value={`urgent-${a.equipment_id}`}
                  onSelect={() =>
                    goTo(`/equipamentos?action=quick-reading&equipment=${a.equipment_id}`)
                  }
                  className="data-[selected=true]:bg-destructive/10 data-[selected=true]:text-destructive"
                >
                  <Flame className="text-destructive" />
                  <span className="font-medium">Lançar Leitura — {a.equipment_name}</span>
                  <span className="ml-auto rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                    {a.days_overdue} {a.days_overdue === 1 ? "dia" : "dias"} atrasada
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* AÇÕES RÁPIDAS */}
        <CommandGroup heading="Ações Rápidas">
          <CommandItem value="acao-novo-orcamento" onSelect={() => goTo("/orcamentos/novo")}>
            <FilePlus2 /> Novo Orçamento
          </CommandItem>
          <CommandItem value="acao-nova-manutencao" onSelect={() => goTo("/equipamentos?tab=maintenance&action=new")}>
            <Wrench /> Nova Manutenção
          </CommandItem>
          <CommandItem value="acao-falar-julia" onSelect={openJulia}>
            <Sparkles /> Falar com a Júlia
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* NAVEGAÇÃO */}
        <CommandGroup heading="Navegação">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={`nav-${item.path}`}
              value={`nav-${item.label}`}
              onSelect={() => goTo(item.path)}
            >
              <item.icon /> Ir para {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* EQUIPAMENTOS */}
        {equipments.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Equipamentos">
              {equipments.map((eq) => (
                <CommandItem
                  key={`reading-${eq.id}`}
                  value={`leitura-${eq.name}`}
                  onSelect={() => goTo(`/equipamentos?action=quick-reading&equipment=${eq.id}`)}
                >
                  <Printer /> Leitura — {eq.name}
                </CommandItem>
              ))}
              {equipments.map((eq) => (
                <CommandItem
                  key={`toner-${eq.id}`}
                  value={`toner-${eq.name}`}
                  onSelect={() => goTo(`/equipamentos?action=toner-change&equipment=${eq.id}`)}
                >
                  <Droplet /> Toner — {eq.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
