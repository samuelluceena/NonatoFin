/**
 * Copia texto para a área de transferência.
 * 1) Clipboard API (Chrome desktop/Android, Safari iOS 13.4+ em HTTPS);
 * 2) fallback com <textarea> + execCommand('copy') (navegadores antigos/HTTP).
 * Retorna false se nenhum método funcionar (a UI então mostra o código para
 * cópia manual).
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // segue para o fallback
  }
  return copiarComTextarea(texto);
}

function copiarComTextarea(texto: string): boolean {
  if (typeof document === 'undefined') return false;
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  // 16px evita zoom no iOS; fora da tela para não "piscar".
  Object.assign(area.style, { position: 'fixed', top: '0', left: '-9999px', opacity: '0', fontSize: '16px' });
  document.body.appendChild(area);
  try {
    // iOS exige seleção por Range.
    const range = document.createRange();
    range.selectNodeContents(area);
    const selecao = window.getSelection();
    selecao?.removeAllRanges();
    selecao?.addRange(range);
    area.setSelectionRange(0, texto.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
