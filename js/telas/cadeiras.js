// Tela CADEIRAS — Período > Módulo > Cadeira > Assunto.
// Períodos e módulos abrem e fecham; a página da cadeira tem assuntos,
// material geral (filtrável por tipo) e faltas; a página do ASSUNTO reúne
// aulas (com "teve aula" e "fui"), materiais, dúvidas, questões, cartões e estudos.

import { esc, nomeArquivo, linkificar } from '../util/texto.js';
import { formatoCurto, contagemDias, DIAS_CURTOS, diaDaSemana, diasEntre } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { vazio, copiar, seloDominio, barra, kpi, aviso, cartaoRecolhivel, botaoMais, lembrarAberto, estaAberto, botoesNoTitulo, chips } from '../ui/componentes.js';
import { cadeiraPorId, moduloPorId, aulasDaCadeira, avaliacoesDaCadeira, nomeCadeira, periodoCadeira, faltasDaCadeira, ehZona } from '../dados/consultas.js';
import { atualizar } from '../dados/dataSource.js';
import { novaAvaliacao, novaDuvida, novaQuestao, novoMaterial, novoCartao, novoEstudo, editarEstudo, marcarEstudo } from './formularios.js';
import { assuntosDaCadeira, dominioAssunto, dominioCadeira, mesmoAssunto, estatisticaQuestoes, NIVEIS, ligadoAoAssunto, atalhoDoAssunto, assuntosSecundarios, registroAssunto } from '../regras/dominio.js';
import { cartaoDuvida, ligarDuvidas, chipsMotivo } from './duvidas.js';
import { linhaMaterial, ligarMateriais, materiaisDeAvaliacoes } from './materiais.js';
import { abrirAvaliacao } from './avaliacao.js';
import { novoAssunto, renomearAssunto, editarAssuntoDaAula, novaCadeira, novaZona } from './estrutura.js';
import { revisarAssunto, cartoesVencidos } from './metodo.js';
import { calcularMedia } from '../regras/notas.js';
import { mostrarImagens } from '../dados/drive.js';

const dataCurta = (d) => `${DIAS_CURTOS[diaDaSemana(d)]} ${formatoCurto(d)}`;
const pct = (x) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const filtroTipo = {}; // por cadeira/assunto: tipo de material escolhido
const filtroMotivo = {}; // por assunto: tipo de dúvida escolhido
/** Tela de celular: seções secundárias começam recolhidas. */
const celular = () => matchMedia('(max-width: 860px)').matches;

function resumoCadeira(m, c) {
  const aulas = aulasDaCadeira(m, c.id);
  const dadas = aulas.filter((a) => a.data < m.hoje).length;
  const proxAula = aulas.find((a) => a.data >= m.hoje);
  const proxAv = avaliacoesDaCadeira(m, c.id).find((a) => a.data >= m.hoje);
  return { aulas, dadas, proxAula, proxAv };
}

function cartaoCadeira(m, c) {
  const r = resumoCadeira(m, c);
  const dom = dominioCadeira(m, c.id);
  const abertas = m.duvidas.filter((d) => d.cadeiraId === c.id && !d.sanada).length;
  const faltas = faltasDaCadeira(m, c.id);
  return `
    <a class="cartao cartao-cadeira" href="#/cadeiras/${encodeURIComponent(c.id)}">
      <div class="cc-topo">
        <h3>${esc(c.nome)}${ehZona(m, c.id) ? '' : ` <span class="cc-periodo">${esc(periodoCadeira(m, c.id))}</span>`}</h3>
        ${r.proxAv ? `<span class="selo-av ${diasEntre(m.hoje, r.proxAv.data) <= 7 ? 'perto' : ''}">${icone('alerta', 'ic-mini')} ${esc(contagemDias(m.hoje, r.proxAv.data))}</span>` : ''}
      </div>
      <div class="cc-linha">${barra(r.aulas.length ? r.dadas / r.aulas.length : 0)}<span class="meta">${r.dadas}/${r.aulas.length} aulas</span></div>
      <div class="cc-linha"><span class="dominio d${dom.nivel}">${'●'.repeat(dom.nivel)}${'○'.repeat(5 - dom.nivel)}</span>
        ${abertas ? `<span class="tag tag-alerta">${abertas} dúvida${abertas > 1 ? 's' : ''}</span>` : ''}
        ${faltas ? `<span class="tag">${faltas} falta${faltas > 1 ? 's' : ''}</span>` : ''}</div>
      <p class="cc-prox">${r.proxAula ? `${esc(dataCurta(r.proxAula.data))} · ${esc(r.proxAula.assunto)}` : 'Sem próximas aulas'}</p>
    </a>`;
}

