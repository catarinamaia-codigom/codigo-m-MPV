// Tela MÉTODO CATARINA — revisão espaçada (FSRS) com cartões validados por
// ela (prioridade) e automáticos (Anki, IA). Estatísticas no estilo do Anki.

import { esc } from '../util/texto.js';
import { somarDias, diasEntre, formatoCurto } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { kpi, vazio, aviso, seletorCadeira, ligarFiltros, abrirModal, fecharModal, casa } from '../ui/componentes.js';
import { atualizar, adicionar, adicionarVarias, avisarMudanca, emSimulacao } from '../dados/dataSource.js';
import { nomeCadeira } from '../dados/consultas.js';
import { revisar, previa } from '../regras/fsrs.js';
import { novoCartao, opcoesCadeira } from './formularios.js';
import { mesmoAssunto } from '../regras/dominio.js';
import { mostrarImagens } from '../dados/drive.js';

const estado = { cadeira: '', assunto: '', busca: '' };
let sessao = null; // { fila: [ids], i, mostrando, feitos }

const novo = (c) => !c.revisoes;
/** Cartões já revisados que vencem até hoje. */
export const cartoesVencidos = (m, filtro = () => true) =>
  m.cartoes.filter((c) => !novo(c) && (c.vence || m.hoje) <= m.hoje && filtro(c));

function filtro(c) {
  return (!estado.cadeira || c.cadeiraId === estado.cadeira) && (!estado.assunto || mesmoAssunto(c.assunto, estado.assunto));
}

/** Fila do dia: vencidos (validados primeiro, mais atrasados antes) + novos até o limite. */
export function montarFila(m, f = filtro) {
  const prior = (a, b) => Number(b.validado) - Number(a.validado) || (a.vence || '').localeCompare(b.vence || '');
  const venc = cartoesVencidos(m, f).sort(prior);
  const revisadosHoje = new Set(m.revisoes.filter((r) => r.data === m.hoje).map((r) => r.cartaoId));
  const novosHoje = m.cartoes.filter((c) => revisadosHoje.has(c.id) && c.revisoes === 1).length;
  const novos = m.cartoes.filter((c) => novo(c) && f(c)).sort(prior).slice(0, Math.max(0, m.config.cartoesNovosPorDia - novosHoje));
  return [...venc, ...novos].map((c) => c.id);
}

function estatisticas(m) {
  const dias = 14;
  const passadas = Array.from({ length: dias }, (_, i) => somarDias(m.hoje, i - dias + 1));
  const futuras = Array.from({ length: dias }, (_, i) => somarDias(m.hoje, i));
  const revPorDia = passadas.map((d) => m.revisoes.filter((r) => r.data === d).length);
  const vencePorDia = futuras.map((d, i) => m.cartoes.filter((c) => !novo(c) && (i === 0 ? (c.vence || m.hoje) <= d : c.vence === d)).length);
  const ultimos30 = m.revisoes.filter((r) => diasEntre(r.data, m.hoje) <= 30);
  const maduras = ultimos30.filter((r) => r.intervalo > 1 || r.nota > 1);
  const retencao = ultimos30.length ? Math.round((ultimos30.filter((r) => r.nota > 1).length / ultimos30.length) * 100) : null;
  const max = (xs) => Math.max(1, ...xs);
  const colunas = (rotulos, valores, classe) => `
    <div class="grafico-barras ${classe}">
      ${valores.map((v, i) => `<div class="gb-col" title="${esc(rotulos[i])}: ${v}"><span class="gb-valor">${v || ''}</span><span class="gb-barra ${v ? '' : 'zero'}" style="height:${Math.round((v / max(valores)) * 100)}%"></span><span class="gb-rotulo">${esc(rotulos[i])}</span></div>`).join('')}
    </div>`;
  const rot = (ds) => ds.map((d) => formatoCurto(d).slice(0, 2));
  return { retencao, maduras: maduras.length, html: `
    <div class="grade-2">
      <section class="cartao"><header class="cartao-topo"><h2>${icone('relogio')}<span>Revisões nos últimos 14 dias</span></h2></header>
        <div class="cartao-corpo">${colunas(rot(passadas), revPorDia, 'passado')}</div></section>
      <section class="cartao"><header class="cartao-topo"><h2>${icone('calendario')}<span>Previsão: próximos 14 dias</span></h2></header>
        <div class="cartao-corpo">${colunas(rot(futuras), vencePorDia, 'futuro')}</div></section>
    </div>` };
}

