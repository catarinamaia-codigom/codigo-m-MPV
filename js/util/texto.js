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

/**
 * Texto -> HTML seguro com os endereços (https://…, www.…) virando links
 * clicáveis que abrem em outra aba. Quebras de linha são mantidas pelo CSS.
 */
export function linkificar(texto) {
  return esc(texto).replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/g, (url) => {
    const limpo = url.replace(/[.,;:!?)]+$/, '');
    const resto = url.slice(limpo.length);
    const href = limpo.startsWith('www.') ? `https://${limpo}` : limpo;
    const curto = limpo.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48) + (limpo.length > 60 ? '…' : '');
    return `<a href="${href}" target="_blank" rel="noopener">${curto}</a>${resto}`;
  });
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
 * Padrão de nome de arquivo do Código M (regra dos colchetes, DC-26-004):
 * "[1M] [Tipo] [Cadeira] [Assunto] [dd-mm-aaaa] [Catarina].ext", sem acentos.
 * Cada colchete é uma pista de onde o arquivo deve ficar.
 */
export function nomeArquivo({ periodo, tipo, cadeira, assunto, data, aluna, ext = 'pdf' }) {
  const limpar = (s) =>
    semAcentos(s)
      .replace(/[\\/:*?"<>|\[\]]/g, ' ') // proibidos em nomes de arquivo e os próprios colchetes
      .replace(/\s+/g, ' ')
      .trim();
  const [a, m, d] = String(data).split('-');
  const partes = [periodo, tipo, cadeira, assunto, `${d}-${m}-${a}`, aluna].map(limpar).filter(Boolean);
  return `${partes.map((p) => `[${p}]`).join(' ')}.${limpar(ext).replace(/^\./, '')}`;
}
