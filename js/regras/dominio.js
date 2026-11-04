// Nível de domínio por assunto e por cadeira, calculado sozinho a partir
// das aulas, estudos feitos, questões e dúvidas. Sempre com o motivo.
//
// Questões: "Chutou" com confiança 1–2 conta como erro; com 4–5 conta como
// acerto, mas marca "necessita aprofundamento".

export const NIVEIS = [
  { n: 0, nome: 'Ainda não visto' },
  { n: 1, nome: 'Visto em aula' },
  { n: 2, nome: 'Estudado' },
  { n: 3, nome: 'Praticando' },
  { n: 4, nome: 'Bom' },
  { n: 5, nome: 'Domínio' },
];

const chave = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const mesmoAssunto = (a, b) => chave(a) === chave(b);

/** Questão -> {acerto: boolean, aprofundar: boolean} */
export function avaliarQuestao(q) {
  if (q.resultado === 'Acertou') return { acerto: true, aprofundar: q.motivos.some((m) => /aprofund/i.test(m)) || q.confianca <= 2 };
  if (q.resultado === 'Errou') return { acerto: false, aprofundar: true };
  // Chutou
  if (q.confianca >= 4) return { acerto: true, aprofundar: true };
  return { acerto: false, aprofundar: true };
}

/** Estatística de um conjunto de questões. */
export function estatisticaQuestoes(qs) {
  const avaliadas = qs.map(avaliarQuestao);
  const acertos = avaliadas.filter((a) => a.acerto).length;
  return {
    total: qs.length,
    acertos,
    erros: qs.length - acertos,
    chutes: qs.filter((q) => q.resultado === 'Chutou').length,
    aprofundar: avaliadas.filter((a) => a.aprofundar).length,
    taxa: qs.length ? acertos / qs.length : null,
  };
}

/** Domínio de um assunto. */
export function dominioAssunto(m, cadeiraId, assunto) {
  const daqui = (x) => x.cadeiraId === cadeiraId && mesmoAssunto(x.assunto, assunto);
  const aulas = m.aulas.filter(daqui);
  const vista = aulas.some((a) => a.data <= m.hoje);
  const estudosFeitos = m.estudos.filter((e) => daqui(e) && e.feito).length;
  const qs = m.questoes.filter(daqui);
  const est = estatisticaQuestoes(qs);
  const abertas = m.duvidas.filter((d) => daqui(d) && !d.sanada).length;

  let nivel = 0;
  let motivo = 'Aula ainda não aconteceu.';
  if (vista) [nivel, motivo] = [1, 'Aula dada, sem estudo registrado.'];
  if (estudosFeitos) [nivel, motivo] = [2, `${estudosFeitos} estudo(s) feito(s).`];
  if (est.total) {
    const pct = Math.round(est.taxa * 100);
    if (est.total >= 5 && est.taxa >= 0.8) [nivel, motivo] = [5, `${pct}% de acerto em ${est.total} questões.`];
    else if (est.taxa >= 0.6) [nivel, motivo] = [4, `${pct}% de acerto em ${est.total} questão(ões).`];
    else [nivel, motivo] = [3, `${pct}% de acerto em ${est.total} questão(ões): vale voltar a estudar.`];
  }
  if (abertas && nivel > 3) {
    nivel = 3;
    motivo += ` ${abertas} dúvida(s) aberta(s).`;
  }
  return { nivel, nome: NIVEIS[nivel].nome, motivo, questoes: est, duvidasAbertas: abertas, estudosFeitos };
}

/** Assuntos de uma cadeira na ordem das aulas (inclui assuntos só de questões/dúvidas). */
export function assuntosDaCadeira(m, cadeiraId) {
  const nomes = [];
  const add = (a) => {
    if (a && !nomes.some((n) => mesmoAssunto(n, a))) nomes.push(a);
  };
  m.aulas.filter((a) => a.cadeiraId === cadeiraId).forEach((a) => add(a.assunto));
  for (const lista of [m.questoes, m.duvidas, m.materiais, m.cartoes, m.estudos]) {
    lista.filter((x) => x.cadeiraId === cadeiraId).forEach((x) => add(x.assunto));
  }
  return nomes;
}

/** Domínio médio da cadeira (só assuntos já vistos). */
export function dominioCadeira(m, cadeiraId) {
  const itens = assuntosDaCadeira(m, cadeiraId).map((a) => dominioAssunto(m, cadeiraId, a)).filter((d) => d.nivel > 0);
  if (!itens.length) return { nivel: 0, media: 0, vistos: 0 };
  const media = itens.reduce((s, d) => s + d.nivel, 0) / itens.length;
  return { nivel: Math.round(media), media: Math.round(media * 10) / 10, vistos: itens.length };
}