function telaRevisao(el, m) {
  const id = sessao.fila[sessao.i];
  const c = m.cartoes.find((x) => x.id === id);
  if (!c) {
    const feitos = sessao.feitos;
    sessao = null;
    el.innerHTML = `<div class="revisao-fim">
      <span class="revisao-fim-icone">${icone('checkCirculo')}</span>
      <h1>Revisão concluída</h1>
      <p>${feitos} cartão(ões) revisado(s). ${emSimulacao() ? 'No modo simulação nada foi salvo.' : 'Tudo gravado na planilha.'}</p>
      <a class="btn btn-principal" href="#/metodo">Voltar ao Método Catarina</a>
    </div>`;
    avisarMudanca();
    return;
  }
  const dias = c.ultima ? diasEntre(c.ultima, m.hoje) : 0;
  const botoes = previa(c, dias, m.config.retencaoDesejada);
  const restantes = sessao.fila.length - sessao.i;
  el.innerHTML = `
    <div class="revisao">
      <div class="revisao-topo">
        <span>${restantes} restante(s)</span>
        <span class="tag">${esc(nomeCadeira(m, c.cadeiraId))}${c.assunto ? ` · ${esc(c.assunto)}` : ''}</span>
        ${c.validado ? '<span class="tag tag-ok">validado</span>' : `<span class="tag">${esc(c.origem)}</span>`}
        <button class="btn-mini" data-sair>${icone('fechar', 'ic-mini')} Encerrar</button>
      </div>
      <div class="revisao-cartao">
        <p class="revisao-frente">${esc(c.frente)}</p>
        ${c.imagemFrente ? `<img class="revisao-imagem" data-imagem-drive="${esc(c.imagemFrente)}" alt="Imagem da frente">` : ''}
        ${sessao.mostrando ? `<hr><p class="revisao-verso">${esc(c.verso)}</p>${c.imagemVerso ? `<img class="revisao-imagem" data-imagem-drive="${esc(c.imagemVerso)}" alt="Imagem do verso">` : ''}${c.fonte ? `<p class="meta">Fonte: ${esc(c.fonte)}</p>` : ''}` : ''}
      </div>
      <div class="revisao-acoes">
        ${sessao.mostrando
          ? botoes.map((b) => `<button class="btn-nota nota-${b.nota}" data-nota="${b.nota}"><b>${esc(b.nome)}</b><small>${b.dias === 1 ? 'amanhã' : `${b.dias} dias`}</small><kbd>${b.tecla}</kbd></button>`).join('')
          : `<button class="btn btn-principal btn-largo" data-mostrar>Mostrar resposta <kbd>espaço</kbd></button>`}
      </div>
      <p class="nota">Tente responder em voz alta antes de virar. Atalhos: espaço vira; 1 Errei · 2 Difícil · 3 Bom · 4 Fácil.</p>
    </div>`;

  mostrarImagens(el);
  const responder = (nota) => {
    const r = revisar(c, nota, dias, m.config.retencaoDesejada);
    const vence = somarDias(m.hoje, r.intervalo);
    const campos = { estabilidade: r.estabilidade, dificuldade: r.dificuldade, revisoes: r.revisoes, lapsos: r.lapsos, ultima: m.hoje, vence };
    Object.assign(c, campos); // atualiza a tela na hora; a planilha grava em segundo plano
    m.revisoes.push({ data: m.hoje, cartaoId: c.id, nota, intervalo: r.intervalo });
    Promise.all([
      atualizar('Cartoes', c.id, campos, { silencioso: true }),
      adicionar('Revisoes', { data: m.hoje, cartao_id: c.id, nota, intervalo: r.intervalo }, { silencioso: true }),
    ]).catch((e) => aviso(`Não gravou a revisão: ${e.message}`));
    if (nota === 1) sessao.fila.push(c.id); // errou: volta no fim da fila de hoje
    sessao.i += 1;
    sessao.feitos += 1;
    sessao.mostrando = false;
    telaRevisao(el, m);
  };
  el.querySelector('[data-mostrar]')?.addEventListener('click', () => {
    sessao.mostrando = true;
    telaRevisao(el, m);
  });
  el.querySelectorAll('[data-nota]').forEach((b) => b.addEventListener('click', () => responder(+b.dataset.nota)));
  el.querySelector('[data-sair]').addEventListener('click', () => {
    sessao = null;
    avisarMudanca();
  });
  teclas = (e) => {
    if (!sessao || e.target.closest('input, textarea, select')) return;
    if (e.key === ' ' && !sessao.mostrando) {
      e.preventDefault();
      sessao.mostrando = true;
      telaRevisao(el, m);
    } else if (sessao.mostrando && ['1', '2', '3', '4'].includes(e.key)) responder(+e.key);
  };
}
let teclas = () => {};
document.addEventListener('keydown', (e) => teclas(e));

