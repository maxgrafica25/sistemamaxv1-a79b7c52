// Ghostscript compilado para WebAssembly (sem tipos próprios): usamos o gs.js e o gs.wasm do pacote.
declare module "@jspawn/ghostscript-wasm/gs.js?raw" {
  const codigo: string;
  export default codigo;
}
declare module "@jspawn/ghostscript-wasm/gs.wasm?url" {
  const url: string;
  export default url;
}
