import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { useUrgentAlerts } from "@/hooks/useUrgentAlerts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
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
  const { alerts: urgentAlerts, loading: urgentLoading } = useUrgentAlerts(open);

  useEffect(() => {
    if (!open || equipments.length > 0) return;
    supabase
      .from("equipments")
      .select("id, name")
      .order("sort_order")
      .then(({ data }) => { if (data) setEquipments(data); });
  }, [open, equipments.length]);

  // Quando há urgência, força a primeira como item selecionado por padrão.
  const defaultValue = useMemo(() => {
    if (urgentAlerts.length > 0) return `urgent-${urgentAlerts[0].equipment_id}`;
    return undefined;
  }, [urgentAlerts]);

  // Mensagem para leitor de tela quando há urgência ao abrir
  const announcement = useMemo(() => {
    if (urgentAlerts.length === 0) return "";
    const first = urgentAlerts[0];
    const extras = urgentAlerts.length > 1 ? ` e mais ${urgentAlerts.length - 1}` : "";
    return `Alerta crítico encontrado: Lançar leitura para ${first.equipment_name}, ${first.days_overdue} ${first.days_overdue === 1 ? "dia" : "dias"} atrasada${extras}. Pressione Enter para resolver.`;
  }, [urgentAlerts]);

  const close = () => setOpen(false);
  const run = (action: () => void) => { close(); setTimeout(action, 50); };
  const goTo = (path: string) => run(() => navigate(path));
  const openJulia = () => run(() => window.dispatchEvent(new CustomEvent("open-assistente")));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "duration-200",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            // Posição: topo, ~20% de margem
            "fixed left-1/2 top-[18vh] -translate-x-1/2 z-[9999]",
            "w-[92vw] max-w-[640px]",
            // Glassmorphism
            "rounded-xl border border-border/50 shadow-2xl",
            "bg-popover/85 backdrop-blur-xl supports-[backdrop-filter]:bg-popover/70",
            // Animação
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "data-[state=open]:slide-in-from-top-4 data-[state=closed]:slide-out-to-top-4",
            "duration-200",
            "overflow-hidden",
          )}
          aria-label="Paleta de Comandos"
        >
          <DialogPrimitive.Title className="sr-only">Paleta de Comandos</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Use as setas para navegar e Enter para executar.
          </DialogPrimitive.Description>

          <Command
            // remount sempre que mudam as urgências, garantindo que defaultValue surta efeito
            key={defaultValue ?? "no-urgent"}
            defaultValue={defaultValue}
            className="bg-transparent"
          >
            <CommandInput placeholder="Digite um comando ou busque..." autoFocus />
            <CommandList className="max-h-[60vh]">
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
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
