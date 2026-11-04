// Tela DÚVIDAS — aba única na planilha. Tentativa própria ao lado da resposta
// conferida com fonte. Sanar em qualquer tela atualiza todas.

import { esc } from '../util/texto.js';
import { formatoCurto } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { chips, seletorCadeira, ligarFiltros, vazio, aviso, copiar, casa, kpi } from '../ui/componentes.js';
import { atualizar } from '../dados/dataSource.js';
import { nomeCadeira } from '../dados/consultas.js';
import { novaDuvida, responderDuvida, novoCartao } from './formularios.js';

const estado = { status: 'abertas', cadeira: '', busca: '' };

/** Cartão de uma dúvida (também usado na página do assunto). */
export function cartaoDuvida(m, d, { mostrarCadeira = true } = {}) {
  const link = d.link ? `<a href="${esc(d.link)}" target="_blank" rel="noopener">${icone('externo', 'ic-mini')} link</a>` : '';
  return `
    <article class="duvida ${d.sanada ? 'sanada' : ''}">
      <div class="duvida-topo">
        <button class="duvida-marca" data-sanar="${esc(d.id)}" title="${d.sanada ? 'Reabrir' : 'Marcar como sanada'}" aria-label="${d.sanada ? 'Reabrir dúvida' : 'Marcar dúvida como sanada'}">${icone(d.sanada ? 'checkCirculo' : 'circulo')}</button>
        <div class="duvida-texto">
          <strong>${esc(d.pergunta)}</strong>
          <p class="meta">${mostrarCadeira ? `<a href="#/cadeiras/${encodeURIComponent(d.cadeiraId)}${d.assunto ? `/${encodeURIComponent(d.assunto)}` : ''}">${esc(nomeCadeira(m, d.cadeiraId))}${d.assunto ? ` · ${esc(d.assunto)}` : ''}</a> · ` : ''}${d.criada ? formatoCurto(d.criada) : ''}${d.motivo ? ` · ${esc(d.motivo)}` : ''}${d.sanada && d.sanadaEm ? ` · sanada em ${formatoCurto(d.sanadaEm)}` : ''}</p>
        </div>
        <div class="duvida-acoes">
          <button class="btn-mini" data-responder="${esc(d.id)}">${icone('anotacao', 'ic-mini')} ${d.resposta || d.tentativa ? 'Editar' : 'Responder'}</button>
          <button class="btn-mini" data-tutor="${esc(d.id)}" title="Copia um prompt de tutor e abre o chat">${icone('ia', 'ic-mini')} Tutor</button>
          ${d.resposta ? `<button class="btn-mini" data-cartao="${esc(d.id)}" title="Criar cartão do Método Catarina">${icone('flashcard', 'ic-mini')} Cartão</button>` : ''}
        </div>
      </div>
      ${d.tentativa || d.resposta ? `<div class="duvida-lados">
        <div><span class="rotulo-lado">Minha tentativa</span><p>${esc(d.tentativa) || '<span class="meta">—</span>'}</p></div>
        <div><span class="rotulo-lado">Resposta conferida</span><p>${esc(d.resposta) || '<span class="meta">ainda não conferida</span>'}</p>
          ${d.fonte || link ? `<p class="meta">${d.fonte ? `Fonte: ${esc(d.fonte)} ` : ''}${link}</p>` : ''}</div>
      </div>` : ''}
    </article>`;
}

