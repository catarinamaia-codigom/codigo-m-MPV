// ─────────────────────────────────────────────────────────────
// dataSource — ÚNICO ponto por onde as telas obtêm e gravam dados.
//
// • Sem login: MODO SIMULAÇÃO (data/simulacao.json, nada é gravado).
// • Com login Google: PLANILHA "Código M - Dados" no Drive da Catarina.
//   No primeiro login a planilha é criada/preenchida com o JSON.
// As telas só usam as funções daqui e de consultas.js.
// ─────────────────────────────────────────────────────────────

import { JsonAdapter } from './adaptadores/jsonAdapter.js';
import { SheetsAdapter, ErroLogin, montarSemente } from './adaptadores/sheetsAdapter.js';
import { normalizar } from './normalizar.js';
import { paraISO, normalizarData } from '../util/datas.js';
import { GOOGLE } from '../config.js';
import * as google from './google.js';

const json = new JsonAdapter('data/simulacao.json');
const planilha = new SheetsAdapter({ planilhaId: GOOGLE.planilhaId, obterToken: google.tokenAtual });

let adaptador = json;
let modelo = null;
let avisoCarga = ''; // ex.: "o login expirou" — mostrado na faixa do topo
let planilhaPreenchida = false;

/**
 * Carrega (ou recarrega) todos os dados: da planilha se houver login,
 * senão do JSON. A data de "hoje" pode ser forçada com ?hoje=AAAA-MM-DD.
 */
export async function carregar() {
  let abas;
  avisoCarga = '';
  planilhaPreenchida = false;
  adaptador = json;
  if (google.configurado() && google.conectado()) {
    try {
      planilhaPreenchida = await planilha.garantirEstrutura(async () => montarSemente(await json.lerOriginal()));
      abas = await planilha.lerAbas();
      adaptador = planilha;
    } catch (erro) {
      console.error(erro);
      if (erro instanceof ErroLogin) google.sair();
      avisoCarga = erro.message;
    }
  }
  abas ??= await json.lerAbas();

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

export const emSimulacao = () => adaptador.modo === 'simulacao';
export const mensagemCarga = () => avisoCarga;
export const acabouDePreencher = () => planilhaPreenchida;
export const linkPlanilha = () => (GOOGLE.planilhaId ? planilha.url : '');

/** Nova linha numa aba (ex.: adicionar('Avaliacoes', {...})). */
export async function adicionar(aba, objeto, { silencioso = false } = {}) {
  await adaptador.adicionarLinha(aba, objeto);
  if (!silencioso) avisarMudanca();
}

/** Várias linhas novas numa aba, numa só gravação (importações). */
export async function adicionarVarias(aba, objetos) {
  await adaptador.adicionarLinhas(aba, objetos);
  avisarMudanca();
}

/** Altera campos de uma linha pelo id (ex.: atualizar('Estudos', 'E003', {feito: true})). */
export async function atualizar(aba, id, campos, { silencioso = false } = {}) {
  await adaptador.atualizarLinha(aba, id, campos);
  if (!silencioso) avisarMudanca();
}

/** Gera um id curto e único para novas linhas (ex.: "AV-lq3k9x"). */
let ultimoId = 0;
export const novoId = (prefixo) => {
  ultimoId = Math.max(Date.now(), ultimoId + 1);
  return `${prefixo}-${ultimoId.toString(36)}`;
};

export function avisarMudanca() {
  window.dispatchEvent(new CustomEvent('codigom:dados-mudaram'));
}
