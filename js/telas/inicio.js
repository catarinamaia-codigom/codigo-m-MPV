// Tela INÍCIO: aulas de hoje, estudo marcado, próximas avaliações,
// sugestão de estudo (com motivo), pendências e atalhos de IA.

import { esc } from '../util/texto.js';
import { formatoLongo, formatoCurto, contagemDias, DIAS_CURTOS, diaDaSemana } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { cartao, vazio, aviso, copiar } from '../ui/componentes.js';
import { emSimulacao } from '../dados/dataSource.js';
import {
  aulasDoDia, estudosDoDia, feriadoDoDia, proximasAvaliacoes, pendenciasAbertas, nomeCadeira,
} from '../dados/consultas.js';
import { gerarSugestoes } from '../regras/sugestoes.js';

const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

const linkCadeira = (m, id) =>
  id ? `<a class="tag" href="#/cadeiras/${encodeURIComponent(id)}">${esc(nomeCadeira(m, id))}</a>` : '';

function blocoAulas(m) {
  const feriado = feriadoDoDia(m, m.hoje);
  const aulas = aulasDoDia(m, m.hoje);
  if (feriado) return `<p class="destaque-feriado">${icone('feriado')} Feriado: ${esc(feriado.nome)}. Sem aulas hoje.</p>`;
  if (!aulas.length) return vazio('Sem aulas hoje.');
  return `<ul class="lista-aulas">${aulas.map((a) => `
    <li>
      <span class="hora">${esc(a.inicio)}<small>${esc(a.fim)}</small></span>
      <div>
        <strong>${esc(a.assunto)}</strong>
        <p class="meta">${linkCadeira(m, a.cadeiraId)} ${esc(a.tipo)}${a.turma !== 'Todas' ? ` · ${esc(a.turma)}` : ''}${a.local ? ` · ${esc(a.local)}` : ''}</p>
      </div>
    </li>`).join('')}</ul>`;
}

function blocoEstudos(m) {
  const estudos = estudosDoDia(m, m.hoje);
  if (!estudos.length) return vazio('Nada marcado para hoje. Que tal escolher uma das sugestões?');
  return `<ul class="lista-check">${estudos.map((e) => `
    <li>
      <label class="${e.feito ? 'feito' : ''}">
        <input type="checkbox" data-estudo="${esc(e.id)}" ${e.feito ? 'checked' : ''}>
        <span class="caixa">${icone('check')}</span>
        <span>
          <strong>${esc(e.atividade)}</strong>
          <span class="meta">${e.inicio ? `${esc(e.inicio)}–${esc(e.fim)} · ` : ''}${esc(nomeCadeira(m, e.cadeiraId))}${e.assunto ? ` · ${esc(e.assunto)}` : ''}</span>
        </span>
      </label>
    </li>`).join('')}</ul>`;
}

function blocoSugestoes(m, sugestoes) {
  if (!sugestoes.length) return vazio('Tudo em dia por aqui. Nenhuma sugestão pelas regras atuais.');
  return `<ol class="lista-sugestoes">${sugestoes.map((s) => `
    <li class="sug-${esc(s.regra)}">
      <div class="sug-topo"><strong>${esc(s.titulo)}</strong>${linkCadeira(m, s.cadeiraId)}</div>
      <p class="motivo"><span>Por quê:</span> ${esc(s.motivo)}</p>
    </li>`).join('')}</ol>`;
}

function blocoAvaliacoes(m) {
  const avs = proximasAvaliacoes(m, 5);
  if (!avs.length) return vazio('Nenhuma avaliação marcada.');
  return `<ul class="lista-avaliacoes">${avs.map((a) => `
    <li class="${a.faltam <= 3 ? 'urgente' : ''}">
      <span class="contagem"><b>${a.faltam === 0 ? 'hoje' : a.faltam}</b>${a.faltam === 0 ? '' : a.faltam === 1 ? 'dia' : 'dias'}</span>
      <div>
        <strong>${esc(a.titulo)}</strong>
        <p class="meta">${DIAS_CURTOS[diaDaSemana(a.data)]}, ${formatoCurto(a.data)}${a.hora ? ` às ${esc(a.hora)}` : ''} · ${esc(a.tipo)}</p>
        ${a.conteudo ? `<p class="meta">${esc(a.conteudo)}</p>` : ''}
      </div>
    </li>`).join('')}</ul>`;
}

function blocoPendencias(m) {
  const ps = pendenciasAbertas(m);
  if (!ps.length) return vazio('Nenhuma pendência aberta.');
  const prazo = (p) => {
    if (p.faltam === null) return '';
    if (p.faltam < 0) return `<span class="prazo atrasada">atrasada ${-p.faltam} ${p.faltam === -1 ? 'dia' : 'dias'}</span>`;
    return `<span class="prazo ${p.faltam <= 1 ? 'proxima' : ''}">${contagemDias(m.hoje, p.prazo)}</span>`;
  };
  return `<ul class="lista-pendencias">${ps.map((p) => `
    <li>
      <span class="prioridade p-${esc(p.prioridade.toLowerCase())}" title="Prioridade ${esc(p.prioridade)}"></span>
      <div>
        <strong>${esc(p.descricao)}</strong>
        <p class="meta">${p.cadeiraId ? `${esc(nomeCadeira(m, p.cadeiraId))} · ` : ''}${p.prazo ? `prazo ${formatoCurto(p.prazo)}` : 'sem prazo'}</p>
      </div>
      ${prazo(p)}
    </li>`).join('')}</ul>`;
}

