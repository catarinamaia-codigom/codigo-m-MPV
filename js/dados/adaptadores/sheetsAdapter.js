// Adaptador da PLANILHA GOOGLE: lê e grava direto na planilha da Catarina
// pela API do Google Sheets (gratuita), com o token do login Google feito
// no próprio navegador. Nenhum servidor intermediário.
//
// Entrega as abas no mesmo formato do JsonAdapter:
// { NomeDaAba: [ {coluna: valor}, ... ] } — por isso as telas não mudam.

/** Abas da planilha e suas colunas (a 1ª linha de cada aba é este cabeçalho). */
export const COLUNAS = {
  Config: ['grupo', 'chave', 'valor', 'obs'],
  Modulos: ['id', 'periodo', 'nome', 'ordem'],
  Cadeiras: ['id', 'modulo_id', 'nome', 'ordem'],
  Aulas: ['id', 'data', 'inicio', 'fim', 'cadeira_id', 'assunto', 'tipo', 'turma', 'local', 'professor', 'aconteceu', 'presente'],
  Avaliacoes: ['id', 'data', 'hora', 'fim', 'cadeira_id', 'titulo', 'tipo', 'conteudo', 'turma', 'local', 'obs', 'link', 'vale', 'nota', 'entrega'],
  Estudos: ['id', 'data', 'inicio', 'fim', 'cadeira_id', 'assunto', 'atividade', 'feito'],
  Pendencias: ['id', 'descricao', 'cadeira_id', 'prazo', 'status', 'prioridade'],
  Feriados: ['data', 'nome'],
  // Etapa 3 — estudo ativo
  Duvidas: ['id', 'criada', 'cadeira_id', 'assunto', 'pergunta', 'motivo', 'tentativa', 'resposta', 'fonte', 'link', 'status', 'sanada_em', 'imagem'],
  Questoes: ['id', 'data', 'cadeira_id', 'assunto', 'fonte', 'resultado', 'confianca', 'motivos', 'obs', 'imagem'],
  Notas: ['id', 'cadeira_id', 'avaliacao_id', 'nome', 'vale', 'peso', 'nota', 'bonus', 'obs'],
  Materiais: ['id', 'criado', 'cadeira_id', 'assunto', 'tipo', 'titulo', 'link', 'origem', 'copiado', 'obs', 'drive_id', 'hash', 'nome_original'],
  Cartoes: ['id', 'criado', 'cadeira_id', 'assunto', 'frente', 'verso', 'fonte', 'origem', 'vence', 'estabilidade', 'dificuldade', 'revisoes', 'lapsos', 'ultima', 'imagem_frente', 'imagem_verso'],
  Revisoes: ['data', 'cartao_id', 'nota', 'intervalo'],
};
export const ABAS = Object.keys(COLUNAS);

/** Abas que NÃO recebem os dados de exemplo do JSON (começam vazias na planilha). */
const ABAS_SEM_EXEMPLO = ['Estudos', 'Pendencias', 'Duvidas', 'Questoes', 'Notas', 'Materiais', 'Cartoes', 'Revisoes'];

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export class ErroLogin extends Error {}

/**
 * Converte o retorno da API do Sheets (lista de linhas, a 1ª é o cabeçalho)
 * em lista de objetos. Linhas totalmente vazias são ignoradas.
 * Exemplo: [["id","nome"],["1","Ana"]] -> [{id:"1", nome:"Ana"}]
 */
export function linhasParaObjetos(valores) {
  if (!Array.isArray(valores) || valores.length === 0) return [];
  const [cabecalho, ...linhas] = valores;
  const colunas = cabecalho.map((c) => String(c ?? '').trim());
  return linhas
    .filter((linha) => linha.some((v) => String(v ?? '').trim() !== ''))
    .map((linha) => Object.fromEntries(colunas.map((c, i) => [c, linha[i] ?? ''])));
}

/** Objeto -> linha, na ordem do cabeçalho. Valores ausentes viram "". */
export function objetoParaLinha(cabecalho, objeto) {
  return cabecalho.map((c) => {
    const v = objeto[String(c).trim()];
    if (v === true) return 'TRUE';
    if (v === false) return 'FALSE';
    return v ?? '';
  });
}

