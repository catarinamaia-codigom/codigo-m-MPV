// Formulário em janela (modal) gerado a partir de uma lista de campos.
// Usado por todos os "+ Registrar" do Código M.

import { esc } from '../util/texto.js';
import { abrirModal, fecharModal } from './componentes.js';

let contador = 0;

/**
 * @param {object} opcoes
 * @param {string} opcoes.titulo
 * @param {Array<object>} opcoes.campos
 *   {nome, rotulo, tipo?, opcoes?, obrigatorio?, valor?, dica?, largo?, sugestoes?, dependeDe?}
 *   tipo: text (padrão) | date | time | number | url | select | textarea | radios | checks
 *   opcoes (select/radios/checks): [{valor, texto}]
 *   sugestoes: lista fixa ou função (valorDoCampoDependente) => lista, vira <datalist>
 * @param {(valores: object) => Promise<void>} opcoes.aoSalvar
 * @param {string} [opcoes.intro] texto curto acima dos campos
 */
export function abrirFormulario({ titulo, campos, aoSalvar, textoBotao = 'Salvar', intro = '' }) {
  const n = ++contador;
  const listaSugestoes = (c, dep) => {
    const itens = typeof c.sugestoes === 'function' ? c.sugestoes(dep) : c.sugestoes ?? [];
    return itens.map((s) => `<option value="${esc(s)}"></option>`).join('');
  };
  const valorInicial = (nome) => campos.find((c) => c.nome === nome)?.valor ?? '';

  const campo = (c) => {
    const id = `f${n}-${c.nome}`;
    const req = c.obrigatorio ? 'required' : '';
    const valor = esc(c.valor ?? '');
    let entrada;
    if (c.tipo === 'select') {
      entrada = `<select id="${id}" name="${c.nome}" ${req}>
        ${c.opcoes.map((o) => `<option value="${esc(o.valor)}" ${String(o.valor) === String(c.valor ?? '') ? 'selected' : ''}>${esc(o.texto)}</option>`).join('')}
      </select>`;
    } else if (c.tipo === 'textarea') {
      entrada = `<textarea id="${id}" name="${c.nome}" rows="${c.linhas ?? 3}" ${req}>${valor}</textarea>`;
    } else if (c.tipo === 'radios' || c.tipo === 'checks') {
      const marcados = c.tipo === 'checks' ? String(c.valor ?? '').split(/\s*;\s*/) : [String(c.valor ?? '')];
      entrada = `<div class="opcoes-${c.tipo}" role="${c.tipo === 'radios' ? 'radiogroup' : 'group'}" aria-label="${esc(c.rotulo)}">
        ${c.opcoes.map((o) => `<label class="opcao"><input type="${c.tipo === 'radios' ? 'radio' : 'checkbox'}" name="${c.nome}" value="${esc(o.valor)}" ${marcados.includes(String(o.valor)) ? 'checked' : ''} ${c.tipo === 'radios' ? req : ''}><span>${esc(o.texto)}</span></label>`).join('')}
      </div>`;
    } else {
      const lista = c.sugestoes ? `list="${id}-lista"` : '';
      const extra = c.tipo === 'number' ? `step="${c.passo ?? 'any'}" min="${c.min ?? ''}" max="${c.max ?? ''}" inputmode="decimal"` : '';
      entrada = `<input id="${id}" name="${c.nome}" type="${c.tipo ?? 'text'}" value="${valor}" ${req} ${lista} ${extra} autocomplete="off" ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ''}>
        ${c.sugestoes ? `<datalist id="${id}-lista">${listaSugestoes(c, valorInicial(c.dependeDe))}</datalist>` : ''}`;
    }
    const usaLabelFor = !['radios', 'checks'].includes(c.tipo);
    return `
      <div class="campo ${c.largo ? 'largo' : ''}">
        ${usaLabelFor ? `<label for="${id}">` : '<span class="campo-rotulo">'}${esc(c.rotulo)}${c.obrigatorio ? '' : ' <small>(opcional)</small>'}${usaLabelFor ? '</label>' : '</span>'}
        ${entrada}
        ${c.dica ? `<small class="dica">${esc(c.dica)}</small>` : ''}
      </div>`;
  };

  abrirModal(
    titulo,
    `<form class="formulario" novalidate>
      ${intro ? `<p class="formulario-intro">${esc(intro)}</p>` : ''}
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
  form.querySelector('input:not([type=radio]):not([type=checkbox]), select, textarea')?.focus();

  // Sugestões que dependem de outro campo (ex.: assuntos da cadeira escolhida)
  for (const c of campos.filter((x) => x.dependeDe && typeof x.sugestoes === 'function')) {
    const origem = form.elements[c.dependeDe];
    origem?.addEventListener('change', () => {
      form.querySelector(`#f${n}-${c.nome}-lista`).innerHTML = listaSugestoes(c, origem.value);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      erro.textContent = 'Preencha os campos obrigatórios.';
      erro.hidden = false;
      form.reportValidity();
      return;
    }
    const dados = new FormData(form);
    const valores = {};
    for (const c of campos) {
      valores[c.nome] = c.tipo === 'checks' ? dados.getAll(c.nome).join('; ') : String(dados.get(c.nome) ?? '').trim();
    }
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