function importarAnki(m) {
  abrirModal('Importar cartões do Anki', `
    <div class="formulario">
      <p class="formulario-intro">No Anki: <b>Arquivo → Exportar → “Notas em texto puro (.txt)”</b>. Cada linha vira um cartão (frente ⇥ verso). Também aceita CSV com ponto e vírgula. Os cartões entram como <b>automáticos</b> — os que você escreve no Código M continuam com prioridade.</p>
      <div class="formulario-campos">
        <div class="campo largo"><label for="anki-arq">Arquivo</label><input id="anki-arq" type="file" accept=".txt,.tsv,.csv,text/plain"></div>
        <div class="campo"><label for="anki-cad">Cadeira</label><select id="anki-cad">${opcoesCadeira(m).map((o) => `<option value="${esc(o.valor)}">${esc(o.texto)}</option>`).join('')}</select></div>
        <div class="campo"><label for="anki-ass">Assunto <small>(opcional)</small></label><input id="anki-ass"></div>
      </div>
      <p class="formulario-erro" hidden></p>
      <div class="previa-import" id="anki-previa"></div>
      <div class="formulario-acoes"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-principal" id="anki-ok" disabled>Importar</button></div>
    </div>`);
  let linhas = [];
  const limpar = (t) => t.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  document.getElementById('anki-arq').addEventListener('change', async (e) => {
    const texto = await e.target.files[0]?.text();
    if (!texto) return;
    linhas = texto
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => (l.includes('\t') ? l.split('\t') : l.split(';')))
      .filter((p) => p.length >= 2 && limpar(p[0]))
      .map((p) => ({ frente: limpar(p[0]), verso: limpar(p[1]) }));
    document.getElementById('anki-previa').innerHTML = linhas.length
      ? `<p><b>${linhas.length}</b> cartão(ões) encontrados. Primeiro: “${esc(linhas[0].frente.slice(0, 120))}”</p>`
      : '<p>Não encontrei cartões neste arquivo.</p>';
    document.getElementById('anki-ok').disabled = !linhas.length;
  });
  document.getElementById('anki-ok').addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Importando…';
    const cad = document.getElementById('anki-cad').value;
    const ass = document.getElementById('anki-ass').value.trim();
    const base = Date.now();
    try {
      await adicionarVarias('Cartoes', linhas.map((l, i) => ({
        id: `C-${(base + i).toString(36)}`, criado: m.hoje, cadeira_id: cad, assunto: ass, frente: l.frente, verso: l.verso,
        fonte: 'Anki', origem: 'Anki', vence: m.hoje, revisoes: 0, lapsos: 0,
      })));
      fecharModal();
      aviso(`${linhas.length} cartões importados${emSimulacao() ? ' (simulação)' : ''}.`);
    } catch (falha) {
      e.target.disabled = false;
      e.target.textContent = 'Importar';
      aviso(falha.message);
    }
  });
}

