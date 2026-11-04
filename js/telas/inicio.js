// Tela INÍCIO — tudo o que importa hoje numa tela só, sem rolar muito:
// números do estudo ativo, semana com a agenda do dia, avaliações,
// pendências, sugestões de estudo (com motivo) e atalhos de IA.

import { esc } from '../util/texto.js';
import { formatoLongo, formatoCurto, contagemDias, DIAS_CURTOS, diaDaSemana, inicioDaSemana, somarDias, deISO, diasEntre } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { cartao, vazio, aviso, copiar, kpi, estaAberto, lembrarAberto } from '../ui/componentes.js';
import { atualizar } from '../dados/dataSource.js';
import { novaAvaliacao, novoEstudo, novaPendencia, editarAvaliacao } from './formularios.js';
import { linhaEstudo, ligarEstudos, linhaAvaliacao, ligarAvaliacoes } from './cadeiras.js';
import { aulasDoDia, estudosDoDia, avaliacoesDoDia, feriadoDoDia, proximasAvaliacoes, pendenciasAbertas, nomeCadeira } from '../dados/consultas.js';
import { gerarSugestoes } from '../regras/sugestoes.js';
import { cartoesVencidos } from './metodo.js';
import { estatisticaQuestoes } from '../regras/dominio.js';

const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
let diaSel = null;

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

const linkCadeira = (m, id, assunto = '') =>
  id ? `<a class="tag" href="#/cadeiras/${encodeURIComponent(id)}${assunto ? `/${encodeURIComponent(assunto)}` : ''}">${esc(nomeCadeira(m, id))}</a>` : '';

function faixaSemana(m) {
  const ini = inicioDaSemana(diaSel);
  return `<div class="semana-mini" role="group" aria-label="Escolher dia">
    <button class="sm-seta" data-semana="-7" aria-label="Semana anterior">${icone('anterior', 'ic-mini')}</button>
    ${Array.from({ length: 7 }, (_, i) => somarDias(ini, i)).map((d) => {
      const nAulas = aulasDoDia(m, d).length;
      const temAv = avaliacoesDoDia(m, d).length;
      const temEst = estudosDoDia(m, d).length;
      return `<button class="sm-dia ${d === diaSel ? 'sel' : ''} ${d === m.hoje ? 'hoje' : ''}" data-dia="${d}" aria-pressed="${d === diaSel}">
        <span>${DIAS_CURTOS[diaDaSemana(d)]}</span><b>${deISO(d).getDate()}</b>
        <i class="sm-pontos">${nAulas ? '<em class="p-aula"></em>' : ''}${temEst ? '<em class="p-estudo"></em>' : ''}${temAv ? '<em class="p-av"></em>' : ''}</i>
      </button>`;
    }).join('')}
    <button class="sm-seta" data-semana="7" aria-label="Próxima semana">${icone('proximo', 'ic-mini')}</button>
  </div>`;
}

