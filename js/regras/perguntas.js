// Perguntas aleatórias de estudo ativo (sem IA, sem custo).
// Fontes: cartões do Método Catarina, dúvidas já sanadas e modelos de
// pergunta aplicados aos assuntos que já tiveram aula. Os modelos podem ser
// trocados na aba Config (grupo pergunta_ativa, coluna valor, com {assunto},
// {cadeira} e {outro} = outro assunto da mesma cadeira).

import { assuntosDaCadeira, mesmoAssunto } from './dominio.js';
import { nomeCadeira } from '../dados/consultas.js';

export const MODELOS_PADRAO = [
  'Explique {assunto} em voz alta, sem consultar, como se ensinasse a uma colega.',
  'Desenhe de memória um esquema de {assunto}. Depois confira no material.',
  'Quais são os 3 pontos de {assunto} que mais caem em prova? Por quê?',
  'Como {assunto} aparece na clínica ou num exame?',
  'Em {assunto}, o que acontece quando algo dá errado? Siga: mecanismo → consequência → clínica.',
  'Qual a relação entre {assunto} e {outro}?',
  'Escreva 2 perguntas de prova sobre {assunto} e responda sem consultar.',
];

/**
 * Sorteia uma pergunta.
 * @param {object} m  modelo
 * @param {object} [o]
 * @param {string} [o.cadeiraId]  só desta cadeira (vazio = todas)
 * @param {() => number} [o.aleatorio]  para testes (padrão Math.random)
 * @returns {{texto, resposta, origem, cadeiraId, assunto} | null}
 */
export function sortearPergunta(m, { cadeiraId = '', aleatorio = Math.random } = {}) {
  const daCadeira = (x) => !cadeiraId || x.cadeiraId === cadeiraId;
  const escolher = (lista) => lista[Math.floor(aleatorio() * lista.length)];
  const candidatos = [];

  for (const c of m.cartoes.filter(daCadeira)) {
    candidatos.push({ texto: c.frente, resposta: c.verso, origem: 'Cartão', cadeiraId: c.cadeiraId, assunto: c.assunto });
  }
  for (const d of m.duvidas.filter((x) => daCadeira(x) && x.sanada && x.resposta)) {
    candidatos.push({ texto: d.pergunta, resposta: d.resposta, origem: 'Dúvida sanada', cadeiraId: d.cadeiraId, assunto: d.assunto });
  }
  // Modelos x assuntos que já tiveram aula (ou que têm algo registrado)
  const modelos = m.config.perguntasAtivas?.length ? m.config.perguntasAtivas : MODELOS_PADRAO;
  const cadeiras = cadeiraId ? [cadeiraId] : m.cadeiras.map((c) => c.id);
  for (const cad of cadeiras) {
    const assuntos = assuntosDaCadeira(m, cad).filter(
      (a) => m.aulas.some((x) => x.cadeiraId === cad && mesmoAssunto(x.assunto, a) && x.data <= m.hoje) || !m.aulas.some((x) => x.cadeiraId === cad && mesmoAssunto(x.assunto, a))
    );
    for (const assunto of assuntos) candidatos.push({ modelo: true, cadeiraId: cad, assunto, assuntos });
  }
  if (!candidatos.length) return null;

  const c = escolher(candidatos);
  if (!c.modelo) return c;
  const outros = c.assuntos.filter((a) => !mesmoAssunto(a, c.assunto));
  const usaveis = modelos.filter((t) => !t.includes('{outro}') || outros.length);
  const texto = escolher(usaveis)
    .replaceAll('{assunto}', c.assunto)
    .replaceAll('{cadeira}', nomeCadeira(m, c.cadeiraId))
    .replaceAll('{outro}', outros.length ? escolher(outros) : '');
  return { texto, resposta: '', origem: 'Pergunta modelo', cadeiraId: c.cadeiraId, assunto: c.assunto };
}
