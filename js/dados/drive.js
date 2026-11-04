// Google Drive — o Código M é a interface; o Drive é onde os arquivos moram.
// Cria as pastas que faltam (por nome, dentro da pasta-mãe, sem duplicar),
// envia arquivos para o lugar certo, move quando a classificação muda e
// lê imagens para mostrar nos cartões. Tudo com o login feito no navegador.
//
// Destinos (iguais aos do script do Classroom e às Convenções do Estúdio):
//   reaproveitável  -> 20-Medicina/Conhecimento/[Cadeira]/[Assunto]/
//   da turma        -> .../[Assunto]/[Turma]/
//   prints          -> .../[Assunto]/[Caderno de erros] | [Cartoes] | [Duvidas]
//   sem assunto     -> 20-Medicina/Conhecimento/[Cadeira]/[_A-classificar]/
//   datado          -> 20-Medicina/Periodos/[1M] [2026.2]/[Cadeira]/[Avaliacoes] | [Atividades]

import { GOOGLE } from '../config.js';
import * as google from './google.js';
import { semAcentos } from '../util/texto.js';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const PASTA = 'application/vnd.google-apps.folder';
const cachePastas = new Map(); // "paiId|nome" -> id

export class ErroDrive extends Error {}

/** Bloco de nome com a regra dos colchetes, sem acentos nem caracteres proibidos. */
export const bloco = (t) => `[${semAcentos(t).replace(/[\\/:*?"<>|[\]]/g, ' ').replace(/\s+/g, ' ').trim()}]`;

/**
 * Caminho de destino (lista de nomes de pasta) a partir da raiz indicada.
 * Função pura: usada na prévia do destino e no envio.
 * @returns {{raiz: 'conhecimento'|'periodos', pastas: string[]}}
 */
export function destino({ periodo, semestre, cadeira, assunto, categoria = 'material', origem = 'Minha' }) {
  const cad = bloco(cadeira || 'Sem cadeira');
  semestre ||= semestreDoPeriodo(periodo);
  if (categoria === 'avaliacao' || categoria === 'atividade') {
    return { raiz: 'periodos', pastas: [`${bloco(periodo)} ${bloco(semestre)}`, cad, categoria === 'avaliacao' ? '[Avaliacoes]' : '[Atividades]'] };
  }
  if (!assunto) return { raiz: 'conhecimento', pastas: [cad, '[_A-classificar]'] };
  const sub = { questao: '[Caderno de erros]', cartao: '[Cartoes]', duvida: '[Duvidas]' }[categoria];
  return { raiz: 'conhecimento', pastas: [cad, bloco(assunto), ...(sub ? [sub] : origem === 'Turma' ? ['[Turma]'] : [])] };
}

/** 1M -> 2026.2, 2M -> 2027.1, 3M -> 2027.2 … (DC-26-003) */
export function semestreDoPeriodo(periodo) {
  const n = parseInt(String(periodo), 10);
  if (!n) return '';
  const t = 2026 * 2 + 1 + (n - 1);
  return `${Math.floor(t / 2)}.${(t % 2) + 1}`;
}

/** Texto do caminho para mostrar na tela. */
export const textoDestino = (d) => `20-Medicina/${d.raiz === 'periodos' ? 'Periodos' : 'Conhecimento'}/${d.pastas.join('/')}/`;

async function req(url, { method = 'GET', body, headers = {}, bruto = false } = {}) {
  const token = google.tokenAtual();
  if (!token) throw new ErroDrive('Entre com Google para usar o Drive.');
  if (!google.temDrive()) throw new ErroDrive('Falta a permissão do Drive. Saia e entre com Google de novo, marcando o Drive.');
  const resp = await fetch(url, { method, body, headers: { Authorization: `Bearer ${token}`, ...headers } });
  if (resp.status === 401) throw new ErroDrive('O login expirou. Entre com Google de novo.');
  if (resp.status === 403) {
    let msg = '';
    try {
      msg = (await resp.json())?.error?.message ?? '';
    } catch {
      /* sem corpo */
    }
    throw new ErroDrive(/has not been used|is disabled/i.test(msg)
      ? 'A API do Google Drive ainda não está ativada no projeto do Google Cloud.'
      : `O Drive recusou a operação (sem permissão). ${msg}`.trim());
  }
  if (!resp.ok) throw new ErroDrive(`Erro no Drive (${resp.status}).`);
  return bruto ? resp : resp.status === 204 ? null : resp.json();
}