function agendaDia(m) {
  const d = diaSel;
  const feriado = feriadoDoDia(m, d);
  const itens = [
    ...avaliacoesDoDia(m, d).map((a) => ({ hora: a.hora, fim: a.fim, html: `<li class="ag-av" data-avaliacao="${esc(a.id)}" role="button" tabindex="0"><span class="hora">${esc(a.hora || '—')}</span><div><strong>${icone('alerta', 'ic-mini')} ${esc(a.titulo)}</strong><p class="meta">${esc(nomeCadeira(m, a.cadeiraId))} · ${esc(a.tipo)} · toque para abrir</p></div></li>` })),
    ...aulasDoDia(m, d).map((a) => ({ hora: a.inicio, html: `<li><span class="hora">${esc(a.inicio)}<small>${esc(a.fim)}</small></span><div><a class="t-forte" href="#/cadeiras/${encodeURIComponent(a.cadeiraId)}/${encodeURIComponent(a.assunto)}">${esc(a.assunto)}</a><p class="meta">${linkCadeira(m, a.cadeiraId)} ${esc(a.tipo)}${a.turma !== 'Todas' ? ` · ${esc(a.turma)}` : ''}${a.local ? ` · ${esc(a.local)}` : ''}</p></div><a class="btn-mini btn-abrir" href="#/cadeiras/${encodeURIComponent(a.cadeiraId)}/${encodeURIComponent(a.assunto)}">Abrir assunto ${icone('seta', 'ic-mini')}</a></li>` })),
    ...estudosDoDia(m, d).map((e) => ({ hora: e.inicio || '99', html: linhaEstudo(m, e) })),
  ].sort((a, b) => (a.hora || '00').localeCompare(b.hora || '00'));
  const rotulo = d === m.hoje ? 'Hoje' : maiuscula(formatoLongo(d));
  return `
    <p class="agenda-dia-titulo">${esc(rotulo)}${feriado ? ` · ${icone('feriado', 'ic-mini')} ${esc(feriado.nome)}` : ''}</p>
    ${itens.length ? `<ul class="agenda">${itens.map((i) => i.html).join('')}</ul>` : vazio(feriado ? 'Feriado, sem aulas.' : 'Nada neste dia.')}
    ${semData(m)}`;
}

/** Estudos marcados sem data: escolha na hora de montar o dia. */
function semData(m) {
  const lista = m.estudos.filter((e) => !e.data && !e.feito);
  if (!lista.length) return '';
  return `<details class="sem-data" data-lembrar="inicio-sem-data" ${estaAberto('inicio-sem-data', true) ? 'open' : ''}>
    <summary>Para estudar, sem data <span class="contador">${lista.length}</span></summary>
    <ul class="lista-estudos">${lista.map((e) => linhaEstudo(m, e, { botaoHoje: true })).join('')}</ul>
  </details>`;
}

function blocoAvaliacoes(m) {
  const avs = proximasAvaliacoes(m, 5);
  if (!avs.length) return vazio('Nenhuma avaliação marcada.');
  return `<ul class="linha-avaliacoes clicavel">${avs.map((a) => linhaAvaliacao(m, a)).join('')}</ul>`;
}

function blocoPendencias(m) {
  const ps = pendenciasAbertas(m);
  if (!ps.length) return vazio('Nenhuma pendência aberta.');
  return `<ul class="lista-pendencias compacta">${ps.slice(0, 5).map((p) => `
    <li>
      <span class="prioridade p-${esc(p.prioridade.toLowerCase())}" title="Prioridade ${esc(p.prioridade)}"></span>
      <div><strong>${esc(p.descricao)}</strong><p class="meta">${p.faltam === null ? '' : `<span class="prazo ${p.faltam < 0 ? 'atrasada' : p.faltam <= 1 ? 'proxima' : ''}">${p.faltam < 0 ? `atrasada ${-p.faltam} d` : esc(contagemDias(m.hoje, p.prazo))}</span> `}${p.cadeiraId ? esc(nomeCadeira(m, p.cadeiraId)) : ''}</p></div>
      <button class="btn-concluir" data-pendencia="${esc(p.id)}" title="Marcar como feita" aria-label="Marcar como feita: ${esc(p.descricao)}">${icone('check', 'ic-mini')}</button>
    </li>`).join('')}</ul>${ps.length > 5 ? `<a class="link-discreto" href="#/pendencias">Ver todas (${ps.length}) ${icone('seta', 'ic-mini')}</a>` : ''}`;
}

function blocoSugestoes(m, sugestoes) {
  if (!sugestoes.length) return vazio('Tudo em dia. Nenhuma sugestão pelas regras atuais.');
  return `<ol class="sugestoes">${sugestoes.map((s, i) => `
    <li class="sug-${esc(s.regra)}">
      <div class="sug-topo"><span class="sug-n">${i + 1}</span><strong>${esc(s.titulo)}</strong>
        <button class="btn-mini" data-marcar="${i}" title="Marcar como estudo de hoje">+ marcar</button></div>
      <p class="motivo">${esc(s.motivo)}</p>
    </li>`).join('')}</ol>`;
}

