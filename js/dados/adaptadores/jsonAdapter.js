// Adaptador do MODO SIMULAÇÃO: lê um arquivo JSON local.
// Formato: { "NomeDaAba": [ {coluna: valor, ...}, ... ], ... }
// — exatamente o mesmo formato que o adaptador da planilha vai entregar.

export class JsonAdapter {
  constructor(url) {
    this.url = url;
    this.modo = 'simulacao';
  }

  /** Lê todas as abas. */
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

  /** No modo simulação nada é gravado. */
  async gravar() {
    throw new Error('Modo simulação: nada é gravado. A gravação chega com a planilha Google.');
  }
}
