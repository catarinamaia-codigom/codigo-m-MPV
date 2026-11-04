// Tela CADEIRAS — Período > Módulo > Cadeira > Assunto.
// Lista compacta por módulo, página da cadeira (assuntos com contadores e
// domínio) e página do ASSUNTO, onde tudo é registrado já com o contexto.

import { esc, nomeArquivo } from '../util/texto.js';
import { formatoCurto, contagemDias, DIAS_CURTOS, diaDaSemana, diasEntre } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { vazio, copiar, seloDominio, barra, kpi } from '../ui/componentes.js';
import { cadeiraPorId, moduloPorId, aulasDaCadeira, avaliacoesDaCadeira } from '../dados/consultas.js';
import { novaAvaliacao, novaDuvida, novaQuestao, novoMaterial, novoCartao, novoEstudo } from './formularios.js';
import { assuntosDaCadeira, dominioAssunto, dominioCadeira, mesmoAssunto, estatisticaQuestoes, NIVEIS } from '../regras/dominio.js';
import { cartaoDuvida, ligarDuvidas } from './duvidas.js';
import { linhaMaterial, ligarMateriais } from './materiais.js';
import { revisarAssunto, cartoesVencidos } from './metodo.js';
import { calcularMedia } from '../regras/notas.js';

const dataCurta = (d) => `${DIAS_CURTOS[diaDaSemana(d)]} ${formatoCurto(d)}`;
const pct = (x) => (x === null ? '—' : `${Math.round(x * 100)}%`);

function resumoCadeira(m, c) {
  const aulas = aulasDaCadeira(m, c.id);
  const dadas = aulas.filter((a) => a.data < m.hoje).length;
  const proxAula = aulas.find((a) => a.data >= m.hoje);
  const proxAv = avaliacoesDaCadeira(m, c.id).find((a) => a.data >= m.hoje);
  return { aulas, dadas, proxAula, proxAv };
}

function lista(el, m) {
  el.innerHTML = `
    <header class="cabecalho"><p class="sobretitulo">${esc(m.config.periodo)} · ${esc(m.config.semestre)}</p><h1>Cadeiras</h1></header>
    ${m.modulos.map((mod) => {
      const cads = m.cadeiras.filter((c) => c.moduloId === mod.id);
      return `
        <section class="modulo">
          <h2 class="modulo-titulo">${esc(mod.nome)} <small>${cads.length} ${cads.length === 1 ? 'cadeira' : 'cadeiras'}</small></h2>
          <div class="grade-cadeiras">
            ${cads.map((c) => {
              const r = resumoCadeira(m, c);
              const dom = dominioCadeira(m, c.id);
              const abertas = m.duvidas.filter((d) => d.cadeiraId === c.id && !d.sanada).length;
              const pctAulas = r.aulas.length ? r.dadas / r.aulas.length : 0;
              return `
                <a class="cartao cartao-cadeira" href="#/cadeiras/${encodeURIComponent(c.id)}">
                  <div class="cc-topo">
                    <h3>${esc(c.nome)}</h3>
                    ${r.proxAv ? `<span class="selo-av ${diasEntre(m.hoje, r.proxAv.data) <= 7 ? 'perto' : ''}">${icone('alerta', 'ic-mini')} ${esc(contagemDias(m.hoje, r.proxAv.data))}</span>` : ''}
                  </div>
                  <div class="cc-linha">${barra(pctAulas)}<span class="meta">${r.dadas}/${r.aulas.length} aulas</span></div>
                  <div class="cc-linha"><span class="meta">Domínio</span><span class="dominio d${dom.nivel}">${'●'.repeat(dom.nivel)}${'○'.repeat(5 - dom.nivel)}</span>${abertas ? `<span class="tag tag-alerta">${abertas} dúvida${abertas > 1 ? 's' : ''}</span>` : ''}</div>
                  <p class="cc-prox">${r.proxAula ? `${esc(dataCurta(r.proxAula.data))} · ${esc(r.proxAula.assunto)}` : 'Sem próximas aulas'}</p>
                </a>`;
            }).join('')}
          </div>
        </section>`;
    }).join('')}`;
}

