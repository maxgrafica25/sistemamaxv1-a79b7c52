// Modelos salvos por cliente: logo, contato, feriados e ajustes ficam guardados neste computador
// e também podem ser levados em arquivo para outro computador.

import { useRef, useState } from "react";
import { Download, Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { baixarBlob } from "@/lib/preimpressao/navegador";
import { Campo, Mini } from "./ui";
import { aplicarModelo, gravarModelos, lerModelos, modeloDeArquivo, paraModelo, type ConfigAgendaUI, type ModeloAgenda } from "./agendaConfig";

export function AgendaModelos({ config, onAplicar }: { config: ConfigAgendaUI; onAplicar: (c: ConfigAgendaUI) => void }) {
  const [modelos, setModelos] = useState<Record<string, ModeloAgenda>>(() => lerModelos());
  const [nome, setNome] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const nomes = Object.keys(modelos).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const limpo = nome.trim();

  const salvar = () => {
    if (!limpo) return;
    const novo = { ...modelos, [limpo]: paraModelo(config) };
    if (!gravarModelos(novo)) {
      setAviso("Não coube no navegador. Tente com uma logo menor ou apague um modelo.");
      return;
    }
    setModelos(novo);
    setNome("");
    setAviso(`Modelo "${limpo}" salvo.`);
  };

  const apagar = (n: string) => {
    const { [n]: _tirado, ...resto } = modelos;
    void _tirado;
    gravarModelos(resto);
    setModelos(resto);
    setAviso(null);
  };

  const importar = async (f: File | undefined) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text()) as { nome?: string; modelo?: unknown };
      const m = modeloDeArquivo(j.modelo ?? j);
      if (!m) throw new Error("vazio");
      onAplicar(aplicarModelo(config, m));
      setAviso("Modelo aberto. Salve com um nome para guardar.");
    } catch {
      setAviso("Esse arquivo não é um modelo de agenda.");
    }
  };

  return (
    <Campo titulo="Modelos do cliente" ajuda="Guarde logo, contato, feriados e ajustes. No ano seguinte é só abrir e mudar o ano.">
      {nomes.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {nomes.map((n) => (
            <span key={n} className="flex items-center rounded-full bg-muted/70 text-xs font-medium">
              <button type="button" className="rounded-l-full py-1.5 pl-3 pr-2 hover:text-foreground" onClick={() => onAplicar(aplicarModelo(config, modelos[n]))}>
                {n}
              </button>
              <button type="button" aria-label={`Excluir o modelo ${n}`} className="rounded-r-full py-1.5 pl-1 pr-2 text-muted-foreground hover:text-destructive" onClick={() => apagar(n)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto] items-end gap-x-3">
        <Mini rotulo="Nome do modelo" valor={nome} onChange={(v) => setNome(v.slice(0, 40))} texto ajuda="Ex.: Padaria do João" />
        <Button size="sm" variant="secondary" className="mb-5 rounded-full" disabled={!limpo} onClick={salvar}>
          <Save className="h-4 w-4" /> Salvar
        </Button>
      </div>
      <div className="flex flex-wrap gap-4 text-xs font-medium text-primary">
        <button
          type="button"
          className="flex items-center gap-1 hover:underline"
          onClick={() => baixarBlob(new Blob([JSON.stringify({ tipo: "modelo-agenda", modelo: paraModelo(config) })], { type: "application/json" }), `modelo-agenda-${(limpo || "cliente").replace(/[^\w-]+/g, "_")}.json`)}
        >
          <Download className="h-3.5 w-3.5" /> Baixar este modelo em arquivo
        </button>
        <button type="button" className="flex items-center gap-1 hover:underline" onClick={() => arquivoRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Abrir modelo de arquivo
        </button>
        <input
          ref={arquivoRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            void importar(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {aviso && <p className="mt-2 text-xs text-muted-foreground">{aviso}</p>}
    </Campo>
  );
}