function contextosIA(m, sugestoes) {
  const itens = [
    ...aulasDoDia(m, m.hoje).map((a) => ({ cadeira: nomeCadeira(m, a.cadeiraId), assunto: a.assunto })),
    ...sugestoes.map((s) => ({ cadeira: nomeCadeira(m, s.cadeiraId), assunto: s.assunto })),
  ];
  const vistos = new Set();
  return itens.filter((i) => {
    const k = `${i.cadeira}|${i.assunto}`;
    return vistos.has(k) ? false : vistos.add(k);
  });
}

function blocoAtalhos(m, contextos) {
  if (!m.config.atalhosIA.length) return vazio('Nenhum atalho na aba Config.');
  return `
    <select id="ia-contexto" class="filtro-select largo" aria-label="Assunto do atalho">
      ${contextos.map((c, i) => `<option value="${i}">${esc(c.assunto)} — ${esc(c.cadeira)}</option>`).join('')}
      <option value="livre">Outro assunto (digitar)…</option>
    </select>
    <div class="atalhos">${m.config.atalhosIA.map((a, i) => `<button class="btn-atalho" data-atalho="${i}">${icone('ia', 'ic-mini')}<span>${esc(a.nome)}</span></button>`).join('')}</div>
    <p class="nota">Copia o prompt e abre o chat. Usa sua assinatura; nenhuma IA paga é chamada.</p>`;
}

