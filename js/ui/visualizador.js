// Visualizador lateral: assiste a gravações e vídeos do YouTube e lê PDFs e
// documentos do Drive sem sair do Código M. Fica à direita (no celular, na
// parte de baixo) e a página continua usável ao lado — dá para anotar dúvidas
// enquanto assiste. Continua aberto ao trocar de tela; fecha no X.

import { esc } from '../util/texto.js';
import { icone } from './icones.js';
import { aviso } from './componentes.js';

/**
 * @param {object} o
 * @param {string} o.titulo
 * @param {{tipo: 'youtube'|'drive', url: string}} o.forma  (de drive.formaDeVer)
 * @param {string} [o.link]           abrir em outra aba
 * @param {string} [o.contexto]       ex.: "Anatomia 1M · Coração"
 * @param {() => Promise<void>} [o.aoBaixar]
 * @param {() => void} [o.aoNovaDuvida]
 * @param {() => Promise<boolean>} [o.aoExcluir]  true = excluído (fecha o painel)
 */
export function abrirVisualizador({ titulo, forma, link = '', contexto = '', aoBaixar, aoNovaDuvida, aoExcluir }) {
  fecharVisualizador();
  const painel = document.createElement('aside');
  painel.className = `visualizador vis-${forma.tipo}`;
  painel.setAttribute('aria-label', `Visualizando: ${titulo}`);
  painel.innerHTML = `
    <header class="vis-topo">
      <div class="vis-titulo"><strong title="${esc(titulo)}">${esc(titulo)}</strong>${contexto ? `<small class="meta">${esc(contexto)}</small>` : ''}</div>
      <button class="btn-icone" data-vis-largura title="Painel mais largo / mais estreito" aria-label="Mudar largura do painel">${icone('seta', 'ic-mini')}</button>
      <button class="btn-icone" data-vis-fechar title="Fechar" aria-label="Fechar visualizador">${icone('fechar')}</button>
    </header>
    <div class="vis-quadro">
      <iframe src="${esc(forma.url)}" title="${esc(titulo)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>
    <div class="vis-acoes">
      ${aoNovaDuvida ? `<button class="btn" data-vis-duvida>${icone('duvidas', 'ic-mini')} + Dúvida</button>` : ''}
      ${aoBaixar ? `<button class="btn" data-vis-baixar>${icone('baixar', 'ic-mini')} Baixar</button>` : ''}
      ${link ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener">${icone('externo', 'ic-mini')} Abrir em outra aba</a>` : ''}
      ${aoExcluir ? `<button class="btn btn-perigo" data-vis-excluir>${icone('lixeira', 'ic-mini')} Excluir</button>` : ''}
    </div>
    ${forma.tipo === 'drive' ? '<p class="vis-nota meta">Se o arquivo não aparecer, confira se o navegador está com a mesma conta Google do Código M.</p>' : ''}`;
  document.body.appendChild(painel);
  document.body.classList.add('com-visualizador');

  painel.querySelector('[data-vis-fechar]').addEventListener('click', fecharVisualizador);
  painel.querySelector('[data-vis-largura]').addEventListener('click', () => painel.classList.toggle('largo'));
  painel.querySelector('[data-vis-duvida]')?.addEventListener('click', aoNovaDuvida);
  painel.querySelector('[data-vis-baixar]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      await aoBaixar();
    } catch (erro) {
      aviso(erro.message);
    } finally {
      b.disabled = false;
    }
  });
  painel.querySelector('[data-vis-excluir]')?.addEventListener('click', async () => {
    if (await aoExcluir()) fecharVisualizador();
  });
}

export function fecharVisualizador() {
  document.querySelector('.visualizador')?.remove();
  document.body.classList.remove('com-visualizador');
}
