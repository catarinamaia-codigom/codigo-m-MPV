// Peças de interface reutilizáveis: aviso rápido (toast), janela (modal),
// cartões e estados vazios.

import { esc } from '../util/texto.js';
import { icone } from './icones.js';

let timerAviso;
export function aviso(texto) {
  let el = document.getElementById('aviso');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aviso';
    el.className = 'aviso';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = texto;
  el.classList.add('visivel');
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove('visivel'), 3200);
}

export function abrirModal(titulo, corpoHtml) {
  fecharModal();
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  fundo.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
      <div class="modal-topo">
        <h2 id="modal-titulo">${esc(titulo)}</h2>
        <button class="btn-icone" data-fechar aria-label="Fechar">${icone('fechar')}</button>
      </div>
      <div class="modal-corpo">${corpoHtml}</div>
    </div>`;
  fundo.addEventListener('click', (e) => {
    if (e.target === fundo || e.target.closest('[data-fechar]')) fecharModal();
  });
  document.body.appendChild(fundo);
  fundo.querySelector('[data-fechar]').focus();
}

export function fecharModal() {
  document.querySelector('.modal-fundo')?.remove();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharModal();
});

export function cartao({ titulo, iconeNome, extra = '', corpo, classe = '' }) {
  return `
    <section class="cartao ${classe}">
      <header class="cartao-topo">
        <h2>${icone(iconeNome)}<span>${esc(titulo)}</span></h2>
        ${extra}
      </header>
      <div class="cartao-corpo">${corpo}</div>
    </section>`;
}

export function vazio(texto) {
  return `<p class="vazio">${esc(texto)}</p>`;
}

export async function copiar(texto, mensagem = 'Copiado!') {
  try {
    await navigator.clipboard.writeText(texto);
    aviso(mensagem);
    return true;
  } catch {
    abrirModal('Copie o texto abaixo', `<textarea class="copia-manual" readonly>${esc(texto)}</textarea>`);
    document.querySelector('.copia-manual')?.select();
    return false;
  }
}

/** Número em destaque, clicável quando tem href. tom: '' | 'alerta' | 'ok' */
export function kpi({ rotulo, valor, sub = '', href = '', tom = '', iconeNome = '' }) {
  const tag = href ? 'a' : 'div';
  return `<${tag} class="kpi ${tom ? `kpi-${tom}` : ''}" ${href ? `href="${href}"` : ''}>
    <span class="kpi-rotulo">${iconeNome ? icone(iconeNome, 'ic-mini') : ''}${esc(rotulo)}</span>
    <strong class="kpi-valor">${esc(valor)}</strong>
    ${sub ? `<span class="kpi-sub">${esc(sub)}</span>` : ''}
  </${tag}>`;
}

/** Grupo de botões de filtro. Cada botão leva data-filtro="nome" e data-valor. */
export function chips(nome, opcoes, atual) {
  return `<div class="chips" role="group">${opcoes
    .map((o) => {
      const [valor, texto] = Array.isArray(o) ? o : [o, o];
      return `<button class="chip ${String(valor) === String(atual) ? 'ativo' : ''}" data-filtro="${esc(nome)}" data-valor="${esc(valor)}" aria-pressed="${String(valor) === String(atual)}">${esc(texto)}</button>`;
    })
    .join('')}</div>`;
}

/** <select> de cadeira para filtros (valor '' = todas). */
export function seletorCadeira(m, atual, { nome = 'cadeira', todas = 'Todas as cadeiras' } = {}) {
  return `<select class="filtro-select" data-filtro-select="${esc(nome)}" aria-label="Cadeira">
    <option value="">${esc(todas)}</option>
    ${m.cadeiras.map((c) => `<option value="${esc(c.id)}" ${c.id === atual ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
  </select>`;
}

/** Liga chips e selects de filtro a um objeto de estado; chama redesenhar() ao mudar. */
export function ligarFiltros(el, estado, redesenhar) {
  el.querySelectorAll('[data-filtro]').forEach((b) =>
    b.addEventListener('click', () => {
      estado[b.dataset.filtro] = b.dataset.valor;
      redesenhar();
    })
  );
  el.querySelectorAll('[data-filtro-select]').forEach((s) =>
    s.addEventListener('change', () => {
      estado[s.dataset.filtroSelect] = s.value;
      redesenhar();
    })
  );
  el.querySelectorAll('[data-filtro-texto]').forEach((i) => {
    let t;
    i.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        estado[i.dataset.filtroTexto] = i.value;
        redesenhar();
        const novo = el.querySelector(`[data-filtro-texto="${i.dataset.filtroTexto}"]`);
        novo?.focus();
        novo?.setSelectionRange(novo.value.length, novo.value.length);
      }, 250);
    });
  });
}

