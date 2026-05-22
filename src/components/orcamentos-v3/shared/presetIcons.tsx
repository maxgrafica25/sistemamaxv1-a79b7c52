// Mapa controlado de ícones Lucide permitidos nos presets.
import {
  BookOpen,
  CreditCard,
  FileText,
  Flag,
  Megaphone,
  Package,
  Sticker,
  Tag,
  Image as ImageIcon,
  Shirt,
  Award,
  Wand2,
  Scissors,
  Layers,
  type LucideIcon,
} from "lucide-react";

export const PRESET_ICONS: Record<string, LucideIcon> = {
  Wand2,
  Megaphone,
  Flag,
  FileText,
  CreditCard,
  BookOpen,
  Tag,
  Sticker,
  Package,
  Image: ImageIcon,
  Shirt,
  Award,
  Scissors,
  Layers,
};

export const PRESET_ICON_NAMES = Object.keys(PRESET_ICONS);

export function iconFor(name: string | null | undefined): LucideIcon {
  if (!name) return Wand2;
  return PRESET_ICONS[name] ?? Wand2;
}
