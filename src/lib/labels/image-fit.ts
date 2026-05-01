// =============================================================================
// fitContain — calcula enquadramento "object-fit: contain" centralizado
// =============================================================================
// Lógica pura, sem dependências. Dado o tamanho natural da imagem e a caixa
// (etiqueta), retorna a largura/altura escalada para caber inteira sem
// distorcer + os offsets para centralizar dentro da caixa.
//
// Mesma semântica do PowerClip "Ajustar proporcionalmente" do CorelDRAW.
// =============================================================================

export interface FitResult {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function fitContain(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): FitResult {
  if (imgW <= 0 || imgH <= 0 || boxW <= 0 || boxH <= 0) {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const width = imgW * scale;
  const height = imgH * scale;
  return {
    width,
    height,
    offsetX: (boxW - width) / 2,
    offsetY: (boxH - height) / 2,
  };
}

/** Razão de aspecto (W/H). Retorna 0 se H<=0. */
export const aspectRatio = (w: number, h: number): number =>
  h > 0 ? w / h : 0;

/**
 * Verifica se duas razões divergem mais que `tolerance` (default 5%).
 * Útil para alertar o usuário que a arte vai gerar sobras visíveis.
 */
export function aspectMismatch(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
  tolerance = 0.05,
): boolean {
  const a = aspectRatio(imgW, imgH);
  const b = aspectRatio(boxW, boxH);
  if (a === 0 || b === 0) return false;
  return Math.abs(a - b) / b > tolerance;
}