function lista(el, m) {
  const zona = (mod) => Boolean(mod.tipo);
  const periodos = [...new Set(m.modulos.filter((x) => !zona(x)).map((x) => x.periodo || m.config.periodo))];
  const zonas = m.modulos.filter(zona);
  const blocoModulo = (mod) => {
    const cads = m.cadeiras.filter((c) => c.moduloId === mod.id);
    return `
      <details class="modulo" data-lembrar="modulo-${esc(mod.id)}" ${estaAberto(`modulo-${mod.id}`, true) ? 'open' : ''}>
        <summary class="modulo-titulo">${esc(mod.nome)} <small>${cads.length} ${zona(mod) ? (cads.length === 1 ? 'linha' : 'linhas') : cads.length === 1 ? 'cadeira' : 'cadeiras'}</small>
          <button class="btn-mais" data-nova-cadeira="${esc(mod.id)}" title="${zona(mod) ? 'Nova linha nesta zona' : 'Nova cadeira neste módulo'}" aria-label="Nova cadeira em ${esc(mod.nome)}">+</button>${icone('proximo', 'ic-mini seta-recolher')}</summary>
        <div class="grade-cadeiras">${cads.map((c) => cartaoCadeira(m, c)).join('') || vazio('Nenhuma ainda.')}</div>
      </details>`;
  };
  el.innerHTML = `
    <header class="cabecalho cabecalho-linha"><div><p class="sobretitulo">Período atual: ${esc(m.config.periodo)} · ${esc(m.config.semestre)}</p><h1>Cadeiras</h1></div>
      <div class="acoes-topo"><button class="btn" data-nova-cadeira="">${icone('cadeiras', 'ic-mini')} + Cadeira</button>
        <button class="btn" data-nova-zona>${icone('metodo', 'ic-mini')} + Zona de interesse</button></div></header>
    ${periodos.map((p) => `
      <details class="periodo" data-lembrar="periodo-${esc(p)}" ${estaAberto(`periodo-${p}`, p === m.config.periodo) ? 'open' : ''}>
        <summary class="periodo-titulo"><span class="periodo-sigla">${esc(p)}</span><span>${p === m.config.periodo ? `${esc(m.config.semestre)} · período atual` : 'período'}</span>${icone('proximo', 'ic-mini seta-recolher')}</summary>
        ${m.modulos.filter((mod) => !zona(mod) && (mod.periodo || m.config.periodo) === p).map(blocoModulo).join('')}
      </details>`).join('')}
    <details class="periodo periodo-zonas" data-lembrar="periodo-zonas" ${estaAberto('periodo-zonas', true) ? 'open' : ''}>
      <summary class="periodo-titulo"><span class="periodo-sigla">${icone('metodo', 'ic-mini')}</span><span>Zonas de interesse · linhas de estudo e pesquisa próprias</span>${icone('proximo', 'ic-mini seta-recolher')}</summary>
      ${zonas.map(blocoModulo).join('') || `<p class="vazio">Crie uma zona para estudos fora do cronograma da faculdade (ex.: Cardiologia, Pesquisa, Residência). <button class="link-botao" data-nova-zona>+ Zona de interesse</button></p>`}
    </details>`;
  lembrarAberto(el);
  botoesNoTitulo(el);
  el.querySelectorAll('[data-nova-cadeira]').forEach((b) => b.addEventListener('click', () => novaCadeira(m, { moduloId: b.dataset.novaCadeira })));
  el.querySelectorAll('[data-nova-zona]').forEach((b) => b.addEventListener('click', () => novaZona(m)));
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

/** Lista de materiais com filtro por tipo (Todos, Slide, Infográfico…). */
function blocoMateriais(m, materiais, chave, { mostrarAssunto = false, atalho = () => false } = {}) {
  const tipos = [...new Set(materiais.map((x) => x.tipo))];
  const atual = tipos.includes(filtroTipo[chave]) ? filtroTipo[chave] : '';
  const visiveis = materiais.filter((x) => !atual || x.tipo === atual);
  return `
    ${tipos.length > 1 ? `<div class="filtro-tipos" data-chave-tipo="${esc(chave)}">${chips('tipo', [['', 'Todos'], ...tipos.map((t) => [t, t])], atual)}</div>` : ''}
    ${visiveis.length ? `<ul class="lista-materiais">${visiveis.map((x) => linhaMaterial(m, x, { mostrarCadeira: false, mostrarAssunto, atalho: atalho(x) })).join('')}</ul>` : vazio('Nenhum material ainda.')}`;
}

function ligarFiltroTipo(el, redesenhar) {
  el.querySelectorAll('[data-chave-tipo] [data-filtro="tipo"]').forEach((b) =>
    b.addEventListener('click', () => {
      filtroTipo[b.closest('[data-chave-tipo]').dataset.chaveTipo] = b.dataset.valor;
      redesenhar();
    })
  );
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
  const faltas = faltasDaCadeira(m, c.id);
  const materiais = [...m.materiais.filter((x) => x.cadeiraId === c.id), ...materiaisDeAvaliacoes(m, { cadeiraId: c.id })];
  const secundarios = assuntosSecundarios(m, c.id);
  const atividades = m.estudos.filter((e) => e.cadeiraId === c.id && (e.tipo !== 'Estudo' || e.avaliacaoId));

  el.innerHTML = `
    <header class="cabecalho cabecalho-linha">
      <div><p class="sobretitulo">${esc(mod?.nome ?? '')}${ehZona(m, c.id) ? ' · zona de interesse' : ` · ${esc(periodoCadeira(m, c.id))}`}</p><h1>${esc(nomeCadeira(m, c.id))}</h1></div>
      <div class="acoes-topo">
        <button class="btn" data-mais="duvida">${icone('duvidas', 'ic-mini')} Dúvida</button>
        <button class="btn" data-mais="questao">${icone('questoes', 'ic-mini')} Questão</button>
        <button class="btn" data-mais="material">${icone('materiais', 'ic-mini')} Material</button>
      </div>
    </header>
    <div class="kpis">
      ${kpi({ rotulo: 'Aulas dadas', valor: `${r.dadas}/${r.aulas.length}` })}
      ${kpi({ rotulo: 'Faltas', valor: faltas, sub: 'aulas que tiveram e você não foi', tom: faltas ? 'alerta' : '' })}
      ${kpi({ rotulo: 'Domínio médio', valor: dom.vistos ? `${String(dom.media).replace('.', ',')}/5` : '—', sub: dom.vistos ? NIVEIS[dom.nivel].nome : 'nenhum assunto visto' })}
      ${kpi({ rotulo: 'Dúvidas abertas', valor: abertas.length, tom: abertas.length ? 'alerta' : '', href: '#/duvidas' })}
      ${kpi({ rotulo: 'Nota', valor: notas.vazio ? '—' : String(notas.media ?? notas.garantida).replace('.', ','), sub: notas.vazio ? 'sem notas' : notas.media !== null ? 'média final' : 'garantido até agora', href: '#/avaliacoes' })}
    </div>
    <div class="grade-cadeira">
      <div class="coluna">
        ${cartaoRecolhivel({ titulo: 'Assuntos', iconeNome: 'resumo', chave: `assuntos-${c.id}`, contagem: assuntos.length, extra: botaoMais('assunto', 'Novo assunto'), corpo: `
          <ol class="assuntos">${assuntos.map((a) => {
            const aulas = r.aulas.filter((x) => mesmoAssunto(x.assunto, a));
            const d = dominioAssunto(m, c.id, a);
            const datas = aulas.map((x) => x.data);
            const proxima = datas.find((x) => x >= m.hoje);
            const ultima = [...datas].reverse().find((x) => x < m.hoje);
            return `<li class="assunto ${d.nivel === 0 ? 'futuro' : ''}">
              <a href="#/cadeiras/${encodeURIComponent(c.id)}/${encodeURIComponent(a)}">
                <span class="assunto-nome">${esc(a)}</span>
                <span class="assunto-datas meta">${proxima ? (proxima === m.hoje ? 'hoje' : dataCurta(proxima)) : ultima ? dataCurta(ultima) : 'sem aula'}${aulas.length > 1 ? ` · ${aulas.length} aulas` : ''}</span>
                ${contadores(m, c.id, a)}
                ${seloDominio(d)}
              </a></li>`;
          }).join('') || vazio('Nenhum assunto ainda. Use + para criar.')}</ol>
          ${secundarios.length ? `<p class="rotulo-lado assuntos-atalho-titulo">De outras cadeiras (atalhos)</p><ol class="assuntos">${secundarios.map((s) => `
            <li class="assunto"><a href="#/cadeiras/${encodeURIComponent(s.cadeiraId)}/${encodeURIComponent(s.assunto)}">
              <span class="assunto-nome">${icone('link', 'ic-mini')} ${esc(s.assunto)}</span><span class="assunto-datas meta">${esc(nomeCadeira(m, s.cadeiraId))}</span>
              ${contadores(m, s.cadeiraId, s.assunto)}</a></li>`).join('')}</ol>` : ''}` })}
        ${cartaoRecolhivel({ titulo: 'Material geral da cadeira', iconeNome: 'materiais', chave: `material-${c.id}`, contagem: materiais.length,
          extra: botaoMais('material', 'Adicionar material'), corpo: blocoMateriais(m, materiais, `cad-${c.id}`, { mostrarAssunto: true }) })}
      </div>
      <div class="coluna">
        ${cartaoRecolhivel({ titulo: 'Avaliações', iconeNome: 'avaliacoes', chave: `avaliacoes-${c.id}`, contagem: avs.length, extra: botaoMais('avaliacao', 'Nova avaliação'),
          corpo: avs.length ? `<ul class="linha-avaliacoes clicavel">${avs.map((a) => linhaAvaliacao(m, a)).join('')}</ul>` : vazio('Nenhuma avaliação cadastrada.') })}
        ${cartaoRecolhivel({ titulo: 'Atividades e trabalhos', iconeNome: 'trabalho', chave: `atividades-${c.id}`, contagem: atividades.length, extra: botaoMais('atividade', 'Nova atividade'),
          corpo: atividades.length ? `<ul class="lista-estudos">${atividades.map((e) => linhaEstudo(m, e, { mostrarCadeira: false })).join('')}</ul>` : vazio('Escrevendo trabalho, atividade extra, estratégica, foco residência…') })}
        ${cartaoRecolhivel({ titulo: 'Dúvidas abertas', iconeNome: 'duvidas', chave: `duvidas-${c.id}`, contagem: abertas.length, extra: botaoMais('duvida', 'Nova dúvida'),
          corpo: `<div class="lista-duvidas compacta">${abertas.slice(0, 8).map((d) => cartaoDuvida(m, d)).join('') || vazio('Nenhuma dúvida aberta.')}</div>` })}
      </div>
    </div>`;

  const ctx = { cadeiraId: c.id };
  const acoes = {
    duvida: novaDuvida, questao: novaQuestao, material: novoMaterial, avaliacao: novaAvaliacao,
    assunto: (mm, x) => novoAssunto(mm, x), atividade: (mm, x) => novoEstudo(mm, { ...x, tipo: 'Escrevendo trabalho' }),
  };
  el.querySelectorAll('[data-mais]').forEach((b) => b.addEventListener('click', () => acoes[b.dataset.mais](m, ctx)));
  ligarAvaliacoes(el, m);
  ligarEstudos(el, m);
  ligarDuvidas(el, m);
  ligarMateriais(el, m);
  ligarFiltroTipo(el, () => detalhe(el, m, id));
  botoesNoTitulo(el);
  lembrarAberto(el);
  mostrarImagens(el);
}

/** Linha clicável de avaliação (abre para editar data, link, nota, entrega). */
export function linhaAvaliacao(m, a) {
  const n = diasEntre(m.hoje, a.data);
  const nota = a.nota !== null ? `<span class="tag tag-ok">${String(a.nota).replace('.', ',')}${a.vale ? `/${String(a.vale).replace('.', ',')}` : ''}</span>` : a.vale ? `<span class="tag">vale ${String(a.vale).replace('.', ',')}</span>` : '';
  const anexos = m.materiais.filter((x) => x.avaliacaoId === a.id).length + m.estudos.filter((e) => e.avaliacaoId === a.id).length;
  const entrega = a.entrega === 'Enviado no Classroom' ? '<span class="tag tag-ok">enviado</span>' : a.entrega === 'Não precisa' ? '' : n <= 7 && n >= 0 && a.entrega === 'Pendente' ? '<span class="tag tag-alerta">enviar</span>' : '';
  return `<li class="${n < 0 ? 'passada' : n <= 3 ? 'urgente' : ''}" data-avaliacao="${esc(a.id)}" tabindex="0" role="button">
    <span class="contagem">${n < 0 ? '<small>feita</small>' : `<b>${n === 0 ? 'hoje' : n}</b>${n === 0 ? '' : n === 1 ? 'dia' : 'dias'}`}</span>
    <span><strong>${esc(a.titulo)}</strong><small class="meta">${formatoCurto(a.data)}${a.hora ? ` ${esc(a.hora)}` : ''} · ${esc(a.tipo)}${anexos ? ` · ${anexos} anexo${anexos > 1 ? 's' : ''}` : ''}</small></span>
    <span class="av-tags">${a.link ? `<a class="btn-mini" href="${esc(a.link)}" target="_blank" rel="noopener" data-sem-abrir title="Abrir o link do material">${icone('externo', 'ic-mini')}</a>` : ''}${nota}${entrega}</span>
  </li>`;
}

export function ligarAvaliacoes(el, m) {
  el.querySelectorAll('[data-avaliacao]').forEach((li) => {
    const abrir = () => abrirAvaliacao(m, m.avaliacoes.find((a) => a.id === li.dataset.avaliacao));
    li.addEventListener('click', (e) => !e.target.closest('[data-sem-abrir]') && abrir());
    li.querySelectorAll('[data-sem-abrir]').forEach((x) => x.addEventListener('keydown', (e) => e.stopPropagation()));
    li.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), abrir()));
  });
}