const aspas = (t) => String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/** Acha uma pasta pelo nome dentro da pasta-mãe; cria se não existir. */
export async function garantirPasta(nome, paiId) {
  const chave = `${paiId}|${nome}`;
  if (cachePastas.has(chave)) return cachePastas.get(chave);
  const q = `name = '${aspas(nome)}' and '${paiId}' in parents and mimeType = '${PASTA}' and trashed = false`;
  const { files = [] } = await req(`${API}?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`);
  let id = files[0]?.id;
  if (!id) {
    const criada = await req(`${API}?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [paiId] }),
    });
    id = criada.id;
  }
  cachePastas.set(chave, id);
  return id;
}

/** Garante o caminho inteiro e devolve o ID da última pasta. */
export async function garantirCaminho(d) {
  let pai = GOOGLE.pastas[d.raiz];
  for (const nome of d.pastas) pai = await garantirPasta(nome, pai);
  return pai;
}

/** SHA-256 dos bytes (reconhece reenvio do mesmo arquivo). */
export async function hashArquivo(arquivo) {
  const buf = await arquivo.arrayBuffer();
  const dig = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Envia um arquivo para a pasta. Só devolve depois que o Drive responde
 * com o ID real do arquivo.
 * @returns {Promise<{id, name, webViewLink}>}
 */
export async function enviar(arquivo, { pastaId, nome, descricao = '', hash = '' }) {
  const campos = 'id,name,webViewLink,mimeType';
  // Reenvio (inclusive depois de uma falha de rede): se o Drive já tem estes bytes, usa o mesmo arquivo
  if (hash) {
    const q = `appProperties has { key='codigom_hash' and value='${hash}' } and trashed = false`;
    const { files = [] } = await req(`${API}?q=${encodeURIComponent(q)}&fields=files(${campos})&pageSize=1`);
    if (files[0]) return { ...files[0], jaExistia: true };
  }
  const meta = { name: nome, parents: [pastaId], description: descricao, mimeType: arquivo.type || undefined, appProperties: hash ? { codigom_hash: hash } : undefined };
  if (arquivo.size <= 5 * 1024 * 1024) {
    const fd = new FormData();
    fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    fd.append('file', arquivo);
    return req(`${UPLOAD}?uploadType=multipart&fields=${campos}`, { method: 'POST', body: fd });
  }
  // Arquivo grande (gravações): envio em sessão retomável
  const inicio = await req(`${UPLOAD}?uploadType=resumable&fields=${campos}`, {
    method: 'POST',
    bruto: true,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': arquivo.type || 'application/octet-stream' },
    body: JSON.stringify(meta),
  });
  const sessao = inicio.headers.get('Location');
  if (!sessao) throw new ErroDrive('O Drive não abriu a sessão de envio.');
  const resp = await fetch(sessao, { method: 'PUT', body: arquivo });
  if (!resp.ok) throw new ErroDrive(`O envio parou (${resp.status}). Tente de novo: o arquivo não será duplicado.`);
  return resp.json();
}

/** Move um arquivo para outra pasta (quando a classificação muda). */
export async function mover(arquivoId, novaPastaId) {
  const atual = await req(`${API}/${arquivoId}?fields=parents`);
  const remover = (atual.parents ?? []).join(',');
  return req(`${API}/${arquivoId}?addParents=${novaPastaId}&removeParents=${remover}&fields=id,webViewLink`, { method: 'PATCH' });
}

/** Confere se as pastas do Estúdio estão acessíveis (Configurações). */
export async function testar() {
  const r = await req(`${API}/${GOOGLE.pastas.medicina}?fields=id,name,capabilities(canAddChildren)`);
  if (!r.capabilities?.canAddChildren) throw new ErroDrive('Sem permissão de criar itens em 20-Medicina.');
  return r.name;
}

const imagens = new Map();
/** URL local de uma imagem do Drive (lida com o login), para mostrar na tela. */
export async function urlImagem(id) {
  if (!id) return '';
  if (/^(blob:|data:|https?:)/.test(id)) return id;
  if (!imagens.has(id)) {
    imagens.set(id, req(`${API}/${id}?alt=media`, { bruto: true }).then(async (r) => URL.createObjectURL(await r.blob())));
  }
  return imagens.get(id);
}

/** Link para abrir um arquivo do Drive pelo ID. */
export const linkDrive = (id) => (id ? `https://drive.google.com/file/d/${id}/view` : '');

/** Mostra as imagens marcadas com data-imagem-drive dentro de "el". */
export function mostrarImagens(el) {
  el.querySelectorAll('img[data-imagem-drive]').forEach(async (img) => {
    try {
      img.src = await urlImagem(img.dataset.imagemDrive);
    } catch {
      img.replaceWith(Object.assign(document.createElement('span'), { className: 'meta', textContent: 'Imagem no Drive (entre com Google para ver)' }));
    }
  });
}
