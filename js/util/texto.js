// Utilidades de texto.

/** Escapa texto para inserir com segurança em HTML. */
export function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "Bioquímica" -> "Bioquimica" */
export function semAcentos(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Lista separada por vírgula ou ponto e vírgula -> array sem vazios. */
export function lista(valor) {
  if (Array.isArray(valor)) return valor;
  return String(valor ?? '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Padrão de nome de arquivo do Código M:
 * "1M - Tipo - Cadeira - Assunto - dd-mm-aaaa - Catarina.ext" (sem acentos).
 */
export function nomeArquivo({ periodo, tipo, cadeira, assunto, data, aluna, ext = 'pdf' }) {
  const limpar = (s) =>
    semAcentos(s)
      .replace(/[\\/:*?"<>|]/g, ' ') // caracteres proibidos em nomes de arquivo
      .replace(/\s+-\s+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const [a, m, d] = String(data).split('-');
  const partes = [periodo, tipo, cadeira, assunto, `${d}-${m}-${a}`, aluna].map(limpar);
  return `${partes.join(' - ')}.${limpar(ext).replace(/^\./, '')}`;
}