function paginaAssunto(el, m, id, assunto) {
  const c = cadeiraPorId(m, id);
  if (!c) return detalhe(el, m, id);
  const redesenhar = () => paginaAssunto(el, m, id, assunto);
  const daqui = (x) => x.cadeiraId === id && mesmoAssunto(x.assunto, assunto);
  const ligado = (x) => ligadoAoAssunto(x, id, assunto);
  const ehAtalho = (x) => atalhoDoAssunto(x, id, assunto);
  const aulas = m.aulas.filter(daqui);
  const d = dominioAssunto(m, id, assunto);
  const todasDuvidas = m.duvidas.filter(ligado);
  const chaveMotivo = `${id}|${assunto}`;
  const duvidas = todasDuvidas.filter((x) => !filtroMotivo[chaveMotivo] || x.motivo === filtroMotivo[chaveMotivo]);
  const materiais = m.materiais.filter(ligado);
  const reg = registroAssunto(m, id, assunto);
  const goodnotes = (qual) => materiais.find((x) => x.tipo.toLowerCase() === `goodnotes | ${qual}`);
  const qs = m.questoes.filter(daqui);
  const est = estatisticaQuestoes(qs);
  const cartoes = m.cartoes.filter(daqui);
  const paraRevisar = cartoesVencidos(m, daqui).length + cartoes.filter((x) => !x.revisoes).length;
  const estudos = m.estudos.filter(daqui);
  const tipos = m.config.tiposMaterial;
  const dataBase = aulas.find((a) => a.data <= m.hoje)?.data ?? aulas[0]?.data ?? m.hoje;
  const faltas = aulas.filter((a) => a.aconteceu && !a.presente).length;

  el.innerHTML = `
    <header class="cabecalho cabecalho-linha">
      <div><p class="sobretitulo"><a href="#/cadeiras/${encodeURIComponent(id)}">${esc(nomeCadeira(m, id))}</a>${reg?.secundaria ? ` · também em <a href="#/cadeiras/${encodeURIComponent(reg.secundaria)}">${esc(nomeCadeira(m, reg.secundaria))}</a>` : ''}</p><h1>${esc(assunto)}</h1>
        <p class="dominio-linha">${seloDominio(d)} <span class="meta">${esc(d.motivo)}</span></p>
        ${reg?.obs ? `<p class="assunto-obs">${linkificar(reg.obs)}</p>` : ''}</div>
      <div class="acoes-topo">
        <button class="btn" data-renomear title="Mudar o nome, a cadeira ou ligar a uma cadeira secundária">${icone('anotacao', 'ic-mini')} Renomear / mover</button>
        ${cartoes.length ? `<button class="btn btn-principal" data-revisar>${icone('metodo', 'ic-mini')} Revisar cartões (${paraRevisar})</button>` : ''}
      </div>
    </header>
    <div class="atalhos-goodnotes">
      ${['pessoal', 'colaborativo'].map((qual) => {
        const g = goodnotes(qual);
        return g ? `<a class="btn btn-goodnotes" href="${esc(g.link)}" target="_blank" rel="noopener">${icone('goodnotes', 'ic-mini')} Goodnotes · ${qual === 'pessoal' ? 'Pessoal' : 'Colaborativo'} ${icone('externo', 'ic-mini')}</a>`
          : `<button class="btn btn-goodnotes vazio-gn" data-goodnotes="${qual}">${icone('goodnotes', 'ic-mini')} + Goodnotes ${qual === 'pessoal' ? 'Pessoal' : 'Colaborativo'}</button>`;
      }).join('')}
    </div>
    <div class="grade-cadeira">
      <div class="coluna">
        ${cartaoRecolhivel({ titulo: 'Aulas', iconeNome: 'aula', chave: 'assunto-aulas', aberto: aulas.length <= 3,
          contagem: `${aulas.length} ${aulas.length === 1 ? 'data' : 'datas'}${faltas ? ` · ${faltas} falta${faltas > 1 ? 's' : ''}` : ''}`,
          corpo: aulas.length ? `<ul class="aulas-presenca">
            <li class="ap-cab"><span></span><span>teve aula</span><span>fui</span></li>
            ${aulas.map((a) => `<li class="${a.data === m.hoje ? 'hoje' : ''}">
              <span><b>${esc(dataCurta(a.data))}</b> · ${esc(a.inicio)}–${esc(a.fim)} · ${esc(a.tipo)}${a.turma !== 'Todas' ? ` · ${esc(a.turma)}` : ''}
                <button class="btn-mini btn-aula-assunto" data-assunto-aula="${esc(a.id)}" title="Esta aula foi sobre outro assunto? Trocar só esta aula" aria-label="Trocar o assunto da aula de ${esc(dataCurta(a.data))}">${icone('anotacao', 'ic-mini')}</button>
                <small class="meta">${esc([a.professor, a.local].filter(Boolean).join(' · '))}</small></span>
              <label class="ap-check" title="Teve aula"><input type="checkbox" data-aula="${esc(a.id)}" data-campo="aconteceu" ${a.aconteceu ? 'checked' : ''} aria-label="Teve aula em ${esc(dataCurta(a.data))}"></label>
              <label class="ap-check" title="Fui"><input type="checkbox" data-aula="${esc(a.id)}" data-campo="presente" ${a.presente ? 'checked' : ''} aria-label="Fui à aula de ${esc(dataCurta(a.data))}"></label>
            </li>`).join('')}</ul>` : vazio('Sem aula no cronograma para este assunto.') })}
        ${cartaoRecolhivel({ titulo: 'Materiais', iconeNome: 'materiais', chave: 'assunto-materiais', contagem: materiais.length, extra: botaoMais('material', 'Adicionar material'),
          corpo: `${blocoMateriais(m, materiais, `ass-${id}-${assunto}`, { atalho: ehAtalho })}
            <div class="ferramenta-arquivo"><span class="meta">Nome de arquivo:</span>
              <select id="tipo-arquivo" aria-label="Tipo de material">${tipos.map((t, i) => `<option value="${i}" ${i === 1 ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select>
              <button class="btn-mini" data-nome-arquivo>${icone('copiar', 'ic-mini')} copiar</button></div>` })}
        ${cartaoRecolhivel({ titulo: 'Estudos', iconeNome: 'estudo', chave: celular() ? 'assunto-estudos-cel' : 'assunto-estudos', aberto: !celular(), contagem: estudos.length, extra: botaoMais('estudo', 'Marcar estudo'),
          corpo: estudos.length ? `<ul class="lista-estudos">${estudos.map((e) => linhaEstudo(m, e, { mostrarCadeira: false })).join('')}</ul>` : vazio('Nenhum estudo marcado para este assunto.') })}
      </div>
      <div class="coluna">
        ${cartaoRecolhivel({ titulo: 'Dúvidas', iconeNome: 'duvidas', chave: celular() ? 'assunto-duvidas-cel' : 'assunto-duvidas', aberto: !celular(), contagem: `${todasDuvidas.filter((x) => !x.sanada).length} abertas`, extra: botaoMais('duvida', 'Nova dúvida'),
          corpo: `${todasDuvidas.length > 1 ? `<div class="filtro-motivo">${chipsMotivo(todasDuvidas, filtroMotivo[chaveMotivo] ?? '', 'motivoAssunto')}</div>` : ''}
            <div class="lista-duvidas compacta">${duvidas.map((x) => cartaoDuvida(m, x, { mostrarCadeira: false, atalho: ehAtalho(x) })).join('') || vazio(todasDuvidas.length ? 'Nenhuma dúvida desse tipo.' : 'Nenhuma dúvida registrada.')}</div>` })}
        ${cartaoRecolhivel({ titulo: 'Questões', iconeNome: 'questoes', chave: celular() ? 'assunto-questoes-cel' : 'assunto-questoes', aberto: !celular(), contagem: est.total, extra: botaoMais('questao', 'Registrar questão'),
          corpo: est.total ? `<p><b>${pct(est.taxa)}</b> de acerto efetivo · ${est.chutes} chute(s) · ${est.aprofundar} pedem aprofundamento</p>
            <ul class="lista-simples">${qs.slice(0, 8).map((q) => `<li><span><span class="res res-${q.resultado.toLowerCase()}">${esc(q.resultado)}</span>${q.imagem ? ` <button class="link-botao" data-ver-imagem="${esc(q.imagem)}">${icone('imagem', 'ic-mini')} print</button>` : ''}</span><span class="meta">${q.data ? formatoCurto(q.data) : ''} · conf. ${q.confianca}${q.motivos.length ? ` · ${esc(q.motivos.join(', '))}` : ''}</span></li>`).join('')}</ul>` : vazio('Nenhuma questão registrada.') })}
        ${cartaoRecolhivel({ titulo: 'Cartões', iconeNome: 'flashcard', chave: celular() ? 'assunto-cartoes-cel' : 'assunto-cartoes', aberto: !celular(), contagem: cartoes.length, extra: botaoMais('cartao', 'Novo cartão'),
          corpo: cartoes.length ? `<ul class="lista-simples">${cartoes.slice(0, 8).map((x) => `<li><b>${esc(x.frente.slice(0, 100))}${x.imagemFrente ? ' 🖼' : ''}</b><span class="meta">${x.revisoes ? `próxima ${formatoCurto(x.vence)}` : 'novo'}</span></li>`).join('')}</ul>` : vazio('Sem cartões. Transforme uma dúvida em cartão.') })}
      </div>
    </div>`;

  ligarDuvidas(el, m);
  ligarMateriais(el, m);
  ligarEstudos(el, m);
  ligarFiltroTipo(el, redesenhar);
  botoesNoTitulo(el);
  lembrarAberto(el);
  mostrarImagens(el);
  const ctx = { cadeiraId: id, assunto };
  const acoes = { duvida: novaDuvida, questao: novaQuestao, material: novoMaterial, cartao: novoCartao, estudo: (mm, x) => novoEstudo(mm, { ...x }) };
  el.querySelectorAll('[data-mais]').forEach((b) => b.addEventListener('click', () => acoes[b.dataset.mais](m, ctx)));
  el.querySelector('[data-revisar]')?.addEventListener('click', () => revisarAssunto(id, assunto));
  el.querySelector('[data-renomear]').addEventListener('click', () => renomearAssunto(m, id, assunto));
  el.querySelectorAll('[data-assunto-aula]').forEach((b) => b.addEventListener('click', () => editarAssuntoDaAula(m, m.aulas.find((a) => a.id === b.dataset.assuntoAula))));
  el.querySelectorAll('[data-goodnotes]').forEach((b) =>
    b.addEventListener('click', () => novoMaterial(m, { cadeiraId: id, assunto, tipo: `Goodnotes | ${b.dataset.goodnotes === 'pessoal' ? 'Pessoal' : 'Colaborativo'}` }))
  );
  el.querySelectorAll('[data-filtro="motivoAssunto"]').forEach((b) =>
    b.addEventListener('click', () => {
      filtroMotivo[chaveMotivo] = b.dataset.valor;
      redesenhar();
    })
  );
  el.querySelectorAll('[data-aula]').forEach((cb) =>
    cb.addEventListener('change', async () => {
      const campos = { [cb.dataset.campo]: cb.checked };
      if (cb.dataset.campo === 'presente' && cb.checked) campos.aconteceu = true; // se fui, teve aula
      cb.disabled = true;
      try {
        await atualizar('Aulas', cb.dataset.aula, campos);
      } catch (e) {
        cb.checked = !cb.checked;
        cb.disabled = false;
        aviso(e.message);
      }
    })
  );
  el.querySelectorAll('[data-ver-imagem]').forEach((b) => b.addEventListener('click', () => verImagem(b.dataset.verImagem)));
  el.querySelector('[data-nome-arquivo]').addEventListener('click', () => {
    const tipo = tipos[+el.querySelector('#tipo-arquivo').value];
    const nome = nomeArquivo({
      periodo: periodoCadeira(m, id), tipo: tipo?.nome ?? 'Resumo', cadeira: c.nome.replace(/\s*\(.*\)\s*/, ''),
      assunto, data: dataBase, aluna: m.config.aluna, ext: tipo?.icone === 'video' ? 'mp4' : 'pdf',
    });
    copiar(nome, `Copiado: ${nome}`);
  });
}

/** Linha de estudo: check de feito, título que abre para editar, cadeira e "Abrir assunto". */
export function linhaEstudo(m, e, { mostrarCadeira = true, botaoHoje = false } = {}) {
  return `<li class="estudo ${e.feito ? 'feito' : ''}">
    <label class="check-redondo" title="${e.feito ? 'Feito' : 'Marcar como feito'}"><input type="checkbox" data-estudo="${esc(e.id)}" ${e.feito ? 'checked' : ''} aria-label="Feito: ${esc(e.atividade)}"><span class="caixa">${icone('check')}</span></label>
    <div class="estudo-texto">
      <button class="link-botao t-forte" data-editar-estudo="${esc(e.id)}">${esc(e.atividade)}</button>
      ${e.tipo && e.tipo !== 'Estudo' ? `<span class="tag tag-atividade">${esc(e.tipo)}</span>` : ''}
      ${e.avaliacaoId && m.avaliacoes.some((a) => a.id === e.avaliacaoId) ? `<span class="tag tag-av">${icone('avaliacoes', 'ic-mini')} ${esc(m.avaliacoes.find((a) => a.id === e.avaliacaoId).titulo)}</span>` : ''}
      <p class="meta">${e.data ? `${esc(dataCurta(e.data))}${e.inicio ? ` ${esc(e.inicio)}` : ''}` : '<span class="tag">sem data</span>'}
        ${mostrarCadeira && e.cadeiraId ? ` · <a href="#/cadeiras/${encodeURIComponent(e.cadeiraId)}">${esc(nomeCadeira(m, e.cadeiraId))}</a>` : ''}${!e.cadeiraId ? ' · Pessoal' : ''}${e.assunto && !mostrarCadeira ? '' : e.assunto ? ` · ${esc(e.assunto)}` : ''}</p>
      ${e.obs ? `<p class="estudo-obs">${linkificar(e.obs)}</p>` : ''}
    </div>
    ${botaoHoje && !e.data ? `<button class="btn-mini" data-para-hoje="${esc(e.id)}">para hoje</button>` : ''}
    ${mostrarCadeira && e.cadeiraId && e.assunto ? `<a class="btn-mini btn-abrir" href="#/cadeiras/${encodeURIComponent(e.cadeiraId)}/${encodeURIComponent(e.assunto)}">Abrir assunto ${icone('seta', 'ic-mini')}</a>` : ''}
  </li>`;
}

export function ligarEstudos(el, m) {
  el.querySelectorAll('[data-estudo]').forEach((cb) =>
    cb.addEventListener('change', async () => {
      cb.disabled = true;
      try {
        await marcarEstudo(m, cb.dataset.estudo, cb.checked);
        if (cb.checked) aviso('Feito! Ficou registrado com a data de hoje.');
      } catch (erro) {
        cb.checked = !cb.checked;
        cb.disabled = false;
        aviso(erro.message);
      }
    })
  );
  el.querySelectorAll('[data-editar-estudo]').forEach((b) => b.addEventListener('click', () => editarEstudo(m, m.estudos.find((e) => e.id === b.dataset.editarEstudo))));
  el.querySelectorAll('[data-para-hoje]').forEach((b) =>
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await atualizar('Estudos', b.dataset.paraHoje, { data: m.hoje });
      } catch (e) {
        b.disabled = false;
        aviso(e.message);
      }
    })
  );
}

/** Abre uma imagem (print) guardada no Drive. */
export async function verImagem(id) {
  const { abrirModal } = await import('../ui/componentes.js');
  abrirModal('Imagem', `<img class="imagem-grande" data-imagem-drive="${esc(id)}" alt="Imagem guardada">`);
  mostrarImagens(document.querySelector('.modal'));
}

export function render(el, m, [id, assunto]) {
  if (id && assunto) paginaAssunto(el, m, id, assunto);
  else if (id) detalhe(el, m, id);
  else lista(el, m);
}