export function render(el, m, params) {
  teclas = () => {};
  if (sessao) return telaRevisao(el, m);
  const redesenhar = () => render(el, m, params);
  const fila = montarFila(m);
  const venc = cartoesVencidos(m, filtro).length;
  const novos = fila.length - venc;
  const hoje = m.revisoes.filter((r) => r.data === m.hoje).length;
  const est = estatisticas(m);
  const lista = m.cartoes.filter(filtro).filter((c) => casa(`${c.frente} ${c.verso} ${c.assunto}`, estado.busca));
  const assuntos = [...new Set(m.cartoes.filter((c) => !estado.cadeira || c.cadeiraId === estado.cadeira).map((c) => c.assunto).filter(Boolean))];

  el.innerHTML = `
    <header class="cabecalho cabecalho-linha">
      <div><p class="sobretitulo">Revisão espaçada · FSRS</p><h1>Método Catarina</h1></div>
      <div class="acoes-topo">
        <button class="btn" data-anki>${icone('arquivo', 'ic-mini')} Importar do Anki</button>
        <button class="btn" data-novo>${icone('flashcard', 'ic-mini')} + Cartão</button>
        <button class="btn btn-principal" data-comecar ${fila.length ? '' : 'disabled'}>${icone('metodo', 'ic-mini')} Revisar agora (${fila.length})</button>
      </div>
    </header>
    <div class="filtros">
      ${seletorCadeira(m, estado.cadeira)}
      <select class="filtro-select" data-filtro-select="assunto" aria-label="Assunto"><option value="">Todos os assuntos</option>${assuntos.map((a) => `<option ${a === estado.assunto ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
    </div>
    <div class="kpis">
      ${kpi({ rotulo: 'Para revisar hoje', valor: venc, tom: venc ? 'alerta' : '', iconeNome: 'relogio' })}
      ${kpi({ rotulo: 'Novos na fila', valor: novos, sub: `limite ${m.config.cartoesNovosPorDia}/dia` })}
      ${kpi({ rotulo: 'Revisados hoje', valor: hoje, tom: hoje ? 'ok' : '' })}
      ${kpi({ rotulo: 'Retenção (30 dias)', valor: est.retencao === null ? '—' : `${est.retencao}%`, sub: `meta ${Math.round(m.config.retencaoDesejada * 100)}%` })}
      ${kpi({ rotulo: 'Cartões', valor: m.cartoes.filter(filtro).length, sub: `${m.cartoes.filter((c) => filtro(c) && c.validado).length} validados` })}
    </div>
    ${m.cartoes.length ? est.html : ''}
    <section class="cartao">
      <header class="cartao-topo"><h2>${icone('flashcard')}<span>Cartões</span></h2>
        <input class="filtro-texto" type="search" placeholder="Buscar nos cartões" data-filtro-texto="busca" value="${esc(estado.busca)}"></header>
      <div class="cartao-corpo">
        ${lista.length ? `<table class="tabela">
          <thead><tr><th>Frente</th><th>Cadeira · assunto</th><th>Origem</th><th>Próxima</th><th>Revisões</th></tr></thead>
          <tbody>${lista.slice(0, 200).map((c) => `<tr>
            <td class="t-forte">${esc(c.frente.slice(0, 140))}</td>
            <td>${esc(nomeCadeira(m, c.cadeiraId))}${c.assunto ? ` · ${esc(c.assunto)}` : ''}</td>
            <td>${c.validado ? '<span class="tag tag-ok">validado</span>' : `<span class="tag">${esc(c.origem)}</span>`}</td>
            <td>${novo(c) ? '<span class="tag">novo</span>' : c.vence <= m.hoje ? '<span class="tag tag-alerta">hoje</span>' : esc(formatoCurto(c.vence))}</td>
            <td>${c.revisoes}${c.lapsos ? ` <small class="meta">(${c.lapsos} erro${c.lapsos > 1 ? 's' : ''})</small>` : ''}</td>
          </tr>`).join('')}</tbody></table>${lista.length > 200 ? `<p class="nota">Mostrando 200 de ${lista.length}. Use a busca.</p>` : ''}`
          : vazio('Nenhum cartão ainda. Crie um com “+ Cartão”, transforme uma dúvida sanada em cartão ou importe do Anki.')}
      </div>
    </section>`;

  ligarFiltros(el, estado, redesenhar);
  el.querySelector('[data-novo]').addEventListener('click', () => novoCartao(m, { cadeiraId: estado.cadeira, assunto: estado.assunto }));
  el.querySelector('[data-anki]').addEventListener('click', () => importarAnki(m));
  el.querySelector('[data-comecar]').addEventListener('click', () => {
    sessao = { fila, i: 0, mostrando: false, feitos: 0 };
    telaRevisao(el, m);
  });
}

/** Começa a revisão já filtrada (ex.: botão "Revisar este assunto"). */
export function revisarAssunto(cadeiraId, assunto) {
  estado.cadeira = cadeiraId;
  estado.assunto = assunto;
  location.hash = '#/metodo';
}


