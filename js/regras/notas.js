// Calculadora de notas. Funções puras.
//
// Cada avaliação tem "vale" (pontos máximos) e "peso". Peso em branco = vale,
// o que cobre os dois jeitos da UPE: soma de pontos (AV1 4 + AV2 4 + AV3 2)
// e média simples (todas valendo 10). Bônus soma direto na média.
// Abaixo da média de aprovação vai para a final: média final =
// (média + final) / 2, que precisa chegar à média da final (regra configurável).

const arred = (n) => Math.round(n * 100) / 100;

/**
 * @param {Array<{vale:number, peso:number, nota:number|null, bonus:boolean}>} itens
 * @param {{mediaAprovacao:number, mediaFinal:number}} regra
 * @param {Object<string, number>} simuladas  notas hipotéticas por índice (não gravadas)
 */
export function calcularMedia(itens, regra = { mediaAprovacao: 7, mediaFinal: 5 }, simuladas = {}) {
  const normais = itens.map((it, i) => ({ ...it, i })).filter((it) => !it.bonus);
  const bonus = itens.filter((it) => it.bonus && it.nota !== null).reduce((s, it) => s + it.nota, 0);
  const pesoTotal = normais.reduce((s, it) => s + it.peso, 0);
  if (!pesoTotal) return { vazio: true, bonus: arred(bonus) };

  const valor = (it) => (simuladas[it.i] !== undefined && simuladas[it.i] !== '' ? Number(simuladas[it.i]) : it.nota);
  const lancadas = normais.filter((it) => valor(it) !== null && Number.isFinite(valor(it)));
  const pendentes = normais.filter((it) => !lancadas.includes(it));
  const contrib = (it) => (Math.min(valor(it), it.vale) / it.vale) * it.peso;

  const somaLancadas = lancadas.reduce((s, it) => s + contrib(it), 0);
  const pesoLancadas = lancadas.reduce((s, it) => s + it.peso, 0);
  const pesoPendente = pendentes.reduce((s, it) => s + it.peso, 0);

  const garantida = (somaLancadas / pesoTotal) * 10 + bonus; // pendentes contam zero
  const parcial = pesoLancadas ? (somaLancadas / pesoLancadas) * 10 + bonus : null; // ritmo atual
  const completa = pendentes.length === 0;
  const media = completa ? garantida : null;

  // Quanto precisa, em média (0 a 10), nas que faltam para aprovar direto
  let precisa = null;
  if (!completa) {
    const falta = regra.mediaAprovacao - garantida;
    precisa = falta <= 0 ? 0 : (falta / 10) * (pesoTotal / pesoPendente) * 10;
  }

  let situacao = 'andamento';
  let notaFinalNecessaria = null;
  if (completa) {
    if (media >= regra.mediaAprovacao) situacao = 'aprovada';
    else {
      situacao = 'final';
      notaFinalNecessaria = Math.max(0, 2 * regra.mediaFinal - media);
      if (notaFinalNecessaria > 10) situacao = 'reprovada';
    }
  } else if (precisa !== null && precisa > 10) situacao = 'risco';

  return {
    vazio: false,
    media: media === null ? null : arred(media),
    garantida: arred(garantida),
    parcial: parcial === null ? null : arred(parcial),
    precisa: precisa === null ? null : arred(precisa),
    notaFinalNecessaria: notaFinalNecessaria === null ? null : arred(notaFinalNecessaria),
    bonus: arred(bonus),
    pendentes: pendentes.length,
    lancadas: lancadas.length,
    situacao,
  };
}
