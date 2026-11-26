// Abre um baralho do Anki (.apkg / .colpkg) no navegador, sem servidor e sem IA.
// O .apkg é um ZIP com o banco SQLite da coleção e as imagens numeradas.
// Formato novo (Anki 2.1.50+): banco e imagens compactados com zstd.
// Bibliotecas (MIT) ficam em js/vendor e só carregam na hora de importar.

import { lerColecao, lerMidiaNova } from '../regras/anki.js';

const ZSTD = [0x28, 0xb5, 0x2f, 0xfd];
const ehZstd = (b) => b && b.length > 4 && ZSTD.every((x, i) => b[i] === x);

let libs = null;
/** Carrega fflate (ZIP), fzstd (zstd) e sql.js (SQLite em WebAssembly). */
export async function carregarBibliotecas() {
  if (libs) return libs;
  const [{ unzipSync }, { decompress }] = await Promise.all([import('../vendor/fflate.mjs'), import('../vendor/fzstd.mjs')]);
  if (!window.initSqlJs) {
    await new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/sql-wasm.js', import.meta.url).href;
      s.onload = ok;
      s.onerror = () => erro(new Error('Não consegui carregar o leitor de baralhos do Anki.'));
      document.head.appendChild(s);
    });
  }
  const SQL = await window.initSqlJs({ locateFile: (f) => new URL(`../vendor/${f}`, import.meta.url).href });
  libs = { unzipSync, decompress, SQL };
  return libs;
}

/**
 * Lê os bytes de um .apkg/.colpkg.
 * @param {Uint8Array} bytes
 * @param {{unzipSync, decompress, SQL}} l  bibliotecas (injetáveis para testes)
 * @returns {{colecao, midia: Map<string, Uint8Array>, formato: string}}
 */
export function lerApkg(bytes, { unzipSync, decompress, SQL }) {
  let zip;
  try {
    zip = unzipSync(bytes);
  } catch {
    throw new Error('Este arquivo não parece um baralho do Anki (.apkg ou .colpkg).');
  }
  const abrir = (b) => (ehZstd(b) ? decompress(b) : b);
  // O formato novo também traz um "collection.anki2" falso (que pede para atualizar o Anki)
  const nomeBanco = ['collection.anki21b', 'collection.anki21', 'collection.anki2'].find((n) => zip[n]);
  if (!nomeBanco) throw new Error('Não achei a coleção dentro do arquivo. Exporte de novo pelo Anki (Arquivo › Exportar › .apkg).');

  let db = new SQL.Database(abrir(zip[nomeBanco]));
  // O Anki usa uma ordenação de texto própria ("unicase"): tira do esquema para o SQLite comum conseguir ler
  try {
    db.exec("PRAGMA writable_schema = ON; UPDATE sqlite_master SET sql = replace(sql, ' COLLATE unicase', '') WHERE sql LIKE '%unicase%'; PRAGMA writable_schema = OFF;");
    const limpo = db.export();
    db.close();
    db = new SQL.Database(limpo);
  } catch {
    /* banco antigo, sem unicase */
  }
  const consultar = (sql) => {
    const r = db.exec(sql)[0];
    return r ? r.values.map((linha) => Object.fromEntries(r.columns.map((c, i) => [c, linha[i]]))) : [];
  };
  let colecao;
  try {
    colecao = lerColecao(consultar);
  } finally {
    db.close();
  }

  const midia = new Map();
  if (zip.media) {
    const bruto = abrir(zip.media);
    const lista = bruto[0] === 0x7b // "{" = JSON do formato antigo
      ? Object.entries(JSON.parse(new TextDecoder().decode(bruto))).map(([arquivoZip, nome]) => ({ nome, arquivoZip }))
      : lerMidiaNova(bruto);
    for (const { nome, arquivoZip } of lista) if (zip[arquivoZip]) midia.set(nome, abrir(zip[arquivoZip]));
  }
  return { colecao, midia, formato: nomeBanco === 'collection.anki21b' ? 'novo' : 'antigo' };
}

/** Abre o arquivo escolhido pela pessoa. */
export async function abrirApkg(arquivo) {
  const l = await carregarBibliotecas();
  return lerApkg(new Uint8Array(await arquivo.arrayBuffer()), l);
}

// ── Desenho das imagens (oclusão, máscaras SVG, várias imagens) ─────────

const TIPOS = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif' };
const tipoDe = (nome) => TIPOS[(nome.split('.').pop() || '').toLowerCase()] ?? 'application/octet-stream';
const COR_ATIVA = '#ff8e8e';
const COR_INATIVA = '#ffeba2';
const COR_BORDA = '#212121';

