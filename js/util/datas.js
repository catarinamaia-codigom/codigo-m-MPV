// Datas sempre como texto "AAAA-MM-DD" (sem fuso horário), para não haver
// confusão entre o horário do navegador e o da planilha.

const pad = (n) => String(n).padStart(2, '0');

export const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Date -> "AAAA-MM-DD" */
export function paraISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "AAAA-MM-DD" -> Date (meio-dia local, evita problemas de horário de verão) */
export function deISO(s) {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}

/**
 * Aceita "AAAA-MM-DD", "dd/mm/aaaa" (formato comum no Google Planilhas) ou Date.
 * Retorna "AAAA-MM-DD" ou "" se não reconhecer.
 */
export function normalizarData(valor) {
  if (!valor) return '';
  if (valor instanceof Date) return paraISO(valor);
  const s = String(valor).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return '';
}

/** Aceita "7:30", "07:30", "07:30:00" -> "07:30" */
export function normalizarHora(valor) {
  if (!valor) return '';
  const m = String(valor).trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? `${pad(+m[1])}:${m[2]}` : '';
}

export function somarDias(iso, n) {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return paraISO(d);
}

/** Diferença em dias inteiros (b - a) */
export function diasEntre(a, b) {
  return Math.round((deISO(b) - deISO(a)) / 86400000);
}

/** Segunda-feira da semana que contém a data */
export function inicioDaSemana(iso) {
  const dia = deISO(iso).getDay(); // 0 = domingo
  return somarDias(iso, dia === 0 ? -6 : 1 - dia);
}

export function diaDaSemana(iso) {
  return deISO(iso).getDay();
}

/** "03/11" */
export function formatoCurto(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** "terça, 3 de novembro" */
export function formatoLongo(iso) {
  const d = deISO(iso);
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "dd-mm-aaaa" (usado nos nomes de arquivo) */
export function formatoArquivo(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}-${m}-${a}`;
}

/** "hoje", "amanhã", "em 5 dias", "há 2 dias" */
export function contagemDias(hoje, alvo) {
  const n = diasEntre(hoje, alvo);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
}