function contadores(m, cadeiraId, assunto) {
  const daqui = (x) => x.cadeiraId === cadeiraId && mesmoAssunto(x.assunto, assunto);
  const mat = m.materiais.filter(daqui).length;
  const duv = m.duvidas.filter((d) => daqui(d) && !d.sanada).length;
  const q = estatisticaQuestoes(m.questoes.filter(daqui));
  const car = m.cartoes.filter(daqui).length;
  return `<span class="contadores">
    ${mat ? `<span title="Materiais">${icone('materiais', 'ic-mini')}${mat}</span>` : ''}
    ${duv ? `<span class="c-alerta" title="Dúvidas abertas">${icone('duvidas', 'ic-mini')}${duv}</span>` : ''}
    ${q.total ? `<span title="Questões: acerto">${icone('questoes', 'ic-mini')}${pct(q.taxa)}</span>` : ''}
    ${car ? `<span title="Cartões">${icone('flashcard', 'ic-mini')}${car}</span>` : ''}
  </span>`;
}

function detalhe(el, m, id) {
  const c = cadeiraPorId(m, id);
  if (!c) {
    el.innerHTML = `<div class="erro"><h1>Cadeira não encontrada</h1><p><a href="#/cadeiras">Voltar para Cadeiras</a></p></div>`;
    return;
  }
  const mod = moduloPorId(m, c.moduloId);
  const r = resumoCadeira(m, c);
  const avs = avaliacoesDaCadeira(m, c.id);
  const assuntos = assuntosDaCadeira(m, c.id);
  const dom = dominioCadeira(m, c.id);
  const abertas = m.duvidas.filter((d) => d.cadeiraId === c.id && !d.sanada);
  const notas = calcularMedia(m.notas.filter((n) => n.cadeiraId === c.id), m.config.notas);

  el.innerHTML = `
    <header class="cabecalho cabecalho-linha">
      <div><p class="sobretitulo">${esc(mod?.nome ?? '')}</p><h1>${esc(c.nome)}</h1></div>
      <div class="acoes-topo">
        <button class="btn" data-acao="duvida">${icone('duvidas', 'ic-mini')} Dúvida</button>
        <button class="btn" data-acao="questao">${icone('questoes', 'ic-mini')} Questão</button>
        <button class="btn" data-acao="material">${icone('materiais', 'ic-mini')} Material</button>
      </div>
    </header>
    <div class="kpis">
      ${kpi({ rotulo: 'Aulas dadas', valor: `${r.dadas}/${r.aulas.length}` })}
      ${kpi({ rotulo: 'Domínio médio', valor: dom.vistos ? `${String(dom.media).replace('.', ',')}/5` : '—', sub: dom.vistos ? NIVEIS[dom.nivel].nome : 'nenhum assunto visto' })}
      ${kpi({ rotulo: 'Dúvidas abertas', valor: abertas.length, tom: abertas.length ? 'alerta' : '', href: '#/duvidas' })}
      ${kpi({ rotulo: 'Nota', valor: notas.vazio ? '—' : String(notas.media ?? notas.garantida).replace('.', ','), sub: notas.vazio ? 'sem notas' : notas.media !== null ? 'média final' : 'garantido até agora', href: '#/avaliacoes' })}
      ${r.proxAv ? kpi({ rotulo: 'Próxima avaliação', valor: contagemDias(m.hoje, r.proxAv.data), sub: r.proxAv.titulo, tom: diasEntre(m.hoje, r.proxAv.data) <= 7 ? 'alerta' : '' }) : ''}
    </div>

    <div class="grade-cadeira">
      <section class="cartao">
        <header class="cartao-topo"><h2>${icone('resumo')}<span>Assuntos</span></h2><span class="meta">${assuntos.length}</span></header>
        <div class="cartao-corpo">
          <ol class="assuntos">${assuntos.map((a) => {
            const aulas = r.aulas.filter((x) => mesmoAssunto(x.assunto, a));
            const d = dominioAssunto(m, c.id, a);
            const datas = aulas.map((x) => x.data);
            const proxima = datas.find((x) => x >= m.hoje);
            const ultima = [...datas].reverse().find((x) => x < m.hoje);
            return `<li class="assunto ${d.nivel === 0 ? 'futuro' : ''}">
              <a href="#/cadeiras/${encodeURIComponent(c.id)}/${encodeURIComponent(a)}">
                <span class="assunto-nome">${esc(a)}</span>
                <span class="assunto-datas meta">${proxima ? `${proxima === m.hoje ? 'hoje' : dataCurta(proxima)}` : ultima ? dataCurta(ultima) : 'sem aula'}${aulas.length > 1 ? ` · ${aulas.length} aulas` : ''}</span>
                ${contadores(m, c.id, a)}
                ${seloDominio(d)}
              </a></li>`;
          }).join('') || vazio('Nenhuma aula cadastrada.')}</ol>
        </div>
      </section>
      <div class="coluna">
        <section class="cartao">
          <header class="cartao-topo"><h2>${icone('avaliacoes')}<span>Avaliações</span></h2><button class="btn-novo" data-nova-avaliacao>+</button></header>
          <div class="cartao-corpo">${avs.length ? `<ul class="linha-avaliacoes">${avs.map((a) => {
            const n = diasEntre(m.hoje, a.data);
            return `<li class="${n < 0 ? 'passada' : n <= 3 ? 'urgente' : ''}"><span class="contagem">${n < 0 ? '<small>feita</small>' : `<b>${n === 0 ? 'hoje' : n}</b>${n === 0 ? '' : n === 1 ? 'dia' : 'dias'}`}</span>
              <span><strong>${esc(a.titulo)}</strong><small class="meta">${formatoCurto(a.data)}${a.hora ? ` ${esc(a.hora)}` : ''} · ${esc(a.tipo)}${a.obs ? ` · ${esc(a.obs)}` : ''}</small></span></li>`;
          }).join('')}</ul>` : vazio('Nenhuma avaliação cadastrada.')}</div>
        </section>
        <section class="cartao">
          <header class="cartao-topo"><h2>${icone('duvidas')}<span>Dúvidas abertas</span></h2></header>
          <div class="cartao-corpo lista-duvidas compacta">${abertas.slice(0, 6).map((d) => cartaoDuvida(m, d)).join('') || vazio('Nenhuma dúvida aberta.')}</div>
        </section>
      </div>
    </div>`;

  ligarDuvidas(el, m);
  el.querySelector('[data-nova-avaliacao]').addEventListener('click', () => novaAvaliacao(m, { cadeiraId: c.id }));
  const acoes = { duvida: novaDuvida, questao: novaQuestao, material: novoMaterial };
  el.querySelectorAll('[data-acao]').forEach((b) => b.addEventListener('click', () => acoes[b.dataset.acao](m, { cadeiraId: c.id })));
}

