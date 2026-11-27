// Tela DÚVIDAS — aba única na planilha. Tentativa própria ao lado da resposta
// conferida com fonte. Sanar em qualquer tela atualiza todas.

import { esc, formatar, semFormatacao } from '../util/texto.js';
import { formatoCurto } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { chips, seletorCadeira, ligarFiltros, vazio, aviso, copiar, casa, kpi } from '../ui/componentes.js';
import { atualizar } from '../dados/dataSource.js';
import { nomeCadeira } from '../dados/consultas.js';
import { novaDuvida, responderDuvida, novoCartao } from './formularios.js';
import { mostrarImagens } from '../dados/drive.js';

const estado = { status: 'abertas', cadeira: '', busca: '', motivo: '' };

/** Chips de filtro pelos motivos (tipos) que aparecem na lista. */
export function chipsMotivo(duvidas, atual, nome = 'motivo') {
  const motivos = [...new Set(duvidas.map((d) => d.motivo).filter(Boolean))];
  if (!motivos.length) return '';
  return chips(nome, [['', 'Todos os tipos'], ...motivos.map((x) => [x, `${x} (${duvidas.filter((d) => d.motivo === x).length})`])], atual);
}

/** Cartão de uma dúvida (também usado na página do assunto). */
export function cartaoDuvida(m, d, { mostrarCadeira = true, atalho = false } = {}) {
  const link = d.link ? `<a href="${esc(d.link)}" target="_blank" rel="noopener">${icone('externo', 'ic-mini')} link</a>` : '';
  const material = d.materialId && m.materiais.find((x) => x.id === d.materialId);
  const temResposta = Boolean(d.tentativa || d.resposta);
  const previa = semFormatacao(d.resposta || d.tentativa).replace(/\s+/g, ' ').slice(0, 90);
  return `
    <article class="duvida ${d.sanada ? 'sanada' : ''}">
      <div class="duvida-topo">
        <button class="duvida-marca" data-sanar="${esc(d.id)}" title="${d.sanada ? 'Reabrir' : 'Marcar como sanada'}" aria-label="${d.sanada ? 'Reabrir dúvida' : 'Marcar dúvida como sanada'}">${icone(d.sanada ? 'checkCirculo' : 'circulo')}</button>
        <div class="duvida-texto">
          <strong>${esc(d.pergunta)}</strong>
          <p class="meta">${mostrarCadeira ? `<a href="#/cadeiras/${encodeURIComponent(d.cadeiraId)}${d.assunto ? `/${encodeURIComponent(d.assunto)}` : ''}">${esc(nomeCadeira(m, d.cadeiraId))}${d.assunto ? ` · ${esc(d.assunto)}` : ''}</a> · ` : ''}${d.criada ? formatoCurto(d.criada) : ''}${d.motivo ? ` · <span class="tag tag-motivo">${esc(d.motivo)}</span>` : ''}${d.sanada && d.sanadaEm ? ` · sanada em ${formatoCurto(d.sanadaEm)}` : ''}
            ${atalho ? ` · <span class="tag tag-atalho">${icone('link', 'ic-mini')} atalho de ${esc(d.assunto)}</span>` : ''}
            ${material ? ` · <button class="link-botao tag tag-material" data-ver-material="${esc(material.id)}" title="Abrir o material ligado">${icone('materiais', 'ic-mini')} ${esc(material.titulo)}</button>` : ''}</p>
        </div>
        <div class="duvida-acoes">
          <button class="btn-mini" data-responder="${esc(d.id)}">${icone('anotacao', 'ic-mini')} ${temResposta ? 'Editar' : 'Responder'}</button>
          <button class="btn-mini" data-tutor="${esc(d.id)}" title="Copia um prompt de tutor e abre o chat">${icone('ia', 'ic-mini')} Tutor</button>
          <button class="btn-mini" data-cartao="${esc(d.id)}" title="Transformar em cartão do Método Catarina">${icone('flashcard', 'ic-mini')} Cartão</button>
        </div>
      </div>
      ${d.imagem ? `<img class="duvida-imagem" data-imagem-drive="${esc(d.imagem)}" alt="Imagem da dúvida">` : ''}
      ${temResposta || !d.sanada ? `<details class="duvida-resposta">
        <summary>
          <span class="dr-rotulo">${icone('proximo', 'ic-mini seta-recolher')} ${temResposta ? 'Ver resposta' : 'Responder'}</span>
          ${temResposta ? `<span class="dr-previa">${esc(previa)}${(d.resposta || d.tentativa).length > 90 ? '…' : ''}</span>` : ''}
          ${!d.resposta ? `<button class="colar-verde" data-colar-resposta="${esc(d.id)}" title="Cola o que está copiado como resposta conferida">${icone('colar', 'ic-mini')} colar resposta</button>` : ''}
        </summary>
        <div class="duvida-lados">
          <div><span class="rotulo-lado">Minha tentativa</span><p>${formatar(d.tentativa) || '<span class="meta">—</span>'}</p></div>
          <div class="lado-verde" data-colar-resposta="${esc(d.id)}" role="button" tabindex="0" title="Clique para colar a resposta conferida que você copiou">
            <span class="rotulo-lado">Resposta conferida ${icone('colar', 'ic-mini')}</span>
            <p>${formatar(d.resposta) || '<span class="meta">clique aqui para colar a resposta que você copiou</span>'}</p>
            ${d.fonte || link ? `<p class="meta">${d.fonte ? `Fonte: ${formatar(d.fonte)} ` : ''}${link}</p>` : ''}</div>
        </div>
      </details>` : ''}
    </article>`;
}

