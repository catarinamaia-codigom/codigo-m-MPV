// Tela CALENDÁRIO — visão semanal e mensal.
// Cores: aulas em tom neutro, estudo em vermelho suave,
// avaliações em vermelho forte com ícone. Só turma TA (TA, TA1, TA2).

import { esc } from '../util/texto.js';
import {
  somarDias, inicioDaSemana, deISO, paraISO, DIAS_CURTOS, MESES, formatoLongo, diaDaSemana,
} from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { abrirModal } from '../ui/componentes.js';
import { nomeCadeira, cadeiraPorId, moduloPorId, feriadoDoDia } from '../dados/consultas.js';

const CHAVE_VISAO = 'codigom.calendario.visao'; // só preferência de exibição
const estado = { visao: lerVisao(), ref: null };

function lerVisao() {
  try {
    return localStorage.getItem(CHAVE_VISAO) || 'semana';
  } catch {
    return 'semana';
  }
}
function salvarVisao(v) {
  try {
    localStorage.setItem(CHAVE_VISAO, v);
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

/** Reúne aulas, estudos e avaliações de um dia num formato único. */
function eventosDoDia(m, data) {
  const ev = [
    ...m.avaliacoes.filter((a) => a.data === data).map((a) => ({
      tipo: 'avaliacao', id: a.id, inicio: a.hora, fim: a.fim, titulo: a.titulo,
      sub: `${nomeCadeira(m, a.cadeiraId)} · ${a.tipo}`, ordem: 0,
    })),
    ...m.aulas.filter((a) => a.data === data).map((a) => ({
      tipo: 'aula', id: a.id, inicio: a.inicio, fim: a.fim, titulo: a.assunto,
      sub: `${nomeCadeira(m, a.cadeiraId)} · ${a.tipo}${a.turma !== 'Todas' ? ` · ${a.turma}` : ''}`, ordem: 1,
    })),
    ...m.estudos.filter((e) => e.data === data).map((e) => ({
      tipo: 'estudo', id: e.id, inicio: e.inicio, fim: e.fim, titulo: e.atividade,
      sub: `${nomeCadeira(m, e.cadeiraId)}${e.assunto ? ` · ${e.assunto}` : ''}`, feito: e.feito, ordem: 2,
    })),
  ];
  return ev.sort((a, b) => (a.inicio || '99').localeCompare(b.inicio || '99') || a.ordem - b.ordem);
}

const ROTULO = { aula: 'Aula', estudo: 'Estudo', avaliacao: 'Avaliação' };

function cartaoEvento(e) {
  return `
    <button class="evento ev-${e.tipo} ${e.feito ? 'ev-feito' : ''}" data-tipo="${e.tipo}" data-id="${esc(e.id)}">
      <span class="ev-hora">${e.tipo === 'avaliacao' ? icone('alerta', 'ic-mini') : ''}${esc(e.inicio || '')}${e.fim ? `–${esc(e.fim)}` : ''}${e.feito ? ` ${icone('check', 'ic-mini')}` : ''}</span>
      <span class="ev-titulo">${esc(e.titulo)}</span>
      <span class="ev-sub">${esc(e.sub)}</span>
    </button>`;
}

function visaoSemana(m) {
  const ini = inicioDaSemana(estado.ref);
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(ini, i));
  return `<div class="semana">${dias.map((d) => {
    const ev = eventosDoDia(m, d);
    const feriado = feriadoDoDia(m, d);
    const fds = [0, 6].includes(diaDaSemana(d));
    return `
      <section class="dia ${d === m.hoje ? 'hoje' : ''} ${fds && !ev.length ? 'dia-vazio' : ''}" aria-label="${esc(formatoLongo(d))}">
        <header class="dia-topo">
          <span class="dia-nome">${DIAS_CURTOS[diaDaSemana(d)]}</span>
          <span class="dia-num">${deISO(d).getDate()}</span>
          ${d === m.hoje ? '<span class="selo-hoje">hoje</span>' : ''}
        </header>
        ${feriado ? `<p class="feriado">${icone('feriado', 'ic-mini')} ${esc(feriado.nome)}</p>` : ''}
        <div class="dia-eventos">${ev.map(cartaoEvento).join('') || (feriado ? '' : '<p class="livre">livre</p>')}</div>
      </section>`;
  }).join('')}</div>`;
}

function visaoMes(m) {
  const ref = deISO(estado.ref);
  const primeiro = paraISO(new Date(ref.getFullYear(), ref.getMonth(), 1, 12));
  const ini = inicioDaSemana(primeiro);
  const mes = ref.getMonth();
  const ultimo = paraISO(new Date(ref.getFullYear(), mes + 1, 0, 12));
  const semanas = [];
  for (let s = ini; s <= ultimo; s = somarDias(s, 7)) {
    semanas.push(Array.from({ length: 7 }, (_, i) => somarDias(s, i)));
  }
  const MAX = 4;
  return `
    <div class="mes">
      ${['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((n) => `<div class="mes-cab">${n}</div>`).join('')}
      ${semanas.flat().map((d) => {
        const ev = eventosDoDia(m, d);
        const feriado = feriadoDoDia(m, d);
        const fora = deISO(d).getMonth() !== mes;
        return `
          <div class="mes-dia ${fora ? 'fora' : ''} ${d === m.hoje ? 'hoje' : ''}">
            <button class="mes-num" data-ir-semana="${d}" aria-label="Ver semana de ${esc(formatoLongo(d))}">${deISO(d).getDate()}</button>
            ${feriado ? `<span class="mes-feriado" title="${esc(feriado.nome)}">${esc(feriado.nome)}</span>` : ''}
            ${ev.slice(0, MAX).map((e) => `
              <button class="mini ev-${e.tipo} ${e.feito ? 'ev-feito' : ''}" data-tipo="${e.tipo}" data-id="${esc(e.id)}" title="${esc(`${e.inicio || ''} ${e.titulo} — ${e.sub}`)}">
                ${e.tipo === 'avaliacao' ? icone('alerta', 'ic-mini') : ''}<span>${esc(e.inicio || '')} ${esc(e.tipo === 'aula' ? e.sub.split(' · ')[0] : e.titulo)}</span>
              </button>`).join('')}
            ${ev.length > MAX ? `<button class="mini-mais" data-ir-semana="${d}">+${ev.length - MAX} mais</button>` : ''}
          </div>`;
      }).join('')}
    </div>`;
}

function tituloPeriodo() {
  if (estado.visao === 'mes') {
    const d = deISO(estado.ref);
    return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  }
  const ini = inicioDaSemana(estado.ref);
  const fim = somarDias(ini, 6);
  const a = deISO(ini), b = deISO(fim);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} de ${MESES[b.getMonth()]} de ${b.getFullYear()}`
    : `${a.getDate()} de ${MESES[a.getMonth()]} – ${b.getDate()} de ${MESES[b.getMonth()]} de ${b.getFullYear()}`;
}

function detalhe(m, tipo, id) {
  const linha = (rot, val) => (val ? `<div><dt>${rot}</dt><dd>${val}</dd></div>` : '');
  const cadeiraLink = (cid) => {
    const c = cadeiraPorId(m, cid);
    if (!c) return '';
    const mod = moduloPorId(m, c.moduloId);
    return `<a href="#/cadeiras/${encodeURIComponent(c.id)}">${esc(c.nome)}</a>${mod ? ` <span class="meta">· ${esc(mod.nome)}</span>` : ''}`;
  };
  const quando = (d, ini, fim) => `${esc(formatoLongo(d))}${ini ? `, ${esc(ini)}${fim ? `–${esc(fim)}` : ''}` : ''}`;

  if (tipo === 'aula') {
    const a = m.aulas.find((x) => x.id === id);
    abrirModal(a.assunto, `<dl class="detalhes">
      ${linha('Quando', quando(a.data, a.inicio, a.fim))}
      ${linha('Cadeira', cadeiraLink(a.cadeiraId))}
      ${linha('Tipo', esc(a.tipo))}
      ${linha('Turma', esc(a.turma))}
      ${linha('Local', esc(a.local))}
      ${linha('Professor(a)', esc(a.professor))}
    </dl>`);
  } else if (tipo === 'estudo') {
    const e = m.estudos.find((x) => x.id === id);
    abrirModal(e.atividade, `<dl class="detalhes">
      ${linha('Quando', quando(e.data, e.inicio, e.fim))}
      ${linha('Cadeira', cadeiraLink(e.cadeiraId))}
      ${linha('Assunto', esc(e.assunto))}
      ${linha('Situação', e.feito ? 'Feito' : 'A fazer')}
    </dl>`);
  } else {
    const a = m.avaliacoes.find((x) => x.id === id);
    abrirModal(a.titulo, `<dl class="detalhes">
      ${linha('Quando', quando(a.data, a.hora, a.fim))}
      ${linha('Cadeira', cadeiraLink(a.cadeiraId) || esc(nomeCadeira(m, a.cadeiraId)))}
      ${linha('Tipo', esc(a.tipo))}
      ${linha('Conteúdo', esc(a.conteudo))}
      ${linha('Observação', esc(a.obs))}
      ${linha('Local', esc(a.local))}
    </dl>`);
  }
}

export function render(el, m) {
  estado.ref ??= m.hoje;

  const desenhar = () => {
    el.innerHTML = `
      <header class="cabecalho cabecalho-linha">
        <div>
          <p class="sobretitulo">Calendário · Turma ${esc(m.config.turma)} (${esc(m.config.turmasVisiveis.join(', '))})</p>
          <h1>${esc(tituloPeriodo())}</h1>
        </div>
        <div class="cal-controles">
          <div class="grupo-btn">
            <button class="btn-icone" data-nav="-1" aria-label="Anterior">${icone('anterior')}</button>
            <button class="btn" data-nav="0">Hoje</button>
            <button class="btn-icone" data-nav="1" aria-label="Próximo">${icone('proximo')}</button>
          </div>
          <div class="alternador" role="tablist" aria-label="Visão">
            <button role="tab" aria-selected="${estado.visao === 'semana'}" data-visao="semana">Semana</button>
            <button role="tab" aria-selected="${estado.visao === 'mes'}" data-visao="mes">Mês</button>
          </div>
        </div>
      </header>
      <ul class="legenda">
        <li><span class="amostra ev-aula"></span>Aula</li>
        <li><span class="amostra ev-estudo"></span>Estudo</li>
        <li><span class="amostra ev-avaliacao"></span>${icone('alerta', 'ic-mini')}Avaliação</li>
      </ul>
      ${estado.visao === 'mes' ? visaoMes(m) : visaoSemana(m)}`;

    el.querySelectorAll('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => {
        const n = +b.dataset.nav;
        if (n === 0) estado.ref = m.hoje;
        else if (estado.visao === 'semana') estado.ref = somarDias(estado.ref, 7 * n);
        else {
          const d = deISO(estado.ref);
          estado.ref = paraISO(new Date(d.getFullYear(), d.getMonth() + n, 1, 12));
        }
        desenhar();
      })
    );
    el.querySelectorAll('[data-visao]').forEach((b) =>
      b.addEventListener('click', () => {
        estado.visao = b.dataset.visao;
        salvarVisao(estado.visao);
        desenhar();
      })
    );
    el.querySelectorAll('[data-ir-semana]').forEach((b) =>
      b.addEventListener('click', () => {
        estado.ref = b.dataset.irSemana;
        estado.visao = 'semana';
        desenhar();
      })
    );
    el.querySelectorAll('[data-tipo][data-id]').forEach((b) =>
      b.addEventListener('click', () => detalhe(m, b.dataset.tipo, b.dataset.id))
    );
  };
  desenhar();
}

