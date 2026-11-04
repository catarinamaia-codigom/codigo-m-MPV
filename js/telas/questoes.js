// Tela QUESTÕES — registro de acertos, erros e chutes (com confiança e
// motivos), desempenho por cadeira e assunto e nível de domínio.

import { esc } from '../util/texto.js';
import { formatoCurto, diasEntre } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { kpi, vazio, aviso, seletorCadeira, ligarFiltros, barra, seloDominio } from '../ui/componentes.js';
import { adicionar, avisarMudanca, novoId, emSimulacao } from '../dados/dataSource.js';
import { nomeCadeira } from '../dados/consultas.js';
import { estatisticaQuestoes, avaliarQuestao, dominioAssunto, assuntosDaCadeira, mesmoAssunto } from '../regras/dominio.js';
import { novaQuestao } from './formularios.js';
import { verImagem } from './cadeiras.js';

const estado = { cadeira: '', periodo: 'tudo' };
const lote = { cadeira: '', assunto: '', fonte: '', confianca: '3', contagem: 0 };
const pct = (x) => (x === null ? '—' : `${Math.round(x * 100)}%`);

function painelLote(m) {
  const assuntos = lote.cadeira ? assuntosDaCadeira(m, lote.cadeira) : [];
  return `
    <section class="cartao lote">
      <header class="cartao-topo"><h2>${icone('questoes')}<span>Registro rápido</span></h2><span class="meta">para corrigir um caderno de questões de uma vez</span></header>
      <div class="cartao-corpo">
        <div class="lote-campos">
          <select id="lote-cadeira" aria-label="Cadeira"><option value="">Cadeira…</option>${m.cadeiras.map((c) => `<option value="${esc(c.id)}" ${c.id === lote.cadeira ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
          <input id="lote-assunto" list="lote-assuntos" placeholder="Assunto" value="${esc(lote.assunto)}" aria-label="Assunto">
          <datalist id="lote-assuntos">${assuntos.map((a) => `<option value="${esc(a)}">`).join('')}</datalist>
          <input id="lote-fonte" placeholder="Fonte (ex.: caderno GoodNotes)" value="${esc(lote.fonte)}" aria-label="Fonte">
          <label class="lote-conf">Confiança <select id="lote-conf">${[1, 2, 3, 4, 5].map((n) => `<option ${String(n) === lote.confianca ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        </div>
        <div class="lote-botoes">
          <button class="btn-resultado r-acertou" data-lote="Acertou">${icone('check', 'ic-mini')} Acertei</button>
          <button class="btn-resultado r-errou" data-lote="Errou">${icone('fechar', 'ic-mini')} Errei</button>
          <button class="btn-resultado r-chutou" data-lote="Chutou">? Chutei</button>
          <span class="lote-contagem">${lote.contagem ? `${lote.contagem} registrada(s) agora` : ''}</span>
          <button class="btn-mini" data-detalhada>Registro detalhado (motivos)…</button>
        </div>
      </div>
    </section>`;
}

export function render(el, m) {
  const redesenhar = () => render(el, m);
  const janela = { semana: 7, mes: 30, tudo: 99999 }[estado.periodo];
  const qs = m.questoes.filter((q) => (!estado.cadeira || q.cadeiraId === estado.cadeira) && diasEntre(q.data || m.hoje, m.hoje) <= janela);
  const est = estatisticaQuestoes(qs);

  // Por cadeira
  const cadeirasComQ = m.cadeiras.filter((c) => m.questoes.some((q) => q.cadeiraId === c.id));
  const linhasCadeira = cadeirasComQ.map((c) => ({ c, e: estatisticaQuestoes(qs.filter((q) => q.cadeiraId === c.id)) })).filter((x) => x.e.total);

  // Por assunto (pior primeiro)
  const assuntos = [];
  for (const q of qs) {
    let a = assuntos.find((x) => x.cadeiraId === q.cadeiraId && mesmoAssunto(x.assunto, q.assunto));
    if (!a) assuntos.push((a = { cadeiraId: q.cadeiraId, assunto: q.assunto, qs: [] }));
    a.qs.push(q);
  }
  const linhasAssunto = assuntos
    .map((a) => ({ ...a, e: estatisticaQuestoes(a.qs), d: dominioAssunto(m, a.cadeiraId, a.assunto) }))
    .sort((a, b) => a.e.taxa - b.e.taxa || b.e.total - a.e.total);

  // Motivos
  const motivos = {};
  qs.filter((q) => !avaliarQuestao(q).acerto || q.motivos.length).forEach((q) => q.motivos.forEach((mt) => (motivos[mt] = (motivos[mt] || 0) + 1)));
  const motivosOrd = Object.entries(motivos).sort((a, b) => b[1] - a[1]);
  const maxMot = Math.max(1, ...motivosOrd.map((x) => x[1]));

  el.innerHTML = `
    <header class="cabecalho cabecalho-linha">
      <div><p class="sobretitulo">Acertou · errou · chutou</p><h1>Questões</h1></div>
      <div class="acoes-topo"><button class="btn btn-principal" data-nova>${icone('questoes', 'ic-mini')} + Questão</button></div>
    </header>
    ${painelLote(m)}
    <div class="filtros">
      ${seletorCadeira(m, estado.cadeira)}
      <div class="chips" role="group">${[['semana', '7 dias'], ['mes', '30 dias'], ['tudo', 'Tudo']].map(([v, t]) => `<button class="chip ${estado.periodo === v ? 'ativo' : ''}" data-filtro="periodo" data-valor="${v}">${t}</button>`).join('')}</div>
    </div>
    <div class="kpis">
      ${kpi({ rotulo: 'Questões', valor: est.total })}
      ${kpi({ rotulo: 'Acerto efetivo', valor: pct(est.taxa), tom: est.taxa === null ? '' : est.taxa >= 0.7 ? 'ok' : 'alerta', sub: 'chute com confiança baixa conta como erro' })}
      ${kpi({ rotulo: 'Chutes', valor: est.chutes })}
      ${kpi({ rotulo: 'Pedem aprofundamento', valor: est.aprofundar, tom: est.aprofundar ? 'alerta' : '' })}
    </div>
    <div class="grade-2">
      <section class="cartao"><header class="cartao-topo"><h2>${icone('cadeiras')}<span>Por cadeira</span></h2></header>
        <div class="cartao-corpo">${linhasCadeira.length ? `<table class="tabela"><thead><tr><th>Cadeira</th><th>Questões</th><th>Acerto</th><th></th></tr></thead><tbody>
          ${linhasCadeira.map(({ c, e }) => `<tr><td><button class="link-botao" data-filtro="cadeira" data-valor="${esc(c.id)}">${esc(c.nome)}</button></td><td>${e.total}</td><td>${pct(e.taxa)}</td><td>${barra(e.taxa, e.taxa < 0.6 ? 'ruim' : e.taxa < 0.8 ? 'medio' : 'bom')}</td></tr>`).join('')}
        </tbody></table>` : vazio('Sem questões no período.')}</div></section>
      <section class="cartao"><header class="cartao-topo"><h2>${icone('alerta')}<span>Motivos dos erros</span></h2></header>
        <div class="cartao-corpo">${motivosOrd.length ? `<ul class="lista-motivos">${motivosOrd.map(([mt, n]) => `<li><span>${esc(mt)}</span><span class="motivo-barra"><span style="width:${Math.round((n / maxMot) * 100)}%"></span></span><b>${n}</b></li>`).join('')}</ul>` : vazio('Marque motivos no registro detalhado para ver padrões.')}</div></section>
    </div>
    <section class="cartao"><header class="cartao-topo"><h2>${icone('lampada')}<span>Assuntos — pior desempenho primeiro</span></h2></header>
      <div class="cartao-corpo">${linhasAssunto.length ? `<table class="tabela"><thead><tr><th>Assunto</th><th>Cadeira</th><th>Questões</th><th>Acerto</th><th>Domínio</th></tr></thead><tbody>
        ${linhasAssunto.map((a) => `<tr><td class="t-forte"><a href="#/cadeiras/${encodeURIComponent(a.cadeiraId)}/${encodeURIComponent(a.assunto)}">${esc(a.assunto)}</a></td><td>${esc(nomeCadeira(m, a.cadeiraId))}</td><td>${a.e.total}</td><td>${pct(a.e.taxa)} ${barra(a.e.taxa, a.e.taxa < 0.6 ? 'ruim' : a.e.taxa < 0.8 ? 'medio' : 'bom')}</td><td>${seloDominio(a.d)}</td></tr>`).join('')}
      </tbody></table>` : vazio('Registre questões para ver o desempenho por assunto.')}</div></section>
    <section class="cartao"><header class="cartao-topo"><h2>${icone('relogio')}<span>Últimas registradas</span></h2></header>
      <div class="cartao-corpo">${qs.length ? `<table class="tabela"><thead><tr><th>Data</th><th>Resultado</th><th>Conf.</th><th>Cadeira · assunto</th><th>Motivos</th><th>Fonte</th></tr></thead><tbody>
        ${qs.slice(0, 40).map((q) => `<tr><td>${q.data ? formatoCurto(q.data) : ''}</td><td><span class="res res-${q.resultado.toLowerCase()}">${esc(q.resultado)}</span>${q.imagem ? ` <button class="link-botao" data-ver-imagem="${esc(q.imagem)}" title="Ver print">${icone('imagem', 'ic-mini')}</button>` : ''}</td><td>${q.confianca}</td><td>${esc(nomeCadeira(m, q.cadeiraId))} · ${esc(q.assunto)}</td><td class="meta">${esc(q.motivos.join(', '))}</td><td class="meta">${esc(q.fonte)}</td></tr>`).join('')}
      </tbody></table>` : vazio('Nenhuma questão registrada ainda.')}</div></section>`;

  ligarFiltros(el, estado, redesenhar);
  el.querySelectorAll('[data-ver-imagem]').forEach((b) => b.addEventListener('click', () => verImagem(b.dataset.verImagem)));
  el.querySelector('[data-nova]').addEventListener('click', () => novaQuestao(m, { cadeiraId: estado.cadeira }));
  el.querySelector('[data-detalhada]').addEventListener('click', () => novaQuestao(m, { cadeiraId: lote.cadeira, assunto: lote.assunto, fonte: lote.fonte }));
  const ler = () => {
    lote.cadeira = el.querySelector('#lote-cadeira').value;
    lote.assunto = el.querySelector('#lote-assunto').value.trim();
    lote.fonte = el.querySelector('#lote-fonte').value.trim();
    lote.confianca = el.querySelector('#lote-conf').value;
  };
  el.querySelector('#lote-cadeira').addEventListener('change', () => {
    ler();
    el.querySelector('#lote-assuntos').innerHTML = assuntosDaCadeira(m, lote.cadeira).map((a) => `<option value="${esc(a)}">`).join('');
  });
  el.querySelectorAll('[data-lote]').forEach((b) =>
    b.addEventListener('click', async () => {
      ler();
      if (!lote.cadeira || !lote.assunto) {
        aviso('Escolha a cadeira e o assunto primeiro.');
        return;
      }
      b.disabled = true;
      try {
        await adicionar('Questoes', { id: novoId('Q'), data: m.hoje, cadeira_id: lote.cadeira, assunto: lote.assunto, fonte: lote.fonte, resultado: b.dataset.lote, confianca: lote.confianca, motivos: '', obs: '' }, { silencioso: true });
        lote.contagem += 1;
        aviso(`${b.dataset.lote} — registrada${emSimulacao() ? ' (simulação)' : ''}.`);
        avisarMudanca();
      } catch (e) {
        b.disabled = false;
        aviso(e.message);
      }
    })
  );
}
