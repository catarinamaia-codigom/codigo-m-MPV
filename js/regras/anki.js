// Leitura de baralhos do Anki (.apkg / .colpkg) — parte "pura", sem navegador.
// Transforma as notas e cartões do Anki em cartões do Método Catarina:
//   • básico / básico com inverso / digitar resposta: frente e verso pelo modelo do cartão
//   • omissão de palavras (cloze): um cartão por lacuna (c1, c2…)
//   • oclusão de imagem nativa (Anki 23.10+): imagem + máscaras desenhadas pelo site
//   • oclusão do complemento "Image Occlusion Enhanced": imagem + máscara SVG do próprio Anki
// Nada de IA: só lê o que já está no arquivo.

import { normalizarData } from '../util/datas.js';

// ── Protobuf mínimo (o formato novo do Anki guarda modelos e mídia assim) ──

/** Lê uma mensagem protobuf -> Map(número do campo -> lista de valores). */
export function lerProtobuf(bytes) {
  const campos = new Map();
  let i = 0;
  const varint = () => {
    let valor = 0;
    let mult = 1;
    for (;;) {
      const b = bytes[i++];
      valor += (b & 0x7f) * mult;
      if (b < 0x80) return valor;
      mult *= 128;
    }
  };
  while (i < bytes.length) {
    const chave = varint();
    const campo = Math.floor(chave / 8);
    const tipo = chave % 8;
    let valor;
    if (tipo === 0) valor = varint();
    else if (tipo === 2) {
      const n = varint();
      valor = bytes.subarray(i, i + n);
      i += n;
    } else if (tipo === 1) i += 8;
    else if (tipo === 5) i += 4;
    else break; // tipo desconhecido: para de ler
    if (valor !== undefined) {
      if (!campos.has(campo)) campos.set(campo, []);
      campos.get(campo).push(valor);
    }
  }
  return campos;
}

const utf8 = new TextDecoder();
const texto = (v) => (v instanceof Uint8Array ? utf8.decode(v) : String(v ?? ''));

/**
 * Lista de mídia do formato novo (protobuf MediaEntries): o arquivo "0" do
 * ZIP é a 1ª entrada, "1" a 2ª…, a não ser que a entrada diga outro número.
 * @returns {Array<{nome: string, arquivoZip: string}>}
 */
export function lerMidiaNova(bytes) {
  return (lerProtobuf(bytes).get(1) ?? []).map((entrada, i) => {
    const e = lerProtobuf(entrada);
    return { nome: texto(e.get(1)?.[0]), arquivoZip: String(e.get(255)?.[0] ?? i) };
  });
}

// ── Coleção (banco SQLite do Anki) ──────────────────────────────────────

/**
 * Lê modelos, baralhos, notas e cartões dos dois esquemas do Anki.
 * @param {(sql: string) => Array<object>} consultar  devolve linhas como objetos
 */
