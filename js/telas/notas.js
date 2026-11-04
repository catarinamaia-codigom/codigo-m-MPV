// Tela AVALIAÇÕES E NOTAS — calculadora por cadeira com notas reais e modo
// de simulação (valores digitados em "Simular" não são gravados).

import { esc } from '../util/texto.js';
import { formatoCurto, diasEntre } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { vazio } from '../ui/componentes.js';
import { calcularMedia } from '../regras/notas.js';
import { cadeiraPorId, moduloPorId } from '../dados/consultas.js';
import { novaNota, novaAvaliacao } from './formularios.js';

const simuladas = {}; // { cadeiraId: { indice: valor } } — só na tela
const n2 = (x) => (x === null || x === undefined ? '—' : String(Math.round(x * 100) / 100).replace('.', ','));

const SITUACAO = {
  aprovada: ['ok', 'Aprovada'],
  final: ['alerta', 'Vai para a final'],
  reprovada: ['ruim', 'Reprovação'],
  risco: ['ruim', 'Risco: precisa de mais de 10'],
  andamento: ['', 'Em andamento'],
};

function blocoCadeira(m, id) {
  const nome = cadeiraPorId(m, id)?.nome ?? moduloPorId(m, id)?.nome ?? id;
  const itens = m.notas.filter((n) => n.cadeiraId === id);
  const avs = m.avaliacoes.filter((a) => a.cadeiraId === id);
  const semNota = avs.filter((a) => !itens.some((n) => n.avaliacaoId === a.id));
  const sim = (simuladas[id] ??= {});
  const r = calcularMedia(itens, m.config.notas, sim);
  const formula = m.config.formulasNota[nome] ?? m.config.formulasNota[nome.replace(/\s*\(.*\)/, '')];
  const [tom, texto] = SITUACAO[r.situacao] ?? SITUACAO.andamento;
  const simulando = Object.values(sim).some((v) => v !== '' && v !== undefined);

  return `
    <details class="cartao bloco-nota" ${itens.length || semNota.length ? 'open' : ''} data-cadeira="${esc(id)}">
      <summary class="cartao-topo">
        <h2>${icone(moduloPorId(m, id) ? 'avaliacoes' : 'cadeiras')}<span>${esc(nome)}</span></h2>
        <span class="nota-resumo">
          ${r.vazio ? '<span class="meta">sem avaliações na calculadora</span>' : `
            ${r.media !== null ? `<b class="media">${n2(r.media)}</b>` : `<span class="meta">garantido</span> <b class="media">${n2(r.garantida)}</b>`}
            <span class="tag ${tom ? `tag-${tom}` : ''}">${simulando ? 'Simulação · ' : ''}${esc(texto)}</span>`}
        </span>
      </summary>
      <div class="cartao-corpo">
        ${itens.length ? `<table class="tabela tabela-notas">
          <thead><tr><th>Avaliação</th><th>Vale</th><th>Peso</th><th>Nota</th><th>Simular</th><th></th></tr></thead>
          <tbody>${itens.map((it, i) => `<tr>
            <td class="t-forte">${esc(it.nome)}${it.bonus ? ' <span class="tag">bônus</span>' : ''}${it.obs ? `<br><small class="meta">${esc(it.obs)}</small>` : ''}</td>
            <td>${n2(it.vale)}</td><td>${it.bonus ? '—' : n2(it.peso)}</td>
            <td>${it.nota === null ? '<span class="meta">pendente</span>' : `<b>${n2(it.nota)}</b>`}</td>
            <td>${it.nota === null || sim[i] !== undefined ? `<input class="entrada-sim" type="number" step="0.1" min="0" max="${it.vale}" data-sim="${i}" value="${esc(sim[i] ?? '')}" placeholder="?" aria-label="Simular nota de ${esc(it.nome)}">` : ''}</td>
            <td><button class="btn-mini" data-editar="${esc(it.id)}">${icone('anotacao', 'ic-mini')}</button></td>
          </tr>`).join('')}</tbody></table>` : ''}
        ${!r.vazio ? `<div class="nota-calculo">
          ${r.media !== null ? `<p><b>Média: ${n2(r.media)}</b>${r.bonus ? ` (inclui ${n2(r.bonus)} de bônus)` : ''}.</p>` : `
          <p>Garantido até agora: <b>${n2(r.garantida)}</b>${r.parcial !== null ? ` · no ritmo atual: <b>${n2(r.parcial)}</b>` : ''}.</p>
          <p>${r.precisa === 0 ? `Já garantiu a média ${n2(m.config.notas.mediaAprovacao)}.` : `Para fechar ${n2(m.config.notas.mediaAprovacao)} precisa tirar em média <b>${n2(r.precisa)}</b> (de 10) nas ${r.pendentes} que faltam.`}</p>`}
          ${r.notaFinalNecessaria !== null ? `<p class="alerta-texto">Na final precisa tirar <b>${n2(r.notaFinalNecessaria)}</b> para fechar ${n2(m.config.notas.mediaFinal)} (média entre a nota do semestre e a final — confirmar a regra da UPE).</p>` : ''}
        </div>` : ''}
        ${formula ? `<p class="nota">Fórmula registrada: <code>${esc(formula)}</code></p>` : ''}
        ${semNota.length ? `<div class="sem-nota"><span class="meta">Avaliações marcadas sem nota na calculadora:</span>
          ${semNota.map((a) => `<button class="btn-mini" data-lancar="${esc(a.id)}">+ ${esc(a.titulo)} <small>${formatoCurto(a.data)}</small></button>`).join('')}</div>` : ''}
        <div class="bloco-acoes">
          <button class="btn-novo" data-nova="${esc(id)}">+ Avaliação na calculadora</button>
          ${simulando ? `<button class="btn-mini" data-limpar="${esc(id)}">Limpar simulação</button>` : ''}
        </div>
      </div>
    </details>`;
}

