// Modo aula: painel fixo para anotar várias dúvidas seguidas enquanto assiste
// (dúvida e tentativa lado a lado). Ctrl/⌘ + Enter salva e já abre a próxima.
// Convive com o visualizador (vídeo em cima, dúvidas embaixo) e continua
// aberto ao trocar de tela.

import { esc } from '../util/texto.js';
import { icone } from './icones.js';
import { aviso } from './componentes.js';
import { adicionar, novoId } from '../dados/dataSource.js';
import { nomeCadeira } from '../dados/consultas.js';
import { assuntosDaCadeira } from '../regras/dominio.js';

let sessao = null; // { m, cadeiraId, assunto, salvas: [{pergunta, tentativa, motivo}] }

export function abrirModoAula(m, { cadeiraId = '', assunto = '' } = {}) {
  if (sessao) {
    // Já aberto: só atualiza o assunto (se veio de outra página)
    if (cadeiraId) Object.assign(sessao, { m, cadeiraId, assunto: assunto || sessao.assunto });
    desenhar();
    document.querySelector('.modo-aula [name="pergunta"]')?.focus();
    return;
  }
  sessao = { m, cadeiraId, assunto, salvas: [] };
  document.body.classList.add('com-modo-aula');
  desenhar();
  document.querySelector('.modo-aula [name="pergunta"]')?.focus();
}

function fechar() {
  const p = document.querySelector('.modo-aula');
  const pendente = p && (p.querySelector('[name="pergunta"]').value.trim() || p.querySelector('[name="tentativa"]').value.trim());
  if (pendente && !confirm('Há uma dúvida escrita e ainda não salva. Fechar mesmo assim?')) return;
  sessao = null;
  p?.remove();
  document.body.classList.remove('com-modo-aula');
}

function desenhar() {
  let p = document.querySelector('.modo-aula');
  const novo = !p;
  if (novo) {
    p = document.createElement('section');
    p.className = 'modo-aula';
    p.setAttribute('aria-label', 'Modo aula: várias dúvidas');
    document.body.appendChild(p);
  }
  const { m, cadeiraId, assunto, salvas } = sessao;
  const rascunho = novo ? {} : { pergunta: p.querySelector('[name="pergunta"]')?.value ?? '', tentativa: p.querySelector('[name="tentativa"]')?.value ?? '' };
  p.innerHTML = `
    <header class="ma-topo">
      <h2>${icone('duvidas', 'ic-mini')} Dúvidas da aula <small>${salvas.length ? `${salvas.length} salva${salvas.length > 1 ? 's' : ''}` : ''}</small></h2>
      <button class="btn-icone" data-ma="recolher" title="Recolher / abrir" aria-label="Recolher o painel">${icone('proximo', 'ic-mini')}</button>
      <button class="btn-icone" data-ma="fechar" title="Fechar" aria-label="Fechar o modo aula">${icone('fechar', 'ic-mini')}</button>
    </header>
    <div class="ma-onde">
      <select name="cadeira" aria-label="Cadeira">${[{ id: '', nome: '— cadeira —' }, ...m.cadeiras].map((c) => `<option value="${esc(c.id)}" ${c.id === cadeiraId ? 'selected' : ''}>${esc(c.id ? nomeCadeira(m, c.id) : c.nome)}</option>`).join('')}</select>
      <input name="assunto" list="ma-assuntos" value="${esc(assunto)}" placeholder="Assunto" aria-label="Assunto">
      <datalist id="ma-assuntos">${(cadeiraId ? assuntosDaCadeira(m, cadeiraId) : []).map((a) => `<option value="${esc(a)}"></option>`).join('')}</datalist>
    </div>
    <ol class="ma-lista">${salvas.map((d) => `<li><span class="ma-ok">${icone('check', 'ic-mini')}</span><span><b>${esc(d.pergunta)}</b>${d.tentativa ? `<small>${esc(d.tentativa)}</small>` : ''}</span></li>`).join('')}</ol>
    <form class="ma-nova">
      <textarea name="pergunta" rows="2" placeholder="Dúvida…" aria-label="Dúvida">${esc(rascunho.pergunta ?? '')}</textarea>
      <textarea name="tentativa" rows="2" placeholder="Minha tentativa (opcional)" aria-label="Minha tentativa">${esc(rascunho.tentativa ?? '')}</textarea>
      <div class="ma-acoes">
        <select name="motivo" aria-label="Tipo de dúvida"><option value="">tipo (opcional)</option>${m.config.motivosDuvida.map((x) => `<option>${esc(x)}</option>`).join('')}</select>
        <span class="meta">Ctrl/⌘ + Enter</span>
        <button class="btn btn-principal" type="submit">Adicionar</button>
      </div>
    </form>`;

  p.querySelector('[data-ma="fechar"]').addEventListener('click', fechar);
  p.querySelector('[data-ma="recolher"]').addEventListener('click', () => p.classList.toggle('recolhido'));
  p.querySelector('[name="cadeira"]').addEventListener('change', (e) => {
    sessao.cadeiraId = e.target.value;
    sessao.assunto = '';
    desenhar();
  });
  p.querySelector('[name="assunto"]').addEventListener('change', (e) => (sessao.assunto = e.target.value.trim()));
  const form = p.querySelector('.ma-nova');
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pergunta = form.pergunta.value.trim();
    if (!pergunta) return form.pergunta.focus();
    if (!sessao.cadeiraId) return aviso('Escolha a cadeira no topo do painel.');
    const d = { pergunta, tentativa: form.tentativa.value.trim(), motivo: form.motivo.value };
    const botao = form.querySelector('[type="submit"]');
    botao.disabled = true;
    try {
      await adicionar('Duvidas', { id: novoId('D'), criada: sessao.m.hoje, status: 'Aberta', cadeira_id: sessao.cadeiraId, assunto: sessao.assunto, ...d });
      sessao.salvas.unshift(d); // mais nova em cima
      form.pergunta.value = '';
      form.tentativa.value = '';
      desenhar();
      document.querySelector('.modo-aula [name="pergunta"]')?.focus();
    } catch (falha) {
      aviso(falha.message);
      botao.disabled = false;
    }
  });
}
