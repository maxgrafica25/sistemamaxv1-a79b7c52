// Presets de produtos para o modo "Produto" da aba Impressão + Acabamentos.
// Os presets dizem como pré-filtrar/pré-preencher o formulário interno
// (PrintForm, BookletForm ou LabelEmbeddedForm).

import {
  BookOpen,
  CreditCard,
  FileText,
  Flag,
  Sticker,
  Tag,
  Wand2,
} from "lucide-react";

export type ProductPresetId =
  | "folheto"
  | "cartao"
  | "apostila"
  | "banner"
  | "etiqueta"
  | "adesivo";

export interface ProductPreset {
  id: ProductPresetId;
  label: string;
  icon: typeof BookOpen;
  /** Sub-formulário a renderizar. "print" usa PrintForm com hints abaixo. */
  form: "print" | "booklet" | "label";
  /** Filtros / hints opcionais aplicados a sub-formulários do tipo print. */
  hints?: {
    paperTypeIncludes?: string[];   // ex: ["lona", "vinil"]
    paperTypeExcludes?: string[];
    defaultQty?: number;
    suggestedFinishings?: string[]; // ids/labels de acabamentos
  };
}

export const PRODUCT_PRESETS: ProductPreset[] = [
  {
    id: "folheto",
    label: "Folheto / Flyer",
    icon: FileText,
    form: "print",
    hints: {
      defaultQty: 1000,
      paperTypeIncludes: ["couchê", "couche", "offset"],
    },
  },
  {
    id: "cartao",
    label: "Cartão de Visita",
    icon: CreditCard,
    form: "print",
    hints: {
      defaultQty: 1000,
      paperTypeIncludes: ["couchê 250", "couche 250", "supremo", "triplex"],
      suggestedFinishings: ["laminacao", "verniz"],
    },
  },
  {
    id: "apostila",
    label: "Apostila",
    icon: BookOpen,
    form: "booklet",
  },
  {
    id: "banner",
    label: "Banner / Lona",
    icon: Flag,
    form: "print",
    hints: {
      defaultQty: 1,
      paperTypeIncludes: ["lona", "vinil", "banner"],
    },
  },
  {
    id: "etiqueta",
    label: "Etiqueta",
    icon: Tag,
    form: "label",
  },
  {
    id: "adesivo",
    label: "Adesivo",
    icon: Sticker,
    form: "print",
    hints: {
      defaultQty: 100,
      paperTypeIncludes: ["adesivo", "vinil"],
    },
  },
];

export const PRESET_BY_ID = Object.fromEntries(
  PRODUCT_PRESETS.map((p) => [p.id, p]),
) as Record<ProductPresetId, ProductPreset>;

export const PRODUCT_MODE_ICON = Wand2;
