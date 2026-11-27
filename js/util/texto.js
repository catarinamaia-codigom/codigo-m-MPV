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

/**
 * Texto com formatação simples -> HTML seguro: **negrito**, *itálico*,
 * ~~riscado~~, links clicáveis e emojis (que já são texto). A planilha guarda
 * o texto com os sinais, legível mesmo sem o site.
 */
export function formatar(texto) {
  return linkificar(texto)
    .split(/(<[^>]+>)/)
    .map((parte, i, partes) => {
      if (parte.startsWith('<')) return parte;
      if (partes[i - 1]?.startsWith('<a ')) return parte; // texto do link fica como está
      return parte
        .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<b>$1</b>')
        .replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?![*\w])/g, '$1<i>$2</i>')
        .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>');
    })
    .join('');
}

/** Tira os sinais de formatação (para prévias de uma linha). */
export const semFormatacao = (texto) => String(texto ?? '').replace(/\*\*|~~/g, '').replace(/(^|\s)\*(\S[^*]*\S|\S)\*/g, '$1$2');

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