function paginaAssunto(el, m, id, assunto) {
  const c = cadeiraPorId(m, id);
  if (!c) return detalhe(el, m, id);
  const daqui = (x) => x.cadeiraId === id && mesmoAssunto(x.assunto, assunto);
  const aulas = m.aulas.filter(daqui);
  const d = dominioAssunto(m, id, assunto);
  const duvidas = m.duvidas.filter(daqui);
  const materiais = m.materiais.filter(daqui);
  const qs = m.questoes.filter(daqui);
  const est = estatisticaQuestoes(qs);
  const cartoes = m.cartoes.filter(daqui);
  const vencidos = cartoesVencidos(m, daqui).length + cartoes.filter((x) => !x.revisoes).length;
  const estudos = m.estudos.filter(daqui);
  const tipos = m.config.tiposMaterial;
  const dataBase = aulas.find((a) => a.data <= m.hoje)?.data ?? aulas[0]?.data ?? m.hoje;

  el.innerHTML = `
    <header class="cabecalho cabecalho-linha">
      <div><p class="sobretitulo"><a href="#/cadeiras/${encodeURIComponent(id)}">${esc(c.nome)}</a></p><h1>${esc(assunto)}</h1>
        <p class="dominio-linha">${seloDominio(d)} <span class="meta">${esc(d.motivo)}</span></p></div>
    </header>
    <div class="barra-acoes">
      <button class="btn" data-acao="duvida">${icone('duvidas', 'ic-mini')} + Dúvida</button>
      <button class="btn" data-acao="questao">${icone('questoes', 'ic-mini')} + Questão</button>
      <button class="btn" data-acao="material">${icone('materiais', 'ic-mini')} + Material</button>
      <button class="btn" data-acao="cartao">${icone('flashcard', 'ic-mini')} + Cartão</button>
      <button class="btn" data-acao="estudo">${icone('estudo', 'ic-mini')} + Estudo</button>
      ${cartoes.length ? `<button class="btn btn-principal" data-revisar>${icone('metodo', 'ic-mini')} Revisar (${vencidos})</button>` : ''}
    </div>
    <div class="grade-cadeira">
      <div class="coluna">
        <section class="cartao"><header class="cartao-topo"><h2>${icone('aula')}<span>Aulas</span></h2></header>
          <div class="cartao-corpo">${aulas.length ? `<ul class="assunto-aulas">${aulas.map((a) => `<li class="${a.data === m.hoje ? 'hoje' : ''}">
            <span class="t-forte">${esc(dataCurta(a.data))} · ${esc(a.inicio)}–${esc(a.fim)}</span>
            <span>${esc(a.tipo)}${a.turma !== 'Todas' ? ` · ${esc(a.turma)}` : ''}</span>
            <span class="meta">${esc([a.professor, a.local].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>` : vazio('Sem aula no cronograma para este assunto.')}</div></section>
        <section class="cartao"><header class="cartao-topo"><h2>${icone('materiais')}<span>Materiais</span></h2><span class="meta">${materiais.length}</span></header>
          <div class="cartao-corpo">${materiais.length ? `<ul class="lista-materiais">${materiais.map((x) => linhaMaterial(m, x, { mostrarCadeira: false })).join('')}</ul>` : vazio('Nenhum material ligado a este assunto.')}
            <div class="ferramenta-arquivo"><span class="meta">Nome de arquivo:</span>
              <select id="tipo-arquivo" aria-label="Tipo de material">${tipos.map((t, i) => `<option value="${i}" ${i === 1 ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select>
              <button class="btn-mini" data-nome-arquivo>${icone('copiar', 'ic-mini')} copiar</button></div>
          </div></section>
        <section class="cartao"><header class="cartao-topo"><h2>${icone('estudo')}<span>Estudos</span></h2></header>
          <div class="cartao-corpo">${estudos.length ? `<ul class="lista-simples">${estudos.map((e) => `<li class="${e.feito ? 'feito' : ''}"><b>${e.feito ? '✓ ' : ''}${esc(e.atividade)}</b><span class="meta">${formatoCurto(e.data)}</span></li>`).join('')}</ul>` : vazio('Nenhum estudo marcado para este assunto.')}</div></section>
      </div>
      <div class="coluna">
        <section class="cartao"><header class="cartao-topo"><h2>${icone('duvidas')}<span>Dúvidas</span></h2><span class="meta">${duvidas.filter((x) => !x.sanada).length} abertas</span></header>
          <div class="cartao-corpo lista-duvidas compacta">${duvidas.map((x) => cartaoDuvida(m, x, { mostrarCadeira: false })).join('') || vazio('Nenhuma dúvida registrada.')}</div></section>
        <section class="cartao"><header class="cartao-topo"><h2>${icone('questoes')}<span>Questões</span></h2></header>
          <div class="cartao-corpo">${est.total ? `<p><b>${pct(est.taxa)}</b> de acerto efetivo em ${est.total} questão(ões) · ${est.chutes} chute(s) · ${est.aprofundar} pedem aprofundamento</p>
            <ul class="lista-simples">${qs.slice(0, 6).map((q) => `<li><span class="res res-${q.resultado.toLowerCase()}">${esc(q.resultado)}</span><span class="meta">${q.data ? formatoCurto(q.data) : ''} · conf. ${q.confianca}${q.motivos.length ? ` · ${esc(q.motivos.join(', '))}` : ''}</span></li>`).join('')}</ul>` : vazio('Nenhuma questão registrada.')}</div></section>
        <section class="cartao"><header class="cartao-topo"><h2>${icone('flashcard')}<span>Cartões</span></h2><span class="meta">${cartoes.length}</span></header>
          <div class="cartao-corpo">${cartoes.length ? `<ul class="lista-simples">${cartoes.slice(0, 6).map((x) => `<li><b>${esc(x.frente.slice(0, 100))}</b><span class="meta">${x.revisoes ? `próxima ${formatoCurto(x.vence)}` : 'novo'}</span></li>`).join('')}</ul>` : vazio('Sem cartões. Transforme uma dúvida sanada em cartão.')}</div></section>
      </div>
    </div>`;

  ligarDuvidas(el, m);
  ligarMateriais(el);
  const ctx = { cadeiraId: id, assunto };
  const acoes = { duvida: novaDuvida, questao: novaQuestao, material: novoMaterial, cartao: novoCartao, estudo: (mm, x) => novoEstudo(mm, { ...x, data: m.hoje }) };
  el.querySelectorAll('[data-acao]').forEach((b) => b.addEventListener('click', () => acoes[b.dataset.acao](m, ctx)));
  el.querySelector('[data-revisar]')?.addEventListener('click', () => revisarAssunto(id, assunto));
  el.querySelector('[data-nome-arquivo]').addEventListener('click', () => {
    const tipo = tipos[+el.querySelector('#tipo-arquivo').value];
    const nome = nomeArquivo({
      periodo: m.config.periodo, tipo: tipo?.nome ?? 'Resumo', cadeira: c.nome.replace(/\s*\(.*\)\s*/, ''),
      assunto, data: dataBase, aluna: m.config.aluna, ext: tipo?.icone === 'video' ? 'mp4' : 'pdf',
    });
    copiar(nome, `Copiado: ${nome}`);
  });
}

export function render(el, m, [id, assunto]) {
  if (id && assunto) paginaAssunto(el, m, id, assunto);
  else if (id) detalhe(el, m, id);
  else lista(el, m);
}
