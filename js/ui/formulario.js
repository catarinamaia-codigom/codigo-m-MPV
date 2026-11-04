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
 *   tipo: text (padrão) | date | time | number | url | select | textarea | radios | checks | check | arquivo
 *   arquivo: {aceita: 'image/*'|..., imagem: true (aceita colar print), atual: texto do arquivo já guardado}
 *   opcoes (select/radios/checks): [{valor, texto}]
 *   sugestoes: lista fixa ou função (valorDoCampoDependente) => lista, vira <datalist>
 * @param {(valores: object) => Promise<void>} opcoes.aoSalvar
 * @param {string} [opcoes.intro] texto curto acima dos campos
 * @param {(valores: object) => string} [opcoes.previa] HTML atualizado a cada mudança (ex.: destino no Drive)
 */
export function abrirFormulario({ titulo, campos, aoSalvar, textoBotao = 'Salvar', intro = '', previa = null }) {
  const n = ++contador;
  const arquivos = new Map(); // nome do campo -> File escolhido ou colado
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
    } else if (c.tipo === 'check') {
      entrada = `<label class="opcao-check"><input type="checkbox" id="${id}" name="${c.nome}" ${c.valor === true || c.valor === 'TRUE' ? 'checked' : ''}><span>${esc(c.textoCheck ?? c.rotulo)}</span></label>`;
    } else if (c.tipo === 'arquivo') {
      entrada = `<div class="campo-arquivo" data-arquivo="${c.nome}" tabindex="0">
        <input type="file" id="${id}" ${c.aceita ? `accept="${esc(c.aceita)}"` : ''}>
        <span class="arquivo-escolhido">${c.atual ? `Atual: ${esc(c.atual)}` : c.imagem ? 'Escolha um arquivo ou cole um print (⌘V / Ctrl+V)' : 'Nenhum arquivo escolhido'}</span>
        <img class="arquivo-previa" alt="" hidden>
      </div>`;
    } else if (c.tipo === 'textarea') {
      entrada = `<textarea id="${id}" name="${c.nome}" rows="${c.linhas ?? 3}" ${req}>${valor}</textarea>`;
    } else if (c.tipo === 'radios' || c.tipo === 'checks') {
      const marcados = c.tipo === 'checks' ? String(c.valor ?? '').split(/\s*;\s*/) : [String(c.valor ?? '')];
      entrada = `<div class="opcoes-${c.tipo}" role="${c.tipo === 'radios' ? 'radiogroup' : 'group'}" aria-label="${esc(c.rotulo)}">
        ${c.opcoes.map((o) => `<label class="opcao"><input type="${c.tipo === 'radios' ? 'radio' : 'checkbox'}" name="${c.nome}" value="${esc(o.valor)}" ${marcados.includes(String(o.valor)) ? 'checked' : ''} ${c.tipo === 'radios' ? req : ''}><span>${esc(o.texto)}</span></label>`).join('')}
      </div>`;
    } else {
      const lista = c.sugestoes ? `list="${id}-lista"` : '';
      // Números como texto: aceita vírgula (3,5) em qualquer navegador e no iPad
      const extra = c.tipo === 'number' ? 'inputmode="decimal" pattern="[0-9]+([.,][0-9]+)?" title="Número, ex.: 3,5"' : '';
      const tipoHtml = c.tipo === 'number' ? 'text' : c.tipo ?? 'text';
      entrada = `<input id="${id}" name="${c.nome}" type="${tipoHtml}" value="${esc(String(c.valor ?? '').replace(/^(\d+)\.(\d+)$/, '$1,$2'))}" ${req} ${lista} ${extra} autocomplete="off" ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ''}>
        ${c.sugestoes ? `<datalist id="${id}-lista">${listaSugestoes(c, valorInicial(c.dependeDe))}</datalist>` : ''}`;
    }
    const usaLabelFor = !['radios', 'checks', 'check'].includes(c.tipo);
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
      ${previa ? '<div class="formulario-previa" aria-live="polite"></div>' : ''}
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

  // Arquivos: escolher, arrastar ou colar um print
  const ultimoArquivo = { nome: campos.find((c) => c.tipo === 'arquivo' && c.imagem)?.nome };
  const definirArquivo = (nome, arquivo) => {
    arquivos.set(nome, arquivo);
    const caixa = form.querySelector(`[data-arquivo="${nome}"]`);
    caixa.querySelector('.arquivo-escolhido').textContent = `${arquivo.name || 'print colado'} · ${Math.max(1, Math.round(arquivo.size / 1024))} KB`;
    const img = caixa.querySelector('.arquivo-previa');
    if (arquivo.type.startsWith('image/')) {
      img.src = URL.createObjectURL(arquivo);
      img.hidden = false;
    } else img.hidden = true;
    atualizarPrevia();
  };
  form.querySelectorAll('[data-arquivo]').forEach((caixa) => {
    const nome = caixa.dataset.arquivo;
    caixa.querySelector('input').addEventListener('change', (e) => e.target.files[0] && definirArquivo(nome, e.target.files[0]));
    caixa.addEventListener('focusin', () => (ultimoArquivo.nome = nome));
    caixa.addEventListener('click', () => (ultimoArquivo.nome = nome));
    caixa.addEventListener('dragover', (e) => e.preventDefault());
    caixa.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files[0]) definirArquivo(nome, e.dataTransfer.files[0]);
    });
  });
  form.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    if (!item || !ultimoArquivo.nome) return;
    e.preventDefault();
    const f = item.getAsFile();
    definirArquivo(ultimoArquivo.nome, new File([f], `print-${Date.now()}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }));
  });

  const lerValores = () => {
    const dados = new FormData(form);
    const valores = {};
    for (const c of campos) {
      if (c.tipo === 'checks') valores[c.nome] = dados.getAll(c.nome).join('; ');
      else if (c.tipo === 'check') valores[c.nome] = form.elements[c.nome].checked;
      else if (c.tipo === 'arquivo') valores[c.nome] = arquivos.get(c.nome) ?? null;
      else valores[c.nome] = String(dados.get(c.nome) ?? '').trim();
    }
    return valores;
  };
  const elPrevia = form.querySelector('.formulario-previa');
  const atualizarPrevia = () => {
    if (elPrevia) elPrevia.innerHTML = previa(lerValores());
  };
  form.addEventListener('input', atualizarPrevia);
  form.addEventListener('change', atualizarPrevia);
  atualizarPrevia();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      erro.textContent = 'Preencha os campos obrigatórios.';
      erro.hidden = false;
      form.reportValidity();
      return;
    }
    const valores = lerValores();
    const botao = form.querySelector('[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando…';
    erro.hidden = true;
    try {
      await aoSalvar(valores, (texto) => (botao.textContent = texto));
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
