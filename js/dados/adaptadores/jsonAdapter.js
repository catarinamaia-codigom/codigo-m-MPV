// Adaptador do MODO SIMULAÇÃO: lê um arquivo JSON local.
// Formato: { "NomeDaAba": [ {coluna: valor, ...}, ... ], ... }
// — exatamente o mesmo formato que o adaptador da planilha entrega.
// Também serve de semente para preencher a planilha no primeiro login.

const NAO_GRAVA = 'Modo simulação: entre com Google para salvar na sua planilha.';

export class JsonAdapter {
  constructor(url) {
    this.url = url;
    this.modo = 'simulacao';
  }

  async lerAbas() {
    const resp = await fetch(this.url, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`Não foi possível ler ${this.url} (${resp.status})`);
    const json = await resp.json();
    const abas = {};
    for (const [nome, linhas] of Object.entries(json)) {
      if (Array.isArray(linhas)) abas[nome] = linhas;
    }
    return abas;
  }

  async adicionarLinha() {
    throw new Error(NAO_GRAVA);
  }

  async atualizarLinha() {
    throw new Error(NAO_GRAVA);
  }
}
