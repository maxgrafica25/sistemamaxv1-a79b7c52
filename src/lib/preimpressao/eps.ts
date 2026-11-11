// Leitura de arquivos EPS no navegador: o Ghostscript (compilado para WebAssembly)
// converte o EPS em PDF, mantendo vetor e cores, e o resto do sistema segue como
// se o cliente tivesse mandado PDF. Só é baixado (~16 MB, uma vez) quando alguém
// solta um EPS. Nada é enviado para a internet.
//
// Licença: o Ghostscript é AGPL-3.0 (ver CLAUDE.md).

/** Reconhece EPS: cabeçalho PostScript ou o binário "DOS EPS" (C5 D0 D3 C6). */
export function ehEps(bytes: Uint8Array): boolean {
  if (bytes.length >= 4 && bytes[0] === 0xc5 && bytes[1] === 0xd0 && bytes[2] === 0xd3 && bytes[3] === 0xc6) return true;
  const inicio = new TextDecoder("latin1").decode(bytes.subarray(0, 64));
  return inicio.startsWith("%!PS-Adobe") && /EPSF/i.test(new TextDecoder("latin1").decode(bytes.subarray(0, 512)));
}

/** DOS EPS: o PostScript fica no meio do arquivo, entre duas figuras de pré-visualização. */
export function extrairPostScript(bytes: Uint8Array): Uint8Array {
  if (bytes.length >= 12 && bytes[0] === 0xc5 && bytes[1] === 0xd0 && bytes[2] === 0xd3 && bytes[3] === 0xc6) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const inicio = dv.getUint32(4, true);
    const tamanho = dv.getUint32(8, true);
    if (inicio > 0 && tamanho > 0 && inicio + tamanho <= bytes.length) return bytes.subarray(inicio, inicio + tamanho);
  }
  return bytes;
}

interface Gs {
  FS: { writeFile(caminho: string, dados: Uint8Array): void; readFile(caminho: string): Uint8Array };
  callMain(args: string[]): number | void;
}
type IniciarGs = (opcoes: {
  locateFile?: (arquivo: string) => string;
  print?: (texto: string) => void;
  printErr?: (texto: string) => void;
  noInitialRun?: boolean;
}) => Promise<Gs>;

let iniciando: Promise<{ iniciar: IniciarGs; wasm: string }> | null = null;

/**
 * Carrega o Ghostscript na hora de usar. O wrapper do pacote não funciona com o
 * empacotador, então o gs.js (formato CommonJS) é executado direto com um "module" nosso.
 */
function carregar() {
  if (!iniciando) {
    iniciando = Promise.all([import("@jspawn/ghostscript-wasm/gs.js?raw"), import("@jspawn/ghostscript-wasm/gs.wasm?url")]).then(([codigo, wasm]) => {
      const modulo: { exports: unknown } = { exports: {} };
      new Function("exports", "module", codigo.default)(modulo.exports, modulo);
      return { iniciar: modulo.exports as IniciarGs, wasm: wasm.default };
    });
    iniciando.catch(() => {
      iniciando = null;
    });
  }
  return iniciando;
}

/** Converte um EPS em PDF (a página fica do tamanho do desenho: BoundingBox). */
export async function epsParaPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const { iniciar, wasm } = await carregar();
  const log: string[] = [];
  let gs: Gs;
  try {
    gs = await iniciar({ locateFile: () => wasm, noInitialRun: true, print: (t) => log.push(t), printErr: (t) => log.push(t) });
  } catch {
    throw new Error("Não consegui carregar o leitor de EPS. Exporte o arquivo como PDF no Corel ou no Illustrator e envie o PDF.");
  }
  gs.FS.writeFile("entrada.eps", extrairPostScript(bytes));
  try {
    gs.callMain([
      "-dBATCH",
      "-dNOPAUSE",
      "-dSAFER",
      "-dQUIET",
      "-sDEVICE=pdfwrite",
      "-dEPSCrop",
      "-dAutoRotatePages=/None",
      "-dCompatibilityLevel=1.6",
      "-sOutputFile=saida.pdf",
      "entrada.eps",
    ]);
  } catch {
    /* o Ghostscript encerra com exceção ao terminar; o resultado é lido abaixo */
  }
  let pdf: Uint8Array;
  try {
    pdf = gs.FS.readFile("saida.pdf");
  } catch {
    throw new Error("Não consegui ler este EPS. Exporte o arquivo como PDF no Corel ou no Illustrator e envie o PDF.");
  }
  if (pdf.length < 100) throw new Error("O EPS saiu vazio. Exporte o arquivo como PDF no Corel ou no Illustrator e envie o PDF.");
  return new Uint8Array(pdf);
}