export function render(el, m) {
  const proximas = m.avaliacoes.filter((a) => a.data >= m.hoje).slice(0, 8);
  const ids = [...m.modulos.filter((mod) => m.notas.some((n) => n.cadeiraId === mod.id) || m.avaliacoes.some((a) => a.cadeiraId === mod.id)).map((x) => x.id), ...m.cadeiras.map((c) => c.id)];

  el.innerHTML = `
    <header class="cabecalho cabecalho-linha">
      <div><p class="sobretitulo">Média ${esc(String(m.config.notas.mediaAprovacao).replace('.', ','))} aprova · abaixo vai para a final (fecha ${esc(String(m.config.notas.mediaFinal).replace('.', ','))})</p><h1>Avaliações e notas</h1></div>
      <div class="acoes-topo"><button class="btn" data-avaliacao>${icone('calendario', 'ic-mini')} + Avaliação no calendário</button></div>
    </header>
    <section class="cartao">
      <header class="cartao-topo"><h2>${icone('alerta')}<span>Próximas avaliações</span></h2></header>
      <div class="cartao-corpo">${proximas.length ? `<ul class="linha-avaliacoes">${proximas.map((a) => {
        const d = diasEntre(m.hoje, a.data);
        return `<li class="${d <= 3 ? 'urgente' : ''}"><span class="contagem"><b>${d === 0 ? 'hoje' : d}</b>${d === 0 ? '' : d === 1 ? 'dia' : 'dias'}</span><span><strong>${esc(a.titulo)}</strong><small class="meta">${formatoCurto(a.data)}${a.hora ? ` ${esc(a.hora)}` : ''} · ${esc(cadeiraPorId(m, a.cadeiraId)?.nome ?? moduloPorId(m, a.cadeiraId)?.nome ?? '')}</small></span></li>`;
      }).join('')}</ul>` : vazio('Nenhuma avaliação marcada.')}</div>
    </section>
    <div class="grade-notas">${ids.map((id) => blocoCadeira(m, id)).join('')}</div>
    <p class="nota">Peso em branco = vale (soma de pontos, como Biofísica: 4 + 4 + 2). Para média simples, deixe todas valendo 10. As regras (média 7 e final 5) ficam na aba Config, grupo <code>notas</code>.</p>`;

  el.querySelector('[data-avaliacao]').addEventListener('click', () => novaAvaliacao(m));
  el.querySelectorAll('[data-nova]').forEach((b) => b.addEventListener('click', () => novaNota(m, { cadeiraId: b.dataset.nova })));
  el.querySelectorAll('[data-lancar]').forEach((b) => b.addEventListener('click', () => novaNota(m, { avaliacao: m.avaliacoes.find((a) => a.id === b.dataset.lancar) })));
  el.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => novaNota(m, { nota: m.notas.find((n) => n.id === b.dataset.editar) })));
  el.querySelectorAll('[data-limpar]').forEach((b) => b.addEventListener('click', () => {
    simuladas[b.dataset.limpar] = {};
    render(el, m);
  }));
  el.querySelectorAll('[data-sim]').forEach((inp) =>
    inp.addEventListener('change', () => {
      const cad = inp.closest('[data-cadeira]').dataset.cadeira;
      simuladas[cad][inp.dataset.sim] = inp.value === '' ? undefined : inp.value.replace(',', '.');
      const y = window.scrollY;
      render(el, m);
      window.scrollTo(0, y);
    })
  );
}
