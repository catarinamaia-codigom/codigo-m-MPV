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
