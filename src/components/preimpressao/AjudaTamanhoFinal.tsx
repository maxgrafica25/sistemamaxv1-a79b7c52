// "Esse não é o tamanho que eu queria": a pessoa digita o tamanho final desejado e o sistema
// diz qual sangria usar (ou que arte enviar) para o corte sair nessa medida.
// Serve para ferramentas que recebem arte com sangria (Montagem, Numeração).

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SANGRIA_PADRAO_MM, arteParaTamanho, formatarCm, orientarTamanhoFinal, PT_POR_MM } from "@/lib/preimpressao/folha";
import { Mini } from "./ui";
import { numeroEntre } from "./uteis";

const mm = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const cmTxt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function AjudaTamanhoFinal({
  arte,
  sangriaMm,
  onUsarSangria,
}: {
  /** Tamanho da arte em pontos, COM a sangria. */
  arte: { w: number; h: number };
  /** Sangria em uso (mm); null se o campo está inválido. */
  sangriaMm: number | null;
  onUsarSangria: (mm: number) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");
  const w = numeroEntre(largura, 0.5, 500);
  const h = numeroEntre(altura, 0.5, 500);
  const o = w !== null && h !== null && sangriaMm !== null ? orientarTamanhoFinal(arte, w, h, sangriaMm) : null;
  const artePt = { w: arte.w / PT_POR_MM / 10, h: arte.h / PT_POR_MM / 10 };
  const caixa = "rounded-2xl px-4 py-3 text-sm";

  return (
    <div className="rounded-2xl bg-muted/50">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="min-w-0">
          <span className="font-medium">O tamanho final não é o que eu queria</span>
          <span className="block text-xs text-muted-foreground">Digite a medida que você quer e o sistema diz o que ajustar.</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} />
      </button>
      {aberto && (
        <div className="space-y-4 px-4 pb-4">
          <div className="grid grid-cols-2 gap-x-3">
            <Mini rotulo="Largura final que você quer (cm)" valor={largura} onChange={setLargura} ajuda="Já cortado, sem a sangria" erro={largura && w === null ? "Número em cm" : undefined} />
            <Mini rotulo="Altura final que você quer (cm)" valor={altura} onChange={setAltura} erro={altura && h === null ? "Número em cm" : undefined} />
          </div>
          <p className="text-xs text-muted-foreground">
            Sua arte tem {formatarCm(arte.w, arte.h)}. Tamanho final = tamanho da arte − 2 × a sangria.
          </p>

          {o?.tipo === "ok" && (
            <p className={cn(caixa, "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300")}>
              Está certo: com a sangria de {mm(sangriaMm!)} mm, o corte sai em {cmTxt(w!)} × {cmTxt(h!)} cm.
            </p>
          )}
          {o?.tipo === "usar" && (
            <div className={cn(caixa, "space-y-2 bg-amber-500/10 text-amber-900 dark:text-amber-200")}>
              <p>
                Para o corte sair em {cmTxt(w!)} × {cmTxt(h!)} cm, a sua arte precisa ter <span className="font-semibold">{mm(o.sangriaMm)} mm de sangria</span> por lado. Hoje o campo está em {mm(sangriaMm!)} mm.
              </p>
              <Button size="sm" className="rounded-full" onClick={() => onUsarSangria(o.sangriaMm)}>
                Usar sangria de {mm(o.sangriaMm)} mm
              </Button>
            </div>
          )}
          {o?.tipo === "incoerente" && w !== null && h !== null && (
            <div className={cn(caixa, "space-y-2 bg-amber-500/10 text-amber-900 dark:text-amber-200")}>
              <p>
                Essa medida não fecha com a sua arte ({cmTxt(artePt.w)} × {cmTxt(artePt.h)} cm): a sangria teria de ser {mm(o.sangriaLarguraMm)} mm na largura e {mm(o.sangriaAlturaMm)} mm na altura, e ela precisa ser igual nos 4 lados.
              </p>
              <p>Para cortar em {cmTxt(w)} × {cmTxt(h)} cm, a arte deve ter:</p>
              <ul className="list-disc pl-5">
                {[SANGRIA_PADRAO_MM, 3].filter((s, i, a) => a.indexOf(s) === i).map((s) => {
                  const a = arteParaTamanho(w, h, s);
                  return (
                    <li key={s}>
                      {cmTxt(a.w)} × {cmTxt(a.h)} cm, com {mm(s)} mm de sangria
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {o?.tipo === "menor" && (
            <p className={cn(caixa, "bg-destructive/10 text-destructive")}>
              A sua arte é menor que {cmTxt(w!)} × {cmTxt(h!)} cm. Peça ao cliente uma arte maior ou confira a medida digitada.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