/** Contextos disponíveis para os atalhos: sugestões + aulas de hoje. */
function contextosIA(m, sugestoes) {
  const itens = [
    ...sugestoes.map((s) => ({ cadeira: nomeCadeira(m, s.cadeiraId), assunto: s.assunto })),
    ...aulasDoDia(m, m.hoje).map((a) => ({ cadeira: nomeCadeira(m, a.cadeiraId), assunto: a.assunto })),
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
    <label class="campo">
      <span>Sobre</span>
      <select id="ia-contexto">
        ${contextos.map((c, i) => `<option value="${i}">${esc(c.assunto)} — ${esc(c.cadeira)}</option>`).join('')}
        <option value="livre">Outro assunto (digitar)…</option>
      </select>
    </label>
    <div class="atalhos">
      ${m.config.atalhosIA.map((a, i) => `
        <button class="btn-atalho" data-atalho="${i}">${icone('ia')}<span>${esc(a.nome)}</span>${icone('externo', 'ic-mini')}</button>`).join('')}
    </div>
    <p class="nota">O prompt é copiado e o chat abre numa nova aba — é só colar. Usa sua conta do chat; o Código M não paga nem chama nenhuma IA.</p>`;
}

export function render(el, m) {
  const sugestoes = gerarSugestoes(m);
  const contextos = contextosIA(m, sugestoes);
  const aulasHoje = aulasDoDia(m, m.hoje).length;
  const prox = proximasAvaliacoes(m, 1)[0];
  const pend = pendenciasAbertas(m);
  const atrasadas = pend.filter((p) => p.faltam !== null && p.faltam < 0).length;

  el.innerHTML = `
    <header class="cabecalho">
      <p class="sobretitulo">${esc(maiuscula(formatoLongo(m.hoje)))}</p>
      <h1>${saudacao()}${m.config.aluna ? `, ${esc(m.config.aluna)}` : ''}</h1>
      <ul class="resumo-dia">
        <li>${icone('aula')} ${aulasHoje} ${aulasHoje === 1 ? 'aula' : 'aulas'} hoje</li>
        <li>${icone('estudo')} ${estudosDoDia(m, m.hoje).length} estudo(s) marcado(s)</li>
        ${prox ? `<li class="forte">${icone('alerta')} Próxima avaliação ${contagemDias(m.hoje, prox.data)}</li>` : ''}
        ${atrasadas ? `<li class="forte">${icone('pendencias')} ${atrasadas} pendência(s) atrasada(s)</li>` : ''}
      </ul>
    </header>

    <div class="grade-inicio">
      ${cartao({ titulo: 'Aulas de hoje', iconeNome: 'aula', corpo: blocoAulas(m), classe: 'c-aulas',
        extra: `<a class="link-discreto" href="#/calendario">Calendário ${icone('seta', 'ic-mini')}</a>` })}
      ${cartao({ titulo: 'Marcado para hoje', iconeNome: 'estudo', corpo: blocoEstudos(m), classe: 'c-estudos' })}
      ${cartao({ titulo: 'Próximas avaliações', iconeNome: 'avaliacoes', corpo: blocoAvaliacoes(m), classe: 'c-avaliacoes' })}
      ${cartao({ titulo: 'Sugestão de estudo', iconeNome: 'lampada', corpo: blocoSugestoes(m, sugestoes), classe: 'c-sugestoes' })}
      ${cartao({ titulo: 'Pendências', iconeNome: 'pendencias', corpo: blocoPendencias(m), classe: 'c-pendencias' })}
      ${cartao({ titulo: 'Atalhos de IA', iconeNome: 'ia', corpo: blocoAtalhos(m, contextos), classe: 'c-atalhos' })}
    </div>`;

  // Marcar estudo como feito (no modo simulação, só na tela)
  el.querySelectorAll('[data-estudo]').forEach((cb) =>
    cb.addEventListener('change', () => {
      const estudo = m.estudos.find((e) => e.id === cb.dataset.estudo);
      estudo.feito = cb.checked;
      cb.closest('label').classList.toggle('feito', cb.checked);
      if (emSimulacao()) aviso('Modo simulação: marcado só nesta tela, não foi salvo.');
    })
  );

  // Atalhos de IA: preenche o prompt, copia e abre o chat
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
      const ok = await copiar(texto, 'Prompt copiado — cole no chat que abriu.');
      if (ok) window.open(m.config.iaUrl, '_blank', 'noopener');
    })
  );
}
