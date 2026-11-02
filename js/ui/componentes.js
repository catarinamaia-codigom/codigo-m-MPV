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
