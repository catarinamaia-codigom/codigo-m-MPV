// Imitação mínima da API do Google Sheets, em memória, para testes.
// Cobre só o que o SheetsAdapter usa.

const letraParaIndice = (l) => [...l].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

export class PlanilhaFalsa {
  constructor({ abas = { 'Página1': [] }, token = 'token-teste' } = {}) {
    this.token = token;
    this.abas = new Map(Object.entries(abas).map(([t, v], i) => [t, { id: i, valores: v }]));
    this.chamadas = [];
    this.locale = 'en_US';
  }

  aba(nome) {
    const a = this.abas.get(nome);
    if (!a) throw Object.assign(new Error(`aba ${nome} não existe`), { status: 400 });
    return a;
  }

  /** "'Aba'!A1:B2" | "'Aba'!1:1" | "'Aba'" -> {aba, linha0, col0} */
  intervalo(texto) {
    const m = decodeURIComponent(texto).match(/^'?(.*?)'?(?:!(.*))?$/);
    const aba = m[1].replace(/''/g, "'");
    const ref = m[2] ?? '';
    const c = ref.match(/^([A-Z]*)(\d*)/);
    return { aba, ref, col0: c[1] ? letraParaIndice(c[1]) : 0, linha0: c[2] ? Number(c[2]) - 1 : 0 };
  }

  ler({ aba, ref }) {
    const v = this.aba(aba).valores;
    if (/^1:1$/.test(ref)) return v.slice(0, 1);
    if (/^A1:A2$/.test(ref)) return v.slice(0, 2).map((l) => l.slice(0, 1)).filter((l) => l.length);
    return v;
  }

  escrever({ aba, linha0, col0 }, valores) {
    const v = this.aba(aba).valores;
    valores.forEach((linha, i) => {
      const alvo = (v[linha0 + i] ??= []);
      linha.forEach((x, j) => (alvo[col0 + j] = String(x)));
    });
  }

  /** Função com a mesma assinatura do fetch. */
  fetch = async (url, { method = 'GET', headers = {}, body } = {}) => {
    const u = new URL(url);
    this.chamadas.push(`${method} ${decodeURIComponent(u.pathname + u.search)}`);
    if (headers.Authorization !== `Bearer ${this.token}`) return resposta(401, {});
    const caminho = u.pathname.replace(/^\/v4\/spreadsheets\/[^/:]+/, '');
    const dados = body ? JSON.parse(body) : null;
    try {
      if (caminho === '' && method === 'GET') {
        return resposta(200, { sheets: [...this.abas].map(([title, a]) => ({ properties: { sheetId: a.id, title } })) });
      }
      if (caminho === ':batchUpdate') {
        for (const r of dados.requests) {
          if (r.addSheet) this.abas.set(r.addSheet.properties.title, { id: this.abas.size + 100, valores: [] });
          if (r.updateSheetProperties?.fields === 'title') {
            const [antigo, a] = [...this.abas].find(([, x]) => x.id === r.updateSheetProperties.properties.sheetId);
            this.abas.delete(antigo);
            this.abas.set(r.updateSheetProperties.properties.title, a);
          }
          if (r.updateSpreadsheetProperties) this.locale = r.updateSpreadsheetProperties.properties.locale;
        }
        return resposta(200, {});
      }
      if (caminho === '/values:batchGet') {
        const ranges = u.searchParams.getAll('ranges');
        return resposta(200, { valueRanges: ranges.map((r) => ({ range: r, values: this.ler(this.intervalo(r)) })) });
      }
      if (caminho === '/values:batchUpdate') {
        for (const d of dados.data) this.escrever(this.intervalo(d.range), d.values);
        return resposta(200, {});
      }
      const append = caminho.match(/^\/values\/(.+):append$/);
      if (append) {
        const { aba } = this.intervalo(append[1]);
        this.aba(aba).valores.push(dados.values[0].map(String));
        return resposta(200, {});
      }
      const get = caminho.match(/^\/values\/(.+)$/);
      if (get && method === 'GET') return resposta(200, { values: this.ler(this.intervalo(get[1])) });
      return resposta(404, { error: { message: `rota não simulada: ${caminho}` } });
    } catch (e) {
      return resposta(e.status ?? 500, { error: { message: e.message } });
    }
  };
}

function resposta(status, json) {
  return { ok: status >= 200 && status < 300, status, json: async () => json };
}