export function lerColecao(consultar) {
  const tabelas = new Set(consultar("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name));
  const col = consultar('SELECT * FROM col')[0] ?? {};
  const modelos = new Map();
  const decks = new Map();

  if (tabelas.has('notetypes') && consultar('SELECT count(*) AS n FROM notetypes')[0].n > 0) {
    // Esquema novo (Anki 2.1.28+): tabelas próprias, configurações em protobuf
    for (const nt of consultar('SELECT id, name, config FROM notetypes')) {
      const cfg = lerProtobuf(nt.config);
      modelos.set(String(nt.id), { nome: nt.name, cloze: cfg.get(1)?.[0] === 1, campos: [], cartoes: [] });
    }
    for (const f of consultar('SELECT ntid, ord, name FROM fields ORDER BY ntid, ord')) modelos.get(String(f.ntid))?.campos.push(f.name);
    for (const t of consultar('SELECT ntid, ord, name, config FROM templates ORDER BY ntid, ord')) {
      const cfg = lerProtobuf(t.config);
      modelos.get(String(t.ntid))?.cartoes.push({ ord: t.ord, nome: t.name, frente: texto(cfg.get(1)?.[0]), verso: texto(cfg.get(2)?.[0]) });
    }
    for (const d of consultar('SELECT id, name FROM decks')) decks.set(String(d.id), String(d.name).split('\x1f').join('::'));
  } else {
    // Esquema antigo: tudo em JSON dentro da tabela col
    for (const [id, md] of Object.entries(JSON.parse(col.models || '{}'))) {
      modelos.set(String(id), {
        nome: md.name, cloze: md.type === 1, campos: md.flds.map((f) => f.name),
        cartoes: md.tmpls.map((t) => ({ ord: t.ord, nome: t.name, frente: t.qfmt, verso: t.afmt })),
      });
    }
    for (const [id, d] of Object.entries(JSON.parse(col.decks || '{}'))) decks.set(String(id), d.name);
  }

  const notas = new Map();
  for (const n of consultar('SELECT id, guid, mid, tags, flds FROM notes')) {
    notas.set(String(n.id), { guid: n.guid, mid: String(n.mid), tags: String(n.tags).trim().split(/\s+/).filter(Boolean), campos: String(n.flds).split('\x1f') });
  }
  const temDados = consultar("SELECT count(*) AS n FROM pragma_table_info('cards') WHERE name = 'data'")[0]?.n > 0;
  const cartoes = consultar(`SELECT id, nid, did, odid, ord, type, queue, due, odue, ivl, factor, reps, lapses${temDados ? ', data' : ''} FROM cards ORDER BY nid, ord`).map((c) => ({
    id: String(c.id), nid: String(c.nid), deck: String(c.odid && c.odid !== 0 ? c.odid : c.did), ord: c.ord,
    tipo: c.type, fila: c.queue, due: c.odid && c.odid !== 0 ? c.odue : c.due, ivl: c.ivl, fator: c.factor, reps: c.reps, lapsos: c.lapses,
    dados: (() => {
      try {
        return c.data ? JSON.parse(c.data) : {};
      } catch {
        return {};
      }
    })(),
  }));
  return { crt: Number(col.crt) || 0, modelos, decks, notas, cartoes };
}

// ── HTML do Anki -> texto e imagens ─────────────────────────────────────

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
export const decodificar = (s) =>
  String(s ?? '').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTIDADES[e.toLowerCase()] ?? m;
  });

/** Imagens (<img src>) na ordem em que aparecem. */
export function extrairImagens(html) {
  return [...String(html ?? '').matchAll(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map((m) => decodificar(m[1] ?? m[2] ?? m[3]));
}

/** HTML -> texto com quebras de linha (sem scripts, estilos, sons nem imagens). */
export function htmlParaTexto(html) {
  return decodificar(
    String(html ?? '')
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/\[sound:[^\]]*\]/g, '')
      .replace(/<br\s*\/?>/gi, '\u0001') // cada <br> é uma linha
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/?(div|p|li|ul|ol|tr|table|h\d|blockquote)\b[^>]*>|<hr[^>]*>/gi, '\n') // abrir/fechar bloco: quebra só uma vez
      .replace(/<[^>]+>/g, '')
      .replace(/\n+/g, '\n')
      .replace(/\u0001/g, '\n')
  )
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Modelos de cartão (mini "mustache" do Anki) ─────────────────────────

