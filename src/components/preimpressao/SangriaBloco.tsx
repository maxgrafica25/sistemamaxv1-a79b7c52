// Bloco "A arte já tem sangria?": já tem, ou o sistema cria (espelhar, esticar ou cor).
// Usado pela Montagem e pela Numeração. A margem de segurança e a arte com as linhas de corte
// ficam na pré-visualização, à direita (PreviaArte.tsx).

import { Loader2 } from "lucide-react";
import { baixarBlob } from "@/lib/preimpressao/navegador";
import type { ModoSangria } from "@/lib/preimpressao/sangria";
import { MAX_PAGINAS_SANGRIA, type SangriaAuto } from "./sangriaAuto";
import { Campo, Passo, Segmentado, SeletorCor } from "./ui";

const CORES = [
  { nome: "Branco", hex: "#ffffff" },
  { nome: "Preto", hex: "#000000" },
];

const AJUDA_MODO: Record<ModoSangria, string> = {
  espelhar: "A borda da arte é refletida para fora, como num espelho. Bom para fundos lisos, degradês, texturas e fotos.",
  esticar: "O último pixel da borda é repetido para fora. Bom para fundo de uma cor só ou com listras na vertical e na horizontal.",
  cor: "A faixa de sangria sai de uma cor só. Use quando a borda da arte tem a cor do fundo.",
};

export function SangriaBloco({
  sa,
  sangriaTxt,
  onSangria,
  sangriaPdf,
  nomeBase,
}: {
  sa: SangriaAuto;
  sangriaTxt: string;
  onSangria: (v: string) => void;
  /** Sangria já gravada no PDF (TrimBox), se houver. */
  sangriaPdf: number | null;
  nomeBase: string;
}) {
  return (
    <Campo titulo="A arte já tem sangria?">
      <Segmentado
        valor={sa.criar ? "criar" : "sim"}
        opcoes={[
          { valor: "sim", rotulo: "Já tem" },
          { valor: "criar", rotulo: "Criar automaticamente" },
        ]}
        onChange={(v) => sa.setCriar(v === "criar")}
      />
      {!sa.criar ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {sangriaPdf != null
            ? `Sangria de ${sangriaPdf.toLocaleString("pt-BR")} mm lida do PDF.`
            : "A arte chega com a sangria feita. Se não tiver, escolha \"Criar automaticamente\"."}
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {sangriaPdf != null && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Este PDF já tem {sangriaPdf.toLocaleString("pt-BR")} mm de sangria gravada. Criar outra vai somar à que já existe.
            </p>
          )}
          {sa.grande && <p className="text-xs text-destructive">Para criar a sangria o máximo é {MAX_PAGINAS_SANGRIA} páginas por vez.</p>}

          <Campo titulo="Tamanho da sangria" ajuda="Quanto a arte cresce em cada lado. O padrão da gráfica é 1,5 mm.">
            <Passo valor={sangriaTxt} onChange={onSangria} passo={0.5} min={0.5} max={10} sufixo="mm" rotulo="sangria" invalido={!sa.valida} />
          </Campo>

          <Campo titulo="Como preencher" ajuda={AJUDA_MODO[sa.cfg.modo]}>
            <Segmentado
              valor={sa.cfg.modo}
              opcoes={[
                { valor: "espelhar" as ModoSangria, rotulo: "Espelhar" },
                { valor: "esticar" as ModoSangria, rotulo: "Esticar" },
                { valor: "cor" as ModoSangria, rotulo: "Cor" },
              ]}
              onChange={(v) => sa.set("modo", v)}
            />
            {sa.cfg.modo === "cor" && (
              <div className="mt-3">
                <SeletorCor valor={sa.cfg.cor} sugestoes={CORES} onChange={(hex) => sa.set("cor", hex)} />
              </div>
            )}
          </Campo>

          {sa.erro && <p className="text-xs text-destructive">{sa.erro}</p>}

          {sa.bytes && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => sa.bytes && baixarBlob(new Blob([sa.bytes], { type: "application/pdf" }), `${nomeBase}_com-sangria.pdf`)}
            >
              Baixar só a arte com sangria
            </button>
          )}
          {sa.gerando && !sa.bytes && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Criando a sangria…
            </p>
          )}
        </div>
      )}
    </Campo>
  );
}