/** Liga os botões dos cartões de dúvida dentro de "el". */
export function ligarDuvidas(el, m) {
  const achar = (id) => m.duvidas.find((d) => d.id === id);
  el.querySelectorAll('[data-sanar]').forEach((b) =>
    b.addEventListener('click', async () => {
      const d = achar(b.dataset.sanar);
      b.disabled = true;
      try {
        await atualizar('Duvidas', d.id, { status: d.sanada ? 'Aberta' : 'Sanada', sanada_em: d.sanada ? '' : m.hoje });
        aviso(d.sanada ? 'Dúvida reaberta.' : 'Dúvida sanada. Que tal transformar em cartão?');
      } catch (e) {
        b.disabled = false;
        aviso(e.message);
      }
    })
  );
  el.querySelectorAll('[data-responder]').forEach((b) => b.addEventListener('click', () => responderDuvida(m, achar(b.dataset.responder))));
  el.querySelectorAll('[data-cartao]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = achar(b.dataset.cartao);
      novoCartao(m, { cadeiraId: d.cadeiraId, assunto: d.assunto, frente: d.pergunta, verso: d.resposta, fonte: d.fonte });
    })
  );
  el.querySelectorAll('[data-tutor]').forEach((b) =>
    b.addEventListener('click', async () => {
      const d = achar(b.dataset.tutor);
      const texto = `Seja meu tutor de ${nomeCadeira(m, d.cadeiraId)} (1º período de Medicina, UPE)${d.assunto ? `, assunto ${d.assunto}` : ''}.
Minha dúvida: ${d.pergunta}
${d.tentativa ? `Minha tentativa sem consultar: ${d.tentativa}` : 'Ainda não tentei responder: me peça uma tentativa antes de dar pistas.'}
Siga a ordem definição → localização → função normal → alteração inicial → mecanismo → consequência celular → repercussão → clínica/laboratório. Dê pistas antes da resposta, cite fontes conferíveis (livro, capítulo, página ou artigo) e termine com uma pergunta para eu checar se entendi.`;
      if (await copiar(texto, 'Prompt de tutor copiado — cole no chat.')) window.open(m.config.iaUrl, '_blank', 'noopener');
    })
  );
}

export function render(el, m) {
  const redesenhar = () => render(el, m);
  const abertas = m.duvidas.filter((d) => !d.sanada);
  const lista = m.duvidas.filter(
    (d) =>
      (estado.status === 'todas' || (estado.status === 'abertas') !== d.sanada) &&
      (!estado.cadeira || d.cadeiraId === estado.cadeira) &&
      casa(`${d.pergunta} ${d.assunto} ${d.resposta} ${d.tentativa}`, estado.busca)
  );
  const semTentativa = abertas.filter((d) => !d.tentativa).length;
  const porCadeira = Object.entries(abertas.reduce((a, d) => ((a[d.cadeiraId] = (a[d.cadeiraId] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);

  el.innerHTML = `
    <header class="cabecalho cabecalho-linha">
      <div><p class="sobretitulo">Uma aba só na planilha</p><h1>Dúvidas</h1></div>
      <div class="acoes-topo"><button class="btn btn-principal" data-nova>${icone('duvidas', 'ic-mini')} + Dúvida</button></div>
    </header>
    <div class="kpis">
      ${kpi({ rotulo: 'Em aberto', valor: abertas.length, tom: abertas.length ? 'alerta' : 'ok' })}
      ${kpi({ rotulo: 'Sem tentativa própria', valor: semTentativa, sub: 'tente responder sem consultar' })}
      ${kpi({ rotulo: 'Sanadas', valor: m.duvidas.length - abertas.length, tom: 'ok' })}
      <div class="kpi kpi-lista"><span class="kpi-rotulo">Abertas por cadeira</span>
        ${porCadeira.length ? porCadeira.slice(0, 4).map(([c, n]) => `<button class="kpi-linha" data-filtro="cadeira" data-valor="${esc(c)}"><span>${esc(nomeCadeira(m, c))}</span><b>${n}</b></button>`).join('') : '<span class="kpi-sub">nenhuma</span>'}
      </div>
    </div>
    <div class="filtros">
      ${chips('status', [['abertas', 'Em aberto'], ['sanadas', 'Sanadas'], ['todas', 'Todas']], estado.status)}
      ${seletorCadeira(m, estado.cadeira)}
      <input class="filtro-texto" type="search" placeholder="Buscar nas dúvidas" data-filtro-texto="busca" value="${esc(estado.busca)}">
    </div>
    <div class="lista-duvidas">${lista.map((d) => cartaoDuvida(m, d)).join('') || vazio(estado.status === 'abertas' ? 'Nenhuma dúvida em aberto com esses filtros.' : 'Nada por aqui.')}</div>`;

  ligarFiltros(el, estado, redesenhar);
  ligarDuvidas(el, m);
  el.querySelector('[data-nova]').addEventListener('click', () => novaDuvida(m, { cadeiraId: estado.cadeira }));
}