function carregarImagem(bytes, nome) {
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: tipoDe(nome) }));
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => erro(new Error(`Não consegui abrir a imagem ${nome}.`));
    img.src = url;
  });
}

/** Desenha uma máscara da oclusão nativa (coordenadas de 0 a 1 ou em pixels). */
function desenharForma(ctx, f, W, H, { preencher, contorno }) {
  const emPixels = [f.left, f.top, f.width, f.height].some((v) => v > 1.5);
  const x = (v) => (emPixels ? v : v * W);
  const y = (v) => (emPixels ? v : v * H);
  ctx.save();
  ctx.lineWidth = Math.max(2, W / 300);
  ctx.strokeStyle = contorno ?? COR_BORDA;
  ctx.fillStyle = preencher ?? 'transparent';
  ctx.translate(x(f.left || 0), y(f.top || 0));
  if (f.angle) ctx.rotate((f.angle * Math.PI) / 180);
  ctx.beginPath();
  if (f.forma === 'rect') ctx.rect(0, 0, x(f.width), y(f.height));
  else if (f.forma === 'ellipse') ctx.ellipse(x(f.rx), y(f.ry), x(f.rx), y(f.ry), 0, 0, Math.PI * 2);
  else if (f.forma === 'polygon') {
    ctx.translate(-x(f.left || 0), -y(f.top || 0));
    String(f.points || '').trim().split(/\s+/).forEach((par, i) => {
      const [px, py] = par.split(',').map(Number);
      ctx[i ? 'lineTo' : 'moveTo'](x(px), y(py));
    });
    ctx.closePath();
  } else if (f.forma === 'text') {
    ctx.fillStyle = '#000';
    ctx.font = `${Math.round((f.fontSize || 0.04) * (f.fontSize > 1.5 ? 1 : H))}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(decodeURIComponent(String(f.text ?? '')), 0, 0);
    ctx.restore();
    return;
  }
  if (preencher) ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Transforma o plano de imagem de um lado do cartão num arquivo PNG.
 * Uma imagem só, sem máscaras: devolve o arquivo original (sem perder qualidade).
 * @returns {Promise<File|null>}
 */
export async function desenharPlano(plano, midia, nomeArquivo) {
  if (!plano) return null;
  const disponiveis = plano.imagens.filter((n) => midia.has(n));
  if (!disponiveis.length) return null;
  const simples = disponiveis.length === 1 && !plano.mascaras?.length && !plano.formas?.length;
  if (simples) return new File([midia.get(disponiveis[0])], `${nomeArquivo}.${disponiveis[0].split('.').pop()}`, { type: tipoDe(disponiveis[0]) });

  const imgs = await Promise.all(disponiveis.map((n) => carregarImagem(midia.get(n), n)));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (plano.mascaras?.length || plano.formas?.length) {
    const base = imgs[0];
    canvas.width = base.naturalWidth;
    canvas.height = base.naturalHeight;
    ctx.drawImage(base, 0, 0);
    for (const nome of plano.mascaras ?? []) {
      if (!midia.has(nome)) continue;
      ctx.drawImage(await carregarImagem(midia.get(nome), nome), 0, 0, canvas.width, canvas.height);
    }
    for (const f of plano.formas ?? []) {
      const ativa = f.n.includes(plano.ativo);
      const escondeTodas = f.oi === 1;
      if (f.forma === 'text') desenharForma(ctx, f, canvas.width, canvas.height, {});
      else if (plano.lado === 'frente') {
        if (ativa) desenharForma(ctx, f, canvas.width, canvas.height, { preencher: COR_ATIVA });
        else if (escondeTodas) desenharForma(ctx, f, canvas.width, canvas.height, { preencher: COR_INATIVA });
      } else if (ativa) desenharForma(ctx, f, canvas.width, canvas.height, { contorno: '#c8102e' }); // revelada: só o contorno
      else if (escondeTodas) desenharForma(ctx, f, canvas.width, canvas.height, { preencher: COR_INATIVA });
    }
  } else {
    // Várias imagens: empilha uma embaixo da outra
    const largura = Math.min(1600, Math.max(...imgs.map((i) => i.naturalWidth)));
    const alturas = imgs.map((i) => Math.round((i.naturalHeight * Math.min(largura, i.naturalWidth)) / i.naturalWidth));
    canvas.width = largura;
    canvas.height = alturas.reduce((s, h) => s + h, 0) + 8 * (imgs.length - 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let yAtual = 0;
    imgs.forEach((img, i) => {
      const w = Math.min(largura, img.naturalWidth);
      ctx.drawImage(img, (largura - w) / 2, yAtual, w, alturas[i]);
      yAtual += alturas[i] + 8;
    });
  }
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
  return new File([blob], `${nomeArquivo}.png`, { type: 'image/png' });
}
