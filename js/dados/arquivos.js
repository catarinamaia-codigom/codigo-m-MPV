// Guarda um arquivo escolhido no Código M no lugar certo do Drive.
// No modo simulação o arquivo fica só nesta aba (nada vai ao Drive).

import { emSimulacao } from './dataSource.js';
import * as google from './google.js';
import { destino, textoDestino, garantirCaminho, enviar, hashArquivo, mover } from './drive.js';
import { cadeiraPorId, moduloPorId, periodoCadeira } from './consultas.js';
import { nomeArquivo } from '../util/texto.js';

const nomeBase = (m, id) => cadeiraPorId(m, id)?.nome ?? moduloPorId(m, id)?.nome ?? '';

/** Destino de um item (para a prévia e para o envio). */
export function destinoDe(m, { cadeiraId, assunto = '', categoria = 'material', origem = 'Minha' }) {
  return destino({ periodo: periodoCadeira(m, cadeiraId), cadeira: nomeBase(m, cadeiraId), assunto, categoria, origem });
}

/** HTML curto da prévia do destino, mostrado nos formulários. */
export function previaDestino(m, opcoes) {
  if (!opcoes.cadeiraId) return '<span class="meta">Escolha a cadeira para ver onde o arquivo vai ficar.</span>';
  const d = destinoDe(m, opcoes);
  const aviso = emSimulacao()
    ? ' <em>(simulação: não vai ao Drive)</em>'
    : google.temDrive() ? '' : ' <em class="alerta-texto">(falta a permissão do Drive no login)</em>';
  return `<span class="previa-destino">Vai para <code>${textoDestino(d)}</code>${aviso}</span>`;
}

/**
 * Envia o arquivo e devolve {id, link, nome, hash, destino}. Só retorna
 * depois que o Drive devolve o ID real.
 */
export async function guardarArquivo(m, arquivo, { cadeiraId, assunto = '', categoria = 'material', origem = 'Minha', tipo = 'Arquivo', data, sufixo = '', progresso = () => {} }) {
  if (!arquivo) return null;
  const ext = (arquivo.name.match(/\.([a-z0-9]+)$/i)?.[1] || arquivo.type.split('/')[1] || 'bin').toLowerCase();
  const nome = nomeArquivo({
    periodo: periodoCadeira(m, cadeiraId), tipo, cadeira: nomeBase(m, cadeiraId), assunto: assunto || 'Sem assunto',
    data: data || m.hoje, aluna: m.config.aluna, ext,
  }).replace(/\.[^.]+$/, (e) => (sufixo ? ` [${sufixo}]${e}` : e));
  if (emSimulacao()) return { id: URL.createObjectURL(arquivo), link: '', nome, hash: '', destino: 'simulação', simulado: true };
  if (!google.temDrive()) {
    throw new Error('Para guardar arquivos no Drive, saia e entre com Google de novo, marcando a permissão do Drive. Enquanto isso, você pode colar um link.');
  }
  progresso('Conferindo…');
  const hash = await hashArquivo(arquivo);
  const d = destinoDe(m, { cadeiraId, assunto, categoria, origem });
  progresso('Criando pastas…');
  const pastaId = await garantirCaminho(d);
  progresso('Enviando ao Drive…');
  const r = await enviar(arquivo, { pastaId, nome, hash, descricao: `Código M · ${arquivo.name}` });
  if (!r?.id) throw new Error('O Drive não confirmou o envio. Tente de novo.');
  return { id: r.id, link: r.webViewLink, nome: r.name, hash, destino: textoDestino(d), jaExistia: r.jaExistia };
}

/** Move o arquivo de um material quando a cadeira, o assunto ou a origem mudam. */
export async function reclassificar(m, driveId, opcoes) {
  if (!driveId || emSimulacao() || !google.temDrive()) return null;
  const pastaId = await garantirCaminho(destinoDe(m, opcoes));
  return mover(driveId, pastaId);
}

/** Papel de quem entrou: 'dona', 'leitura' ou 'colaboradora' (aba Convites). */
export function papelAtual(m) {
  const email = google.emailAtual();
  const c = email && m.convites.find((x) => x.email === email);
  return c ? { papel: c.papel === 'colaboradora' ? 'colaboradora' : 'leitura', sigla: c.sigla || 'C', nome: c.nome || email } : { papel: 'dona' };
}

const paraBase64 = (arquivo) =>
  new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => erro(new Error('Não consegui ler o arquivo.'));
    r.readAsDataURL(arquivo);
  });

/**
 * Colaboradora: envia pela caixa de envio (script na conta da Catarina).
 * O arquivo nasce no Drive da Catarina, com a sigla no início do nome.
 */
export async function enviarPelaCaixa(m, arquivo, { cadeiraId, assunto = '', tipo = 'Arquivo', titulo = '', obs = '', progresso = () => {} }) {
  if (!m.config.caixaUrl) throw new Error('A caixa de envio ainda não foi ligada pela Catarina (Configurações).');
  if (arquivo.size > 35 * 1024 * 1024) throw new Error('Arquivo maior que 35 MB. Envie um arquivo menor.');
  progresso('Preparando…');
  const hash = await hashArquivo(arquivo);
  const ext = (arquivo.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'bin').toLowerCase();
  const p = papelAtual(m);
  const nomeArq = nomeArquivo({ periodo: periodoCadeira(m, cadeiraId), tipo, cadeira: nomeBase(m, cadeiraId), assunto: assunto || 'Sem assunto', data: m.hoje, aluna: p.nome.split(/[\s@]/)[0], ext });
  progresso('Enviando…');
  const resp = await fetch(m.config.caixaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: google.tokenAtual(), arquivo: await paraBase64(arquivo), tipoMime: arquivo.type, nomeArquivo: nomeArq, nomeOriginal: arquivo.name,
      hash, cadeiraId, cadeira: nomeBase(m, cadeiraId), assunto, tipo, titulo, obs,
    }),
  });
  const r = await resp.json().catch(() => ({ ok: false, erro: 'A caixa de envio não respondeu.' }));
  if (!r.ok) throw new Error(r.erro || 'Não enviou.');
  return r;
}