/** Barra horizontal simples (0–1). */
export function barra(fracao, tom = '') {
  const pct = Math.round(Math.max(0, Math.min(1, fracao || 0)) * 100);
  return `<span class="barra-mini ${tom}" role="img" aria-label="${pct}%"><span style="width:${pct}%"></span></span>`;
}

/** Selo do nível de domínio (0–5). */
export function seloDominio(d) {
  return `<span class="dominio d${d.nivel}" title="${esc(d.motivo ?? '')}">${'●'.repeat(d.nivel)}${'○'.repeat(5 - d.nivel)}<span class="dominio-nome">${esc(d.nome ?? '')}</span></span>`;
}

/** Texto com busca simples (sem acentos, minúsculas). */
export const casa = (texto, termo) =>
  !termo ||
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .includes(String(termo).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim());

const CHAVE_RECOLHIDOS = 'codigom.recolhidos';
const lerRecolhidos = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_RECOLHIDOS) || '{}');
  } catch {
    return {};
  }
};
/** Aberto/fechado lembrado neste navegador (só conforto de tela). */
export function estaAberto(chave, padrao = true) {
  const v = lerRecolhidos()[chave];
  return v === undefined ? padrao : v;
}
export function lembrarAberto(el) {
  el.querySelectorAll('details[data-lembrar]').forEach((d) =>
    d.addEventListener('toggle', () => {
      try {
        const r = lerRecolhidos();
        r[d.dataset.lembrar] = d.open;
        localStorage.setItem(CHAVE_RECOLHIDOS, JSON.stringify(r));
      } catch {
        /* sem armazenamento */
      }
    })
  );
}

/** Cartão que abre e fecha (lembra o estado). "extra" fica à direita do título. */
export function cartaoRecolhivel({ titulo, iconeNome, corpo, extra = '', chave, aberto = true, contagem = '', classe = '' }) {
  return `
    <details class="cartao recolhivel ${classe}" data-lembrar="${esc(chave)}" ${estaAberto(chave, aberto) ? 'open' : ''}>
      <summary class="cartao-topo">
        <h2>${icone(iconeNome)}<span>${esc(titulo)}</span>${contagem !== '' ? `<small class="contagem-titulo">${esc(contagem)}</small>` : ''}</h2>
        <span class="cartao-extras">${extra}<span class="seta-recolher">${icone('proximo', 'ic-mini')}</span></span>
      </summary>
      <div class="cartao-corpo">${corpo}</div>
    </details>`;
}

/** Botão "+" pequeno ao lado do título de uma seção. */
export const botaoMais = (acao, rotulo) => `<button class="btn-mais" data-mais="${esc(acao)}" title="${esc(rotulo)}" aria-label="${esc(rotulo)}">+</button>`;

/** Impede que cliques em botões do título abram/fechem o cartão. */
export function botoesNoTitulo(el) {
  el.querySelectorAll('summary button, summary a, summary input').forEach((b) => b.addEventListener('click', (e) => e.stopPropagation()));
}