const RE_CLOZE = /\{\{c(\d+(?:,\d+)*)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

/** Números de lacuna (c1, c2…) que aparecem num texto. */
export const numerosCloze = (t) => [...new Set([...String(t ?? '').matchAll(RE_CLOZE)].flatMap((m) => m[1].split(',').map(Number)))].sort((a, b) => a - b);

/** Aplica a lacuna "ativa" (frente: [...] ou [dica]; verso: resposta). */
export function aplicarCloze(t, ativo, lado) {
  return String(t ?? '').replace(RE_CLOZE, (_, nums, conteudo, dica) => {
    if (!nums.split(',').map(Number).includes(ativo)) return conteudo;
    return lado === 'frente' ? `[${dica ? htmlParaTexto(dica) : '...'}]` : `[${conteudo}]`;
  });
}

/**
 * Preenche um modelo de cartão do Anki: {{Campo}}, {{#Campo}}…{{/Campo}},
 * {{^Campo}}…{{/Campo}}, {{cloze:Campo}}, {{type:Campo}}, {{hint:Campo}},
 * {{text:Campo}}, {{FrontSide}} e similares.
 */
export function preencherModelo(modelo, campos, { lado, ativo = 1, frente = '', extras = {} }) {
  const valor = (nome) => {
    if (nome in extras) return extras[nome];
    if (nome in campos) return campos[nome];
    const achado = Object.keys(campos).find((k) => k.toLowerCase() === nome.toLowerCase());
    return achado ? campos[achado] : '';
  };
  const vazio = (nome) => !htmlParaTexto(valor(nome)) && !extrairImagens(valor(nome)).length;
  let t = String(modelo ?? '');
  // Seções condicionais (repete para pegar as aninhadas)
  for (let i = 0; i < 6; i++) {
    const antes = t;
    t = t.replace(/\{\{([#^])\s*([^}]+?)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g, (_, sinal, nome, dentro) => ((sinal === '#') !== vazio(nome) ? dentro : ''));
    if (t === antes) break;
  }
  return t.replace(/\{\{([^#^/{}][^{}]*?)\}\}/g, (_, expr) => {
    const partes = expr.trim().split(':');
    const nome = partes.pop().trim();
    const filtros = partes.map((f) => f.trim().toLowerCase());
    if (nome === 'FrontSide') return frente;
    if (filtros.includes('tts') || filtros.includes('tts-voices')) return '';
    let v = valor(nome);
    if (filtros.includes('cloze')) v = aplicarCloze(v, ativo, lado);
    if (filtros.includes('type')) return lado === 'verso' ? v : '';
    if (filtros.includes('hint') || filtros.includes('text')) v = htmlParaTexto(v);
    return v;
  });
}

// ── Oclusão de imagem ───────────────────────────────────────────────────

/**
 * Máscaras da oclusão nativa do Anki, do campo "Occlusion":
 * {{c1::image-occlusion:rect:left=.1:top=.2:width=.3:height=.1:oi=1}}
 * @returns {Array<{n: number[], forma: string, ...}>}
 */
export function formasOclusao(campo) {
  return [...String(campo ?? '').matchAll(/\{\{c(\d+(?:,\d+)*)::image-occlusion:(\w+):([^}]*?)\}\}/g)].map((m) => {
    const props = {};
    for (const par of m[3].split(':')) {
      const [k, ...v] = par.split('=');
      const bruto = v.join('=');
      props[k.trim()] = k.trim() === 'points' || k.trim() === 'text' ? bruto : Number(bruto);
    }
    return { n: m[1].split(',').map(Number), forma: m[2], ...props };
  });
}

const ehSvg = (nome) => /\.svg$/i.test(nome);

/** O modelo é a oclusão nativa do Anki? */
export const ehOclusaoNativa = (modelo) =>
  modelo.cloze && modelo.campos.includes('Occlusion') && modelo.campos.includes('Image');

// ── Agendamento: Anki -> FSRS do Código M ───────────────────────────────

const dataDe = (segundos) => normalizarData(new Date(segundos * 1000).toISOString().slice(0, 10));
const somarDiasISO = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Progresso do cartão no Anki convertido para o FSRS do Código M.
 * Cartão novo -> null (entra como novo). Usa a memória FSRS do Anki quando
 * existe (estabilidade "s" e dificuldade "d"); senão estima pelo intervalo
 * e pela facilidade (SM-2).
 */
export function converterAgendamento(c, crt) {
  if (!c.reps || c.tipo === 0) return null;
  const vence = c.tipo === 2
    ? somarDiasISO(dataDe(crt), c.due)
    : c.due > 1e9 ? dataDe(c.due) : somarDiasISO(dataDe(crt), c.due);
  const estabilidade = Number(c.dados?.s) || Math.max(c.ivl, 0.5);
  const dificuldade = Number(c.dados?.d) || Math.min(10, Math.max(1, 5 + (2500 - (c.fator || 2500)) / 200));
  return {
    vence,
    estabilidade: Math.round(estabilidade * 100) / 100,
    dificuldade: Math.round(dificuldade * 100) / 100,
    revisoes: c.reps,
    lapsos: c.lapsos,
    ultima: somarDiasISO(vence, -Math.max(0, c.ivl)),
  };
}

// ── Montagem dos cartões ────────────────────────────────────────────────

/**
 * Plano de imagem de um lado do cartão (desenhado depois pelo navegador):
 * { imagens: [arquivos], mascaras: [svg sobre a 1ª imagem], formas: [...], ativo, lado }
 */
function planoDeImagens(html) {
  const imgs = extrairImagens(html);
  if (!imgs.length) return null;
  const mascaras = imgs.filter(ehSvg);
  const imagens = imgs.filter((x) => !ehSvg(x));
  if (mascaras.length && imagens.length) return { imagens: [imagens[0]], mascaras };
  return { imagens: imgs, mascaras: [] };
}

/**
 * Converte a coleção em cartões do Código M.
 * @returns {Array<{ankiId, nid, deck, tags, modelo, tipo, frente, verso, imagemFrente, imagemVerso, suspenso, agendamento}>}
 */
export function montarCartoes(colecao) {
  const saida = [];
  for (const c of colecao.cartoes) {
    const nota = colecao.notas.get(c.nid);
    const modelo = nota && colecao.modelos.get(nota.mid);
    if (!modelo) continue;
    const campos = Object.fromEntries(modelo.campos.map((nome, i) => [nome, nota.campos[i] ?? '']));
    const base = {
      ankiId: `${nota.guid}:${c.ord}`, nid: c.nid, deck: colecao.decks.get(c.deck) ?? '', tags: nota.tags, modelo: modelo.nome,
      suspenso: c.fila === -1, agendamento: converterAgendamento(c, colecao.crt),
    };
    const ativo = c.ord + 1;

    if (ehOclusaoNativa(modelo)) {
      const imagem = extrairImagens(campos.Image)[0];
      const formas = formasOclusao(campos.Occlusion);
      if (!imagem || !formas.some((f) => f.n.includes(ativo))) continue;
      saida.push({
        ...base, tipo: 'oclusao',
        frente: htmlParaTexto(campos.Header) || 'O que está escondido na imagem?',
        verso: [htmlParaTexto(campos['Back Extra']), htmlParaTexto(campos.Comments)].filter(Boolean).join('\n\n'),
        imagemFrente: { imagens: [imagem], mascaras: [], formas, ativo, lado: 'frente' },
        imagemVerso: { imagens: [imagem], mascaras: [], formas, ativo, lado: 'verso' },
      });
      continue;
    }

    const molde = modelo.cloze ? modelo.cartoes[0] : modelo.cartoes.find((t) => t.ord === c.ord);
    if (!molde) continue;
    const htmlFrente = preencherModelo(molde.frente, campos, { lado: 'frente', ativo });
    // No verso, a frente não se repete (o Código M já mostra a frente antes):
    // usa o que vem depois da linha <hr id=answer>; sem a linha, tira a frente do começo.
    let htmlVerso = preencherModelo(molde.verso, campos, { lado: 'verso', ativo, frente: '' });
    const divisoria = htmlVerso.search(/<hr id=["']?answer["']?\s*\/?>/i);
    if (divisoria >= 0) htmlVerso = htmlVerso.slice(divisoria).replace(/^<hr[^>]*>/i, '');
    const frente = htmlParaTexto(htmlFrente);
    const imagemFrente = planoDeImagens(htmlFrente);
    if (!frente && !imagemFrente) continue; // cartão vazio (o Anki também não mostraria)
    const imagemVerso = planoDeImagens(htmlVerso);
    let verso = htmlParaTexto(htmlVerso);
    if (frente && !modelo.cloze && verso.startsWith(frente)) verso = verso.slice(frente.length).trim();
    saida.push({
      ...base,
      tipo: modelo.cloze ? 'cloze' : imagemFrente?.mascaras.length ? 'oclusao-complemento' : 'basico',
      frente: frente || 'O que mostra a imagem?',
      verso,
      imagemFrente,
      imagemVerso,
    });
  }
  return saida;
}

// ── Para onde vai cada baralho ──────────────────────────────────────────

const chave = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Sugere cadeira e assunto a partir do nome do baralho
 * ("Medicina::Anatomia::Coração" -> anatomia / Coração).
 * @param {Array<{id, nome}>} cadeiras
 */
export function sugerirDestino(deck, cadeiras) {
  const partes = String(deck ?? '').split('::').map((p) => p.trim()).filter(Boolean);
  for (let i = partes.length - 1; i >= 0; i--) {
    const k = chave(partes[i]);
    const cad = cadeiras.find((c) => chave(c.nome) === k) ?? cadeiras.find((c) => k.includes(chave(c.nome)) || chave(c.nome).includes(k));
    if (cad && k.length >= 3) return { cadeiraId: cad.id, assunto: partes.slice(i + 1).join(' — ') };
  }
  return { cadeiraId: '', assunto: partes.length > 1 ? partes[partes.length - 1] : '' };
}
