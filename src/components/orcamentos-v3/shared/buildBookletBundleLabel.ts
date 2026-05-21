// Gera uma descrição única e consolidada para o bundle "Apostila + Kit".
import type { V3BookletItem, V3Item } from "../types";

function shortKitDescr(descricao: string): string {
  // "ESPIRAL INCOLOR 12 mm 70 FLS" → "espiral 12mm"
  const sp = descricao.match(/espiral.*?(\d+)\s*mm/i);
  if (sp) return `espiral ${sp[1]}mm`;
  // "Wire-o 3/4"
  const wo = descricao.match(/wire[- ]?o.*?([\d/]+["”]?)/i);
  if (wo) return `wire-o ${wo[1]}`;
  // Remove parênteses explicativos e troca "— preencher"
  return descricao
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/—\s*preencher/i, "")
    .trim()
    .toLowerCase();
}

export interface BuildBookletBundleArgs {
  miolo: V3BookletItem;
  kitItems: V3Item[];
  spiralDiameter?: string | null;
  coverMode: "standard" | "custom";
  backCoverMode: "standard" | "custom";
  customCoverDescr?: string | null;
  customBackCoverDescr?: string | null;
}

export function buildBookletBundleLabel(args: BuildBookletBundleArgs): string {
  const {
    miolo,
    kitItems,
    coverMode,
    backCoverMode,
    customCoverDescr,
    customBackCoverDescr,
  } = args;

  // Cabeça: Apostila Nx — miolo Pfl Papel Gramatura F/V
  const paperBits = [miolo.paper_type, miolo.grammage].filter(Boolean).join(" ");
  const sideBit = miolo.bookletDuplex || miolo.side === "F/V" ? "F/V" : "";
  const head = `Apostila ${miolo.bookletUnits}× — miolo ${miolo.bookletPages}fl${
    paperBits ? ` ${paperBits}` : ""
  }${sideBit ? ` ${sideBit}` : ""}`;

  const parts: string[] = [head];

  // Capas (somente se presentes na lista de kitItems — desmarcadas não aparecem)
  const hasCover = kitItems.some(
    (i) =>
      (i.kind === "supply" && /capa/i.test(i.descricao) && !/contracapa/i.test(i.descricao)) ||
      (i.kind === "print" && coverMode === "custom"),
  );
  const hasBack = kitItems.some(
    (i) =>
      (i.kind === "supply" && /contracapa/i.test(i.descricao)) ||
      (i.kind === "print" && backCoverMode === "custom" && i.descricao === customBackCoverDescr),
  );

  if (coverMode === "custom" && customCoverDescr) parts.push(`capa personalizada (${customCoverDescr})`);
  else if (hasCover) parts.push("capa padrão");

  if (backCoverMode === "custom" && customBackCoverDescr) parts.push(`contracapa personalizada (${customBackCoverDescr})`);
  else if (hasBack) parts.push("contracapa padrão");

  // Demais itens do kit (espiral, furação, encadernação, extras), ignorando capas já tratadas
  const isCoverItem = (descricao: string) => /capa/i.test(descricao);
  const others = kitItems.filter((i) => {
    if (i.kind === "print") return false; // capas custom já tratadas
    if (i.kind === "supply" && isCoverItem(i.descricao)) return false;
    return true;
  });

  const seen = new Set<string>();
  for (const it of others) {
    const short = shortKitDescr((it as { descricao: string }).descricao);
    if (!short || seen.has(short)) continue;
    seen.add(short);
    parts.push(short);
  }

  return parts.join(" · ");
}
