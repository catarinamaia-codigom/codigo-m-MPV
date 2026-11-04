// Método Catarina — agendamento de revisões com FSRS (Free Spaced Repetition
// Scheduler, versão 4.5, pesos padrão públicos). Funções puras: recebem o
// estado do cartão e devolvem o novo estado. Nada de IA, nada pago.
//
// Notas da revisão: 1 = Errei, 2 = Difícil, 3 = Bom, 4 = Fácil.

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const limitar = (x, a, b) => Math.min(b, Math.max(a, x));

export const NOTAS_REVISAO = [
  { nota: 1, nome: 'Errei', tecla: '1' },
  { nota: 2, nome: 'Difícil', tecla: '2' },
  { nota: 3, nome: 'Bom', tecla: '3' },
  { nota: 4, nome: 'Fácil', tecla: '4' },
];

/** Probabilidade de lembrar depois de t dias com estabilidade S. */
export const recuperabilidade = (t, s) => (s > 0 ? Math.pow(1 + (FACTOR * t) / s, DECAY) : 0);

/** Intervalo (dias) para atingir a retenção desejada. */
export function intervalo(s, retencao = 0.9) {
  const dias = (s / FACTOR) * (Math.pow(retencao, 1 / DECAY) - 1);
  return limitar(Math.round(dias), 1, 36500);
}

const dificuldadeInicial = (g) => limitar(W[4] - (g - 3) * W[5], 1, 10);

/**
 * Aplica uma revisão.
 * @param {{estabilidade:number, dificuldade:number, revisoes:number, lapsos:number, ultima:string}} c
 * @param {1|2|3|4} g nota
 * @param {number} diasDesdeUltima
 * @returns {{estabilidade, dificuldade, revisoes, lapsos, intervalo}}
 */
export function revisar(c, g, diasDesdeUltima, retencao = 0.9) {
  let s;
  let d;
  if (!c.revisoes || !c.estabilidade) {
    s = W[g - 1];
    d = dificuldadeInicial(g);
  } else {
    const r = recuperabilidade(Math.max(0, diasDesdeUltima), c.estabilidade);
    const d0 = c.dificuldade || dificuldadeInicial(3);
    d = limitar(W[7] * dificuldadeInicial(4) + (1 - W[7]) * (d0 - W[6] * (g - 3)), 1, 10);
    if (g === 1) {
      s = W[11] * Math.pow(d0, -W[12]) * (Math.pow(c.estabilidade + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
      s = Math.min(s, c.estabilidade);
    } else {
      const penal = g === 2 ? W[15] : 1;
      const bonus = g === 4 ? W[16] : 1;
      s = c.estabilidade * (Math.exp(W[8]) * (11 - d0) * Math.pow(c.estabilidade, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * penal * bonus + 1);
    }
  }
  s = limitar(s, 0.1, 36500);
  return {
    estabilidade: Math.round(s * 100) / 100,
    dificuldade: Math.round(d * 100) / 100,
    revisoes: (c.revisoes || 0) + 1,
    lapsos: (c.lapsos || 0) + (g === 1 && c.revisoes ? 1 : 0),
    intervalo: g === 1 ? 1 : intervalo(s, retencao),
  };
}

/** Prévia: em quantos dias cada botão agendaria a próxima revisão. */
export function previa(c, diasDesdeUltima, retencao = 0.9) {
  return NOTAS_REVISAO.map((n) => ({ ...n, dias: revisar(c, n.nota, diasDesdeUltima, retencao).intervalo }));
}
