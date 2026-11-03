// Tela CADEIRAS — Período > Módulo > Cadeira > Assunto > Aula.
// Lista por módulo e página de cada cadeira com assuntos, aulas,
// avaliações e o nome de arquivo padrão do Código M.

import { esc, nomeArquivo } from '../util/texto.js';
import { formatoCurto, formatoLongo, contagemDias, DIAS_CURTOS, diaDaSemana, diasEntre } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { vazio, copiar } from '../ui/componentes.js';
import { cadeiraPorId, moduloPorId, aulasDaCadeira, avaliacoesDaCadeira } from '../dados/consultas.js';
import { novaAvaliacao } from './formularios.js';

const dataCurta = (d) => `${DIAS_CURTOS[diaDaSemana(d)]}, ${formatoCurto(d)}`;

function resumoCadeira(m, c) {
  const aulas = aulasDaCadeira(m, c.id);
  const dadas = aulas.filter((a) => a.data < m.hoje).length;
  const proxAula = aulas.find((a) => a.data >= m.hoje);
  const proxAv = avaliacoesDaCadeira(m, c.id).find((a) => a.data >= m.hoje);
  const assuntos = new Set(aulas.map((a) => a.assunto)).size;
  return { aulas, dadas, proxAula, proxAv, assuntos };
}

