// ─────────────────────────────────────────────────────────────
// dataSource — ÚNICO ponto por onde as telas obtêm dados.
//
// Hoje: MODO SIMULAÇÃO (arquivo data/simulacao.json, nada é gravado).
// Etapa 2: trocar o adaptador pelo SheetsAdapter (planilha Google).
// As telas só usam as funções exportadas aqui e em consultas.js,
// então a troca não exige refazer nenhuma tela.
// ─────────────────────────────────────────────────────────────

import { JsonAdapter } from './adaptadores/jsonAdapter.js';
// import { SheetsAdapter } from './adaptadores/sheetsAdapter.js'; // Etapa 2
import { normalizar } from './normalizar.js';
import { paraISO, normalizarData } from '../util/datas.js';

const adaptador = new JsonAdapter('data/simulacao.json');

let modelo = null;

/**
 * Carrega (ou recarrega) todos os dados.
 * Para testes, a data de "hoje" pode ser forçada com ?hoje=AAAA-MM-DD na URL.
 */
export async function carregar() {
  const abas = await adaptador.lerAbas();
  const hojeUrl = normalizarData(new URLSearchParams(location.search).get('hoje'));
  modelo = normalizar(abas, { modo: adaptador.modo, hojeReal: paraISO(new Date()) });
  if (hojeUrl) modelo.hoje = hojeUrl;
  return modelo;
}

/** Modelo já carregado (as telas chamam depois de carregar()). */
export function dados() {
  if (!modelo) throw new Error('Dados ainda não carregados');
  return modelo;
}

/** Gravação (ex.: marcar estudo como feito). No modo simulação, recusa. */
export async function gravar(aba, linha) {
  return adaptador.gravar(aba, linha);
}

export const emSimulacao = () => adaptador.modo === 'simulacao';