export function render(el, m) {
  if (!diaSel || Math.abs(diasEntre(m.hoje, diaSel)) > 60) diaSel = m.hoje;
  const sugestoes = gerarSugestoes(m);
  const contextos = contextosIA(m, sugestoes);
  const venc = cartoesVencidos(m).length;
  const abertas = m.duvidas.filter((d) => !d.sanada).length;
  const q7 = estatisticaQuestoes(m.questoes.filter((q) => diasEntre(q.data || m.hoje, m.hoje) <= 7));
  const prox = proximasAvaliacoes(m, 1)[0];
  const pend = pendenciasAbertas(m);
  const atrasadas = pend.filter((p) => p.faltam !== null && p.faltam < 0).length;
  const estHoje = estudosDoDia(m, m.hoje);

  el.innerHTML = `
    <header class="cabecalho cabecalho-inicio">
      <div><p class="sobretitulo">${esc(maiuscula(formatoLongo(m.hoje)))}</p>
      <h1>${saudacao()}${m.config.aluna ? `, ${esc(m.config.aluna)}` : ''}</h1></div>
    </header>
    <div class="kpis kpis-inicio">
      ${kpi({ rotulo: 'Aulas hoje', valor: aulasDoDia(m, m.hoje).length, iconeNome: 'aula', href: '#/calendario' })}
      ${kpi({ rotulo: 'Estudos de hoje', valor: `${estHoje.filter((e) => e.feito).length}/${estHoje.length}`, iconeNome: 'estudo', tom: estHoje.length && estHoje.every((e) => e.feito) ? 'ok' : '' })}
      ${kpi({ rotulo: 'Próxima avaliação', valor: prox ? (prox.faltam === 0 ? 'hoje' : `${prox.faltam} d`) : '—', sub: prox ? nomeCadeira(m, prox.cadeiraId) : '', iconeNome: 'avaliacoes', tom: prox && prox.faltam <= 7 ? 'alerta' : '', href: '#/avaliacoes' })}
      ${kpi({ rotulo: 'Revisões vencidas', valor: venc, iconeNome: 'metodo', tom: venc ? 'alerta' : '', href: '#/metodo' })}
      ${kpi({ rotulo: 'Dúvidas abertas', valor: abertas, iconeNome: 'duvidas', href: '#/duvidas' })}
      ${kpi({ rotulo: 'Questões (7 dias)', valor: q7.total ? `${Math.round(q7.taxa * 100)}%` : '—', sub: q7.total ? `${q7.total} feitas` : 'nenhuma', iconeNome: 'questoes', href: '#/questoes' })}
      ${kpi({ rotulo: 'Pendências', valor: pend.length, sub: atrasadas ? `${atrasadas} atrasada(s)` : '', iconeNome: 'pendencias', tom: atrasadas ? 'alerta' : '', href: '#/pendencias' })}
    </div>

    <div class="grade-inicio">
      ${cartao({ titulo: 'Semana', iconeNome: 'calendario', classe: 'c-agenda', corpo: faixaSemana(m) + agendaDia(m),
        extra: `<span class="cartao-extras"><button class="btn-novo" data-novo="estudo">+ Estudo</button><a class="link-discreto" href="#/calendario">${icone('seta', 'ic-mini')}</a></span>` })}
      <div class="coluna">
        ${cartao({ titulo: 'Próximas avaliações', iconeNome: 'avaliacoes', corpo: blocoAvaliacoes(m), extra: '<button class="btn-novo" data-novo="avaliacao">+</button>' })}
        ${cartao({ titulo: 'Pendências', iconeNome: 'pendencias', corpo: blocoPendencias(m), extra: '<button class="btn-novo" data-novo="pendencia">+</button>' })}
      </div>
      <div class="coluna">
        ${cartao({ titulo: 'Sugestão de estudo', iconeNome: 'lampada', corpo: blocoSugestoes(m, sugestoes), classe: 'c-sugestoes' })}
        ${cartao({ titulo: 'Atalhos de IA', iconeNome: 'ia', corpo: blocoAtalhos(m, contextos), classe: 'c-atalhos' })}
      </div>
    </div>`;

  // Semana: escolher dia / trocar semana
  el.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', () => {
    diaSel = b.dataset.dia;
    render(el, m);
  }));
  el.querySelectorAll('[data-semana]').forEach((b) => b.addEventListener('click', () => {
    diaSel = somarDias(diaSel, +b.dataset.semana);
    render(el, m);
  }));

  ligarEstudos(el, m);
  ligarAvaliacoes(el, m);
  lembrarAberto(el);

  el.querySelectorAll('[data-pendencia]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await atualizar('Pendencias', btn.dataset.pendencia, { status: 'Feita' });
        aviso('Pendência concluída.');
      } catch (erro) {
        btn.disabled = false;
        aviso(erro.message);
      }
    })
  );

  el.querySelectorAll('[data-marcar]').forEach((b) => b.addEventListener('click', () => {
    const s = sugestoes[+b.dataset.marcar];
    novoEstudo(m, { data: m.hoje, cadeiraId: s.cadeiraId, assunto: s.assunto, atividade: s.titulo });
  }));

  const novos = { estudo: () => novoEstudo(m, { data: '' }), avaliacao: () => novaAvaliacao(m), pendencia: () => novaPendencia(m) };
  el.querySelectorAll('[data-novo]').forEach((btn) => btn.addEventListener('click', () => novos[btn.dataset.novo]()));

  el.querySelectorAll('[data-atalho]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const atalho = m.config.atalhosIA[+btn.dataset.atalho];
      const escolha = el.querySelector('#ia-contexto').value;
      let ctx = contextos[+escolha];
      if (escolha === 'livre' || !ctx) {
        const assunto = prompt('Sobre qual assunto?');
        if (!assunto) return;
        ctx = { assunto, cadeira: '' };
      }
      const texto = atalho.prompt
        .replaceAll('{assunto}', ctx.assunto)
        .replaceAll('{cadeira}', ctx.cadeira || 'Medicina')
        .replaceAll('{periodo}', m.config.periodo)
        .replace(/\s\(\)/g, '');
      if (await copiar(texto, 'Prompt copiado — cole no chat que abriu.')) window.open(m.config.iaUrl, '_blank', 'noopener');
    })
  );
}
