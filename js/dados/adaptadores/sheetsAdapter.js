// Adaptador da PLANILHA GOOGLE — ainda NÃO está ligado (Etapa 2).
//
// Plano: login Google no próprio navegador (Google Identity Services),
// leitura com a API do Google Sheets (gratuita) e gravação na planilha
// da própria Catarina. Nenhum servidor intermediário.
//
// Para trocar o modo simulação pela planilha basta, em dataSource.js,
// usar `new SheetsAdapter(...)` no lugar de `new JsonAdapter(...)`.
// As telas não mudam, porque este adaptador entrega as abas no mesmo
// formato: { NomeDaAba: [ {coluna: valor}, ... ] }.

export const ABAS = ['Config', 'Modulos', 'Cadeiras', 'Aulas', 'Avaliacoes', 'Estudos', 'Pendencias', 'Feriados'];

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

export class SheetsAdapter {
  constructor({ planilhaId, obterToken }) {
    this.planilhaId = planilhaId;
    this.obterToken = obterToken; // função que devolve o token OAuth do login Google
    this.modo = 'planilha';
  }

  async lerAbas() {
    const token = await this.obterToken();
    const ranges = ABAS.map((a) => `ranges=${encodeURIComponent(a)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.planilhaId}/values:batchGet?${ranges}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`Erro ao ler a planilha (${resp.status})`);
    const { valueRanges } = await resp.json();
    const abas = {};
    valueRanges.forEach((vr, i) => (abas[ABAS[i]] = linhasParaObjetos(vr.values)));
    return abas;
  }

  async gravar() {
    throw new Error('Gravação na planilha: a implementar na Etapa 2.');
  }
}