function lista(el, m) {
  el.innerHTML = `
    <header class="cabecalho">
      <p class="sobretitulo">${esc(m.config.periodo)} · ${esc(m.config.semestre)}</p>
      <h1>Cadeiras</h1>
    </header>
    ${m.modulos.map((mod) => {
      const cads = m.cadeiras.filter((c) => c.moduloId === mod.id);
      return `
        <section class="modulo">
          <h2 class="modulo-titulo">${esc(mod.nome)} <small>${cads.length} ${cads.length === 1 ? 'cadeira' : 'cadeiras'}</small></h2>
          <div class="grade-cadeiras">
            ${cads.map((c) => {
              const r = resumoCadeira(m, c);
              const pct = r.aulas.length ? Math.round((r.dadas / r.aulas.length) * 100) : 0;
              return `
                <a class="cartao cartao-cadeira" href="#/cadeiras/${encodeURIComponent(c.id)}">
                  <div class="cc-topo">
                    <span class="cc-icone">${icone('cadeiras')}</span>
                    <h3>${esc(c.nome)}</h3>
                    ${r.proxAv ? `<span class="selo-av ${diasEntre(m.hoje, r.proxAv.data) <= 7 ? 'perto' : ''}">${icone('alerta', 'ic-mini')} ${esc(contagemDias(m.hoje, r.proxAv.data))}</span>` : ''}
                  </div>
                  <div class="progresso" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Aulas dadas"><span style="width:${pct}%"></span></div>
                  <p class="meta">${r.dadas} de ${r.aulas.length} aulas · ${r.assuntos} assuntos</p>
                  <p class="cc-prox">${r.proxAula ? `Próxima: ${esc(dataCurta(r.proxAula.data))} · ${esc(r.proxAula.assunto)}` : 'Sem próximas aulas'}</p>
                </a>`;
            }).join('')}
          </div>
        </section>`;
    }).join('')}`;
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

  // Agrupa aulas por assunto, na ordem em que aparecem
  const assuntos = new Map();
  for (const a of r.aulas) {
    if (!assuntos.has(a.assunto)) assuntos.set(a.assunto, []);
    assuntos.get(a.assunto).push(a);
  }
  const tipos = m.config.tiposMaterial;

  el.innerHTML = `
    <nav class="trilha" aria-label="Você está em">
      <a href="#/cadeiras">${esc(m.config.periodo)}</a> ${icone('proximo', 'ic-mini')}
      <span>${esc(mod?.nome ?? '')}</span> ${icone('proximo', 'ic-mini')}
      <span aria-current="page">${esc(c.nome)}</span>
    </nav>
    <header class="cabecalho">
      <h1>${esc(c.nome)}</h1>
      <ul class="resumo-dia">
        <li>${icone('aula')} ${r.dadas} de ${r.aulas.length} aulas dadas</li>
        <li>${icone('resumo')} ${assuntos.size} assuntos</li>
        ${r.proxAv ? `<li class="forte">${icone('alerta')} ${esc(r.proxAv.titulo)} ${esc(contagemDias(m.hoje, r.proxAv.data))}</li>` : ''}
      </ul>
    </header>

    <div class="grade-cadeira">
      <section class="cartao">
        <header class="cartao-topo"><h2>${icone('resumo')}<span>Assuntos e aulas</span></h2></header>
        <div class="cartao-corpo">
          <div class="ferramenta-arquivo">
            <span>Nome de arquivo para:</span>
            <div class="tipos" role="radiogroup" aria-label="Tipo de material">
              ${tipos.map((t, i) => `
                <label class="tipo-material">
                  <input type="radio" name="tipo-material" value="${i}" ${i === 1 ? 'checked' : ''}>
                  <span>${icone(t.icone)} ${esc(t.nome)}</span>
                </label>`).join('')}
            </div>
          </div>
          <ol class="assuntos">
            ${[...assuntos.entries()].map(([assunto, aulas]) => {
              const passado = aulas[0].data < m.hoje;
              return `
                <li class="assunto ${passado ? 'dado' : ''}">
                  <div class="assunto-topo">
                    <span class="assunto-marca">${icone(passado ? 'checkCirculo' : 'circulo')}</span>
                    <strong>${esc(assunto)}</strong>
                    <button class="btn-mini" data-copiar-assunto="${esc(assunto)}" data-data="${aulas[0].data}" title="Copiar nome de arquivo">${icone('copiar', 'ic-mini')} nome do arquivo</button>
                  </div>
                  <ul class="assunto-aulas">
                    ${aulas.map((a) => `<li class="${a.data === m.hoje ? 'hoje' : ''}">
                      <span>${esc(dataCurta(a.data))} · ${esc(a.inicio)}–${esc(a.fim)}</span>
                      <span>${esc(a.tipo)}${a.turma !== 'Todas' ? ` · ${esc(a.turma)}` : ''}</span>
                      <span class="meta">${esc(a.local)}</span>
                    </li>`).join('')}
                  </ul>
                </li>`;
            }).join('') || vazio('Nenhuma aula cadastrada.')}
          </ol>
        </div>
      </section>

      <section class="cartao">
        <header class="cartao-topo"><h2>${icone('avaliacoes')}<span>Avaliações</span></h2><button class="btn-novo" data-nova-avaliacao>+ Avaliação</button></header>
        <div class="cartao-corpo">
          ${avs.length ? `<ul class="lista-avaliacoes compacta">${avs.map((a) => {
            const n = diasEntre(m.hoje, a.data);
            return `<li class="${n < 0 ? 'passada' : n <= 3 ? 'urgente' : ''}">
              <span class="contagem">${n < 0 ? `<small>feita</small>` : `<b>${n === 0 ? 'hoje' : n}</b>${n === 0 ? '' : n === 1 ? 'dia' : 'dias'}`}</span>
              <div>
                <strong>${esc(a.titulo)}</strong>
                <p class="meta">${esc(formatoLongo(a.data))}${a.hora ? ` às ${esc(a.hora)}` : ''} · ${esc(a.tipo)}</p>
                ${a.obs ? `<p class="meta">${esc(a.obs)}</p>` : ''}
                ${a.conteudo ? `<p class="meta">Conteúdo: ${esc(a.conteudo)}</p>` : ''}
              </div>
            </li>`;
          }).join('')}</ul>` : vazio('Nenhuma avaliação cadastrada.')}
        </div>
      </section>
    </div>`;

  el.querySelector('[data-nova-avaliacao]').addEventListener('click', () => novaAvaliacao(m, { cadeiraId: c.id }));

  el.querySelectorAll('[data-copiar-assunto]').forEach((b) =>
    b.addEventListener('click', () => {
      const tipo = tipos[+(el.querySelector('input[name="tipo-material"]:checked')?.value ?? 0)];
      const nome = nomeArquivo({
        periodo: m.config.periodo,
        tipo: tipo?.nome ?? 'Resumo',
        cadeira: c.nome.replace(/\s*\(.*\)\s*/, ''),
        assunto: b.dataset.copiarAssunto,
        data: b.dataset.data,
        aluna: m.config.aluna,
        ext: tipo?.icone === 'video' ? 'mp4' : 'pdf',
      });
      copiar(nome, `Copiado: ${nome}`);
    })
  );
}

export function render(el, m, [id]) {
  if (id) detalhe(el, m, id);
  else lista(el, m);
}
