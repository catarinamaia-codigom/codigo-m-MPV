// Tela BUSCA — procura em assuntos, dúvidas, materiais, cartões,
// avaliações e pendências.

import { esc } from '../util/texto.js';
import { formatoCurto } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { vazio, casa } from '../ui/componentes.js';
import { nomeCadeira } from '../dados/consultas.js';
import { mesmoAssunto } from '../regras/dominio.js';

const link = (cad, ass) => `#/cadeiras/${encodeURIComponent(cad)}${ass ? `/${encodeURIComponent(ass)}` : ''}`;

export function render(el, m, [termo = '']) {
  const assuntos = [];
  const cadeirasAchadas = m.cadeiras.filter((c) => casa(`${c.nome} ${nomeCadeira(m, c.id)}`, termo)).map((c) => c.id);
  for (const a of m.aulas.filter((x) => casa(`${x.assunto} ${x.professor}`, termo) || cadeirasAchadas.includes(x.cadeiraId))) {
    if (!assuntos.some((x) => x.cadeiraId === a.cadeiraId && mesmoAssunto(x.assunto, a.assunto))) assuntos.push(a);
  }
  const grupos = [
    ['Cadeiras', 'cadeiras', m.cadeiras.filter((c) => cadeirasAchadas.includes(c.id)).map((c) => [link(c.id), nomeCadeira(m, c.id), ''])],
    ['Assuntos e aulas', 'aula', assuntos.map((a) => [link(a.cadeiraId, a.assunto), a.assunto, `${nomeCadeira(m, a.cadeiraId)} · ${formatoCurto(a.data)}`])],
    ['Dúvidas', 'duvidas', m.duvidas.filter((d) => casa(`${d.pergunta} ${d.resposta}`, termo)).map((d) => [link(d.cadeiraId, d.assunto), d.pergunta, `${nomeCadeira(m, d.cadeiraId)} · ${d.sanada ? 'sanada' : 'em aberto'}`])],
    ['Materiais', 'materiais', m.materiais.filter((x) => casa(`${x.titulo} ${x.obs}`, termo)).map((x) => [x.link || link(x.cadeiraId, x.assunto), x.titulo, `${x.tipo} · ${nomeCadeira(m, x.cadeiraId)}`])],
    ['Cartões', 'flashcard', m.cartoes.filter((c) => casa(`${c.frente} ${c.verso}`, termo)).map((c) => [link(c.cadeiraId, c.assunto), c.frente, nomeCadeira(m, c.cadeiraId)])],
    ['Avaliações', 'avaliacoes', m.avaliacoes.filter((a) => casa(`${a.titulo} ${a.conteudo}`, termo)).map((a) => ['#/avaliacoes', a.titulo, `${formatoCurto(a.data)} · ${nomeCadeira(m, a.cadeiraId)}`])],
    ['Pendências', 'pendencias', m.pendencias.filter((p) => casa(p.descricao, termo)).map((p) => ['#/pendencias', p.descricao, p.feita ? 'feita' : 'aberta'])],
  ].filter(([, , itens]) => itens.length);

  el.innerHTML = `
    <header class="cabecalho"><p class="sobretitulo">Busca</p><h1>“${esc(termo)}”</h1></header>
    ${grupos.length ? `<div class="resultados">${grupos.map(([titulo, ic, itens]) => `
      <section class="cartao"><header class="cartao-topo"><h2>${icone(ic)}<span>${esc(titulo)}</span></h2><span class="meta">${itens.length}</span></header>
        <div class="cartao-corpo"><ul class="lista-resultados">${itens.slice(0, 30).map(([href, t, sub]) => `<li><a href="${esc(href)}" ${href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(t)}</a><span class="meta">${esc(sub)}</span></li>`).join('')}</ul></div></section>`).join('')}</div>`
      : vazio('Nada encontrado. Tente outra palavra (a busca ignora acentos).')}`;
}