/**
 * Cola o texto copiado como resposta conferida. Sem resposta: grava direto.
 * Já com resposta: abre o formulário com o texto novo no fim, para revisar.
 */
async function colarResposta(m, d) {
  let texto = '';
  try {
    texto = (await navigator.clipboard.readText()).trim();
  } catch {
    /* navegador não deixou ler a área de transferência */
  }
  if (!texto) {
    responderDuvida(m, d);
    aviso('Não consegui ler o que foi copiado: cole com ⌘V / Ctrl+V no campo “Resposta conferida”.');
    return;
  }
  if (d.resposta) {
    responderDuvida(m, d, { resposta: `${d.resposta}\n\n${texto}` });
    return;
  }
  try {
    await atualizar('Duvidas', d.id, { resposta: texto });
    aviso('Resposta conferida colada.');
  } catch (e) {
    aviso(e.message);
  }
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
  el.querySelectorAll('[data-colar-resposta]').forEach((b) => {
    const colar = (e) => {
      if (e.target.closest('a')) return; // link dentro da resposta: só abre o link
      e.preventDefault();
      e.stopPropagation();
      colarResposta(m, achar(b.dataset.colarResposta));
    };
    b.addEventListener('click', colar);
    b.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && colar(e));
  });
  el.querySelectorAll('.duvida [data-ver-material]').forEach((b) =>
    b.addEventListener('click', async () => {
      const { abrirMaterial } = await import('./materiais.js');
      abrirMaterial(m, m.materiais.find((x) => x.id === b.dataset.verMaterial));
    })
  );
  el.querySelectorAll('[data-cartao]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = achar(b.dataset.cartao);
      novoCartao(m, { cadeiraId: d.cadeiraId, assunto: d.assunto, frente: d.pergunta, verso: d.resposta || d.tentativa, fonte: d.fonte });
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

let ultimoParametro = '';
export function render(el, m, [cadeiraDaRota = ''] = []) {
  // Vindo de uma cadeira (#/duvidas/histologia): abre já filtrado, com todas as dúvidas dela
  if (cadeiraDaRota !== ultimoParametro) {
    ultimoParametro = cadeiraDaRota;
    if (cadeiraDaRota) Object.assign(estado, { cadeira: cadeiraDaRota, status: 'todas', motivo: '' });
  }
  const redesenhar = () => render(el, m, [cadeiraDaRota]);
  const abertas = m.duvidas.filter((d) => !d.sanada);
  const lista = m.duvidas.filter(
    (d) =>
      (estado.status === 'todas' || (estado.status === 'abertas') !== d.sanada) &&
      (!estado.cadeira || d.cadeiraId === estado.cadeira) &&
      (!estado.motivo || d.motivo === estado.motivo) &&
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
      ${chipsMotivo(m.duvidas, estado.motivo)}
      ${seletorCadeira(m, estado.cadeira)}
      <input class="filtro-texto" type="search" placeholder="Buscar nas dúvidas" data-filtro-texto="busca" value="${esc(estado.busca)}">
    </div>
    <div class="lista-duvidas">${lista.map((d) => cartaoDuvida(m, d)).join('') || vazio(estado.status === 'abertas' ? 'Nenhuma dúvida em aberto com esses filtros.' : 'Nada por aqui.')}</div>`;

  ligarFiltros(el, estado, redesenhar);
  ligarDuvidas(el, m);
  mostrarImagens(el);
  el.querySelector('[data-nova]').addEventListener('click', () => novaDuvida(m, { cadeiraId: estado.cadeira }));
}
