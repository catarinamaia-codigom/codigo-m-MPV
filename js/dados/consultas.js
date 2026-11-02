// Consultas prontas sobre o modelo. Recebem o modelo como parâmetro
// (funções puras), para funcionarem com qualquer fonte de dados.

import { diasEntre } from '../util/datas.js';

export const cadeiraPorId = (m, id) => m.cadeiras.find((c) => c.id === id);
export const moduloPorId = (m, id) => m.modulos.find((x) => x.id === id);
export const nomeCadeira = (m, id) => cadeiraPorId(m, id)?.nome ?? (id || 'Geral');

export const aulasDoDia = (m, data) => m.aulas.filter((a) => a.data === data);
export const estudosDoDia = (m, data) => m.estudos.filter((e) => e.data === data);
export const avaliacoesDoDia = (m, data) => m.avaliacoes.filter((a) => a.data === data);
export const feriadoDoDia = (m, data) => m.feriados.find((f) => f.data === data);

export const aulasEntre = (m, de, ate) => m.aulas.filter((a) => a.data >= de && a.data <= ate);

/** Avaliações de hoje em diante, com a contagem de dias. */
export function proximasAvaliacoes(m, limite = 6) {
  return m.avaliacoes
    .filter((a) => a.data >= m.hoje)
    .slice(0, limite)
    .map((a) => ({ ...a, faltam: diasEntre(m.hoje, a.data) }));
}

/** Pendências abertas, atrasadas primeiro, depois por prazo. */
export function pendenciasAbertas(m) {
  return m.pendencias
    .filter((p) => !p.feita)
    .map((p) => ({ ...p, faltam: p.prazo ? diasEntre(m.hoje, p.prazo) : null }))
    .sort((a, b) => (a.faltam ?? 999) - (b.faltam ?? 999));
}

export const aulasDaCadeira = (m, cadeiraId) => m.aulas.filter((a) => a.cadeiraId === cadeiraId);
export const avaliacoesDaCadeira = (m, cadeiraId) => m.avaliacoes.filter((a) => a.cadeiraId === cadeiraId);
