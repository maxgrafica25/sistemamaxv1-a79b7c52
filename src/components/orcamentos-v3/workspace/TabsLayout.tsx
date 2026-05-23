import {
  Printer,
  Megaphone,
  Handshake,
  type LucideIcon,
} from "lucide-react";
import { DotTabs } from "@/components/ui/dot-tabs";
import type { V3Category } from "../types";

export interface TabDef {
  id: V3Category;
  label: string;
  icon: LucideIcon;
  shortcut: string;
  description: string;
}

export const TABS: TabDef[] = [
  {
    id: "print",
    label: "Impressão + Acabamentos",
    icon: Printer,
    shortcut: "Alt+1",
    description: "Itens impressos no parque próprio (folhetos, apostilas, etiquetas).",
  },
  {
    id: "cv",
    label: "Com. Visual",
    icon: Megaphone,
    shortcut: "Alt+2",
    description: "Mídia em grande formato, lonas, adesivos e aplicação.",
  },
  {
    id: "third",
    label: "Terceirizados",
    icon: Handshake,
    shortcut: "Alt+3",
    description: "Serviços e produtos executados por fornecedores externos.",
  },
];

export function getTab(id: V3Category): TabDef {
  return TABS.find((t) => t.id === id) ?? TABS[0];
}

interface Props {
  active: V3Category;
  onChange: (id: V3Category) => void;
}

export function TabsLayout({ active, onChange }: Props) {
  return (
    <DotTabs
      tabs={TABS.map((t) => ({ key: t.id, label: t.label }))}
      value={active}
      onChange={(k) => onChange(k as V3Category)}
    />
  );
}

