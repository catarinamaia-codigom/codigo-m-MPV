// Formulário em janela (modal) gerado a partir de uma lista de campos.
// Usado por "+ Avaliação", "+ Estudo" e "+ Pendência".

import { esc } from '../util/texto.js';
import { abrirModal, fecharModal } from './componentes.js';

/**
 * @param {object} opcoes
 * @param {string} opcoes.titulo
 * @param {Array<{nome, rotulo, tipo?, opcoes?, obrigatorio?, valor?, dica?}>} opcoes.campos
 *        tipo: text (padrão) | date | time | select | textarea
 *        opcoes (select): [{valor, texto}]
 * @param {(valores: object) => Promise<void>} opcoes.aoSalvar
 */
export function abrirFormulario({ titulo, campos, aoSalvar, textoBotao = 'Salvar' }) {
  const campo = (c) => {
    const id = `f-${c.nome}`;
    const req = c.obrigatorio ? 'required' : '';
    const valor = esc(c.valor ?? '');
    let entrada;
    if (c.tipo === 'select') {
      entrada = `<select id="${id}" name="${c.nome}" ${req}>
        ${c.opcoes.map((o) => `<option value="${esc(o.valor)}" ${o.valor === c.valor ? 'selected' : ''}>${esc(o.texto)}</option>`).join('')}
      </select>`;
    } else if (c.tipo === 'textarea') {
      entrada = `<textarea id="${id}" name="${c.nome}" rows="3" ${req}>${valor}</textarea>`;
    } else {
      entrada = `<input id="${id}" name="${c.nome}" type="${c.tipo ?? 'text'}" value="${valor}" ${req}>`;
    }
    return `
      <div class="campo ${c.largo ? 'largo' : ''}">
        <label for="${id}">${esc(c.rotulo)}${c.obrigatorio ? '' : ' <small>(opcional)</small>'}</label>
        ${entrada}
        ${c.dica ? `<small class="dica">${esc(c.dica)}</small>` : ''}
      </div>`;
  };

  abrirModal(
    titulo,
    `<form class="formulario" novalidate>
      <div class="formulario-campos">${campos.map(campo).join('')}</div>
      <p class="formulario-erro" role="alert" hidden></p>
      <div class="formulario-acoes">
        <button type="button" class="btn" data-fechar>Cancelar</button>
        <button type="submit" class="btn btn-principal">${esc(textoBotao)}</button>
      </div>
    </form>`
  );

  const form = document.querySelector('.modal .formulario');
  const erro = form.querySelector('.formulario-erro');
  form.querySelector('input, select, textarea')?.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      erro.textContent = 'Preencha os campos obrigatórios.';
      erro.hidden = false;
      form.reportValidity();
      return;
    }
    const valores = Object.fromEntries(new FormData(form).entries());
    for (const k of Object.keys(valores)) valores[k] = String(valores[k]).trim();
    const botao = form.querySelector('[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando…';
    erro.hidden = true;
    try {
      await aoSalvar(valores);
      fecharModal();
    } catch (falha) {
      console.error(falha);
      erro.textContent = falha.message;
      erro.hidden = false;
      botao.disabled = false;
      botao.textContent = textoBotao;
    }
  });
}