/** 0 -> A, 25 -> Z, 26 -> AA */
export function letraColuna(indice) {
  let s = '';
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/**
 * Dados iniciais da planilha a partir das abas do JSON:
 * { Aba: [cabecalho, ...linhas] }. Estudos e Pendências começam vazias.
 */
export function montarSemente(abasJson) {
  const semente = {};
  for (const aba of ABAS) {
    const cab = COLUNAS[aba];
    const linhas = ABAS_SEM_EXEMPLO.includes(aba) ? [] : (abasJson[aba] ?? []).map((o) => objetoParaLinha(cab, o));
    semente[aba] = [cab, ...linhas];
  }
  return semente;
}

const aspas = (aba) => `'${aba.replace(/'/g, "''")}'`;

export class SheetsAdapter {
  /**
   * @param {object} opcoes
   * @param {string} opcoes.planilhaId
   * @param {() => string|null} opcoes.obterToken  token OAuth atual (ou null)
   * @param {typeof fetch} [opcoes.fetch]          injetável para testes
   */
  constructor({ planilhaId, obterToken, fetch: f }) {
    this.planilhaId = planilhaId;
    this.obterToken = obterToken;
    this.fetch = f ?? ((...a) => fetch(...a));
    this.modo = 'planilha';
  }

  get url() {
    return `https://docs.google.com/spreadsheets/d/${this.planilhaId}/edit`;
  }

  async req(caminho, { method = 'GET', body } = {}) {
    const token = this.obterToken();
    if (!token) throw new ErroLogin('Entre com Google para acessar a planilha.');
    const resp = await this.fetch(`${API}/${this.planilhaId}${caminho}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (resp.status === 401) throw new ErroLogin('O login expirou. Entre com Google de novo.');
    if (resp.status === 403 || resp.status === 404) {
      throw new ErroLogin('Esta conta Google não tem acesso à planilha do Código M. Entre com a conta dona da planilha.');
    }
    if (!resp.ok) {
      let msg = '';
      try {
        msg = (await resp.json())?.error?.message ?? '';
      } catch {
        /* sem corpo */
      }
      throw new Error(`Erro na planilha (${resp.status}) ${msg}`.trim());
    }
    return resp.json();
  }

  /**
   * Garante que todas as abas existem. Na primeira vez (aba Config vazia),
   * preenche a planilha com a semente (horário importado do PDF etc.).
   * @param {() => Promise<object>} obterSemente  só é chamada se precisar
   * @returns {Promise<boolean>} true se a planilha foi preenchida agora
   */
  async garantirEstrutura(obterSemente) {
    const meta = await this.req('?fields=sheets.properties(sheetId,title)');
    const existentes = meta.sheets.map((s) => s.properties);
    const titulos = existentes.map((p) => p.title);
    const faltando = ABAS.filter((a) => !titulos.includes(a));
    const pedidos = [];

    // Planilha nova: a aba padrão ("Página1") vira a primeira aba do Código M
    if (faltando.length === ABAS.length && existentes.length === 1) {
      pedidos.push({
        updateSheetProperties: { properties: { sheetId: existentes[0].sheetId, title: faltando[0] }, fields: 'title' },
      });
      pedidos.push({
        updateSpreadsheetProperties: { properties: { locale: 'pt_BR', timeZone: 'America/Recife' }, fields: 'locale,timeZone' },
      });
      faltando.shift();
    }
    for (const aba of faltando) pedidos.push({ addSheet: { properties: { title: aba } } });
    if (pedidos.length) await this.req(':batchUpdate', { method: 'POST', body: { requests: pedidos } });

    // Lê a 1ª linha (cabeçalho) de todas as abas
    const ranges = ABAS.map((a) => `ranges=${encodeURIComponent(`${aspas(a)}!1:1`)}`).join('&');
    const { valueRanges } = await this.req(`/values:batchGet?${ranges}`);
    const cabecalhos = valueRanges.map((vr) => (vr.values?.[0] ?? []).map((c) => String(c ?? '').trim()));
    const vazias = ABAS.filter((_, i) => !cabecalhos[i].some(Boolean));

    // Abas antigas ganham, no fim do cabeçalho, as colunas novas do Código M
    const colunasNovas = ABAS.flatMap((aba, i) => {
      const cab = cabecalhos[i];
      if (!cab.some(Boolean)) return [];
      const faltam = COLUNAS[aba].filter((c) => !cab.includes(c));
      return faltam.length ? [{ range: `${aspas(aba)}!${letraColuna(cab.length)}1`, values: [faltam] }] : [];
    });
    if (colunasNovas.length) {
      await this.req('/values:batchUpdate', { method: 'POST', body: { valueInputOption: 'RAW', data: colunasNovas } });
    }
    if (!vazias.length) return false;

    const primeiraVez = vazias.includes('Config');
    const semente = primeiraVez ? await obterSemente() : null;
    const data = vazias.map((aba) => ({
      range: `${aspas(aba)}!A1`,
      values: primeiraVez ? semente[aba] : [COLUNAS[aba]],
    }));
    await this.req('/values:batchUpdate', { method: 'POST', body: { valueInputOption: 'RAW', data } });

    // Cabeçalho em negrito e congelado nas abas preenchidas agora
    const props = (await this.req('?fields=sheets.properties(sheetId,title)')).sheets.map((s) => s.properties);
    const formato = props
      .filter((p) => vazias.includes(p.title))
      .flatMap((p) => [
        {
          repeatCell: {
            range: { sheetId: p.sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat.bold',
          },
        },
        { updateSheetProperties: { properties: { sheetId: p.sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
      ]);
    if (formato.length) await this.req(':batchUpdate', { method: 'POST', body: { requests: formato } });
    return primeiraVez;
  }

  /** Lê todas as abas. */
  async lerAbas() {
    const ranges = ABAS.map((a) => `ranges=${encodeURIComponent(aspas(a))}`).join('&');
    const { valueRanges } = await this.req(`/values:batchGet?${ranges}`);
    const abas = {};
    valueRanges.forEach((vr, i) => (abas[ABAS[i]] = linhasParaObjetos(vr.values)));
    return abas;
  }

  /** Acrescenta uma linha no fim da aba (colunas pelo cabeçalho da própria aba). */
  async adicionarLinha(aba, objeto) {
    const cab = (await this.req(`/values/${encodeURIComponent(`${aspas(aba)}!1:1`)}`)).values?.[0] ?? COLUNAS[aba];
    const linha = objetoParaLinha(cab, objeto);
    await this.req(
      `/values/${encodeURIComponent(`${aspas(aba)}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: { values: [linha] } }
    );
  }

  /** Acrescenta várias linhas de uma vez (importações). */
  async adicionarLinhas(aba, objetos) {
    if (!objetos.length) return;
    const cab = (await this.req(`/values/${encodeURIComponent(`${aspas(aba)}!1:1`)}`)).values?.[0] ?? COLUNAS[aba];
    await this.req(
      `/values/${encodeURIComponent(`${aspas(aba)}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: { values: objetos.map((o) => objetoParaLinha(cab, o)) } }
    );
  }

  /** Altera campos da linha cujo "id" é o informado. */
  async atualizarLinha(aba, id, campos) {
    const { values = [] } = await this.req(`/values/${encodeURIComponent(aspas(aba))}`);
    const [cab = [], ...linhas] = values;
    const colId = cab.indexOf('id');
    const idx = linhas.findIndex((l) => String(l[colId] ?? '') === String(id));
    if (colId < 0 || idx < 0) throw new Error(`Não encontrei "${id}" na aba ${aba}. Recarregue a página.`);
    const linhaPlanilha = idx + 2; // +1 do cabeçalho, +1 porque começa em 1
    const data = Object.entries(campos).map(([coluna, valor]) => {
      const c = cab.indexOf(coluna);
      if (c < 0) throw new Error(`A aba ${aba} não tem a coluna "${coluna}".`);
      return { range: `${aspas(aba)}!${letraColuna(c)}${linhaPlanilha}`, values: [objetoParaLinha([coluna], campos)] };
    });
    await this.req('/values:batchUpdate', { method: 'POST', body: { valueInputOption: 'RAW', data } });
  }
}
