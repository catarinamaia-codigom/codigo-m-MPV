// Adaptador do MODO SIMULAÇÃO: lê um arquivo JSON local.
// Formato: { "NomeDaAba": [ {coluna: valor, ...}, ... ], ... }
// — exatamente o mesmo formato que o adaptador da planilha entrega.
// Também serve de semente para preencher a planilha no primeiro login.
//
// No modo simulação dá para testar tudo: o que for criado ou alterado fica
// só na memória desta aba e some ao recarregar a página.

export class JsonAdapter {
  constructor(url) {
    this.url = url;
    this.modo = 'simulacao';
    this.memoria = null; // abas alteradas nesta sessão
  }

  /** Abas originais do arquivo (sem as alterações da sessão). */
  async lerOriginal() {
    const resp = await fetch(this.url, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`Não foi possível ler ${this.url} (${resp.status})`);
    const json = await resp.json();
    const abas = {};
    for (const [nome, linhas] of Object.entries(json)) {
      if (Array.isArray(linhas)) abas[nome] = linhas;
    }
    return abas;
  }

  async lerAbas() {
    this.memoria ??= await this.lerOriginal();
    return structuredClone(this.memoria);
  }

  async adicionarLinha(aba, objeto) {
    await this.lerAbas();
    (this.memoria[aba] ??= []).push({ ...objeto });
  }

  async adicionarLinhas(aba, objetos) {
    for (const o of objetos) await this.adicionarLinha(aba, o);
  }

  async atualizarLinha(aba, id, campos) {
    await this.lerAbas();
    const linha = (this.memoria[aba] ?? []).find((l) => String(l.id) === String(id));
    if (!linha) throw new Error(`Não encontrei "${id}" na aba ${aba}.`);
    Object.assign(linha, campos);
  }
}
