// Tela padrão para os itens do menu que ainda não foram construídos.

import { esc } from '../util/texto.js';
import { icone } from '../ui/icones.js';

export function render(el, _m, _params, item) {
  el.innerHTML = `
    <div class="em-breve">
      <span class="em-breve-icone">${icone(item.icone)}</span>
      <h1>${esc(item.nome)}</h1>
      <p class="em-breve-selo">Em breve</p>
      <p>${esc(item.resumo ?? '')}</p>
      <a class="btn" href="#/inicio">${icone('inicio')} Voltar ao Início</a>
    </div>`;
}
