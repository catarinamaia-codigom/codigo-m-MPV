// Tela MATERIAIS — links de slides, resumos, gravações, livros… por cadeira
// e assunto, com ícone por tipo. Material da turma fica separado do seu,
// com um check rápido de "já copiei". Gravações, vídeos do YouTube e
// arquivos do Drive abrem no visualizador lateral, sem sair do Código M.
// Excluir não apaga na hora: o material vai para Pendências › A excluir.

import { esc, formatar } from '../util/texto.js';
import { formatoCurto } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { chips, seletorCadeira, ligarFiltros, vazio, aviso, casa, kpi } from '../ui/componentes.js';
import { atualizar } from '../dados/dataSource.js';
import { nomeCadeira } from '../dados/consultas.js';
import { novoMaterial, editarMaterial, novaDuvida } from './formularios.js';
import { formaDeVer, baixar } from '../dados/drive.js';
import { abrirVisualizador } from '../ui/visualizador.js';
import { abrirModoAula } from '../ui/modoAula.js';
import { sortearPergunta } from '../regras/perguntas.js';

const estado = { cadeira: '', origem: 'todas', busca: '', tipo: '' };
let perguntaAtual = null;
let respostaVisivel = false;

/** Ícone do tipo de material (pela aba Config). */
export const iconeTipo = (m, tipo) => m.config.tiposMaterial.find((t) => t.nome === tipo)?.icone ?? 'arquivo';

/** Achar um material pelo id (inclui os "virtuais" que vêm do link de uma avaliação). */
const acharMaterial = (m, id) => m.materiais.find((x) => x.id === id) ?? materiaisDeAvaliacoes(m).find((x) => x.id === id);

/**
 * Avaliações antigas guardavam o material só no campo "link": viram itens
 * de material (só leitura) para aparecerem também no material da cadeira.
 */
export function materiaisDeAvaliacoes(m, { cadeiraId = '' } = {}) {
  return m.avaliacoes
    .filter((a) => a.link && (!cadeiraId || a.cadeiraId === cadeiraId) && !m.materiais.some((x) => x.link === a.link))
    .map((a) => ({
      id: `av:${a.id}`, virtual: true, criado: a.data, cadeiraId: a.cadeiraId, assunto: '', tipo: 'Trabalho da disciplina',
      titulo: `Material: ${a.titulo}`, link: a.link, origem: 'Minha', obs: '', driveId: '', avaliacaoId: a.id, assuntosExtra: [],
    }));
}

/** Linha de um material (também usada nas páginas da cadeira, do assunto e da avaliação). */
export function linhaMaterial(m, x, { mostrarCadeira = true, mostrarAssunto = false, atalho = false } = {}) {
  const onde = [mostrarCadeira ? nomeCadeira(m, x.cadeiraId) : '', (mostrarCadeira || mostrarAssunto) ? x.assunto || (x.avaliacaoId ? '' : 'sem assunto') : ''].filter(Boolean).join(' · ');
  const av = x.avaliacaoId && m.avaliacoes.find((a) => a.id === x.avaliacaoId);
  const forma = formaDeVer(x);
  const titulo = esc(x.titulo || x.link);
  return `
    <li class="material ${atalho ? 'material-atalho' : ''}">
      <span class="material-icone">${icone(iconeTipo(m, x.tipo))}</span>
      <div class="material-texto">
        ${forma.tipo ? `<button class="link-botao t-forte" data-ver-material="${esc(x.id)}" title="Abrir aqui ao lado">${titulo}</button>`
          : x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener" class="t-forte">${titulo}</a>` : `<span class="t-forte">${titulo}</span>`}
        <p class="meta">${esc(x.tipo)}${onde ? ` · ${esc(onde)}` : ''}${x.criado ? ` · ${formatoCurto(x.criado)}` : ''}
          ${av ? ` · <span class="tag tag-av" title="Material da avaliação">${icone('avaliacoes', 'ic-mini')} ${esc(av.titulo)}</span>` : ''}
          ${atalho ? ` · <span class="tag tag-atalho" title="Ligado também a este assunto">${icone('link', 'ic-mini')} atalho de ${esc(x.assunto || nomeCadeira(m, x.cadeiraId))}</span>` : ''}</p>
        ${x.obs ? `<p class="material-obs">${formatar(x.obs)}</p>` : ''}
      </div>
      ${x.driveId ? `<span class="tag tag-ok" title="Guardado no Drive">${icone('nuvem', 'ic-mini')} Drive</span>` : ''}
      ${x.autor ? `<span class="tag tag-sigla" title="Enviado por colaboradora">${esc(x.autor)}</span>` : `<span class="tag ${x.origem === 'Turma' ? 'tag-turma' : ''}">${esc(x.origem)}</span>`}
      ${x.origem === 'Turma' ? `<label class="copiado" title="Já copiei para a minha pasta"><input type="checkbox" data-copiado="${esc(x.id)}" ${x.copiado ? 'checked' : ''}> copiado</label>` : ''}
      <span class="material-botoes">
        ${forma.tipo ? `<button class="btn-mini" data-ver-material="${esc(x.id)}" title="Assistir / ler aqui" aria-label="Abrir ${titulo} aqui">${icone('play', 'ic-mini')}</button>` : ''}
        ${forma.driveId ? `<button class="btn-mini" data-baixar-material="${esc(x.id)}" title="Baixar sem abrir o Drive" aria-label="Baixar ${titulo}">${icone('baixar', 'ic-mini')}</button>` : ''}
        <button class="btn-mini" data-editar-material="${esc(x.id)}" title="${x.virtual ? 'Abrir a avaliação' : 'Editar, observar ou mudar de lugar'}" aria-label="Editar ${titulo}">${icone('anotacao', 'ic-mini')}</button>
        ${x.virtual ? '' : `<button class="btn-mini btn-mini-perigo" data-excluir-material="${esc(x.id)}" title="Excluir (vai para Pendências › A excluir)" aria-label="Excluir ${titulo}">${icone('lixeira', 'ic-mini')}</button>`}
      </span>
    </li>`;
}

/** Excluir: o material sai das listas e espera confirmação em Pendências › A excluir. */
export async function pedirExclusao(m, x) {
  if (!confirm(`Excluir “${x.titulo}”?\n\nEle sai das listas e fica em Pendências › A excluir até você confirmar. Nada é apagado agora.`)) return false;
  try {
    await atualizar('Materiais', x.id, { status: 'A excluir' });
    aviso('Foi para Pendências › A excluir.');
    return true;
  } catch (e) {
    aviso(e.message);
    return false;
  }
}

/** Abre o material no visualizador lateral (ou em outra aba, se não der para mostrar aqui). */
export function abrirMaterial(m, x) {
  const forma = formaDeVer(x);
  if (!forma.tipo) {
    if (x.link) window.open(x.link, '_blank', 'noopener');
    return;
  }
  abrirVisualizador({
    titulo: x.titulo || x.tipo,
    forma,
    link: x.link,
    contexto: [nomeCadeira(m, x.cadeiraId), x.assunto].filter(Boolean).join(' · '),
    aoBaixar: forma.driveId ? () => baixar(forma.driveId, x.titulo) : null,
    aoNovaDuvida: () => novaDuvida(m, { cadeiraId: x.cadeiraId, assunto: x.assunto, materialId: x.virtual ? '' : x.id }),
    aoModoAula: () => abrirModoAula(m, { cadeiraId: x.cadeiraId, assunto: x.assunto }),
    aoExcluir: x.virtual ? null : () => pedirExclusao(m, x),
  });
}

export function ligarMateriais(el, m) {
  el.querySelectorAll('[data-copiado]').forEach((cb) =>
    cb.addEventListener('change', async () => {
      cb.disabled = true;
      try {
        await atualizar('Materiais', cb.dataset.copiado, { copiado: cb.checked });
      } catch (e) {
        cb.checked = !cb.checked;
        cb.disabled = false;
        aviso(e.message);
      }
    })
  );
  if (!m) return;
  el.querySelectorAll('[data-editar-material]').forEach((b) =>
    b.addEventListener('click', async () => {
      const x = acharMaterial(m, b.dataset.editarMaterial);
      if (x?.virtual) {
        const { abrirAvaliacao } = await import('./avaliacao.js');
        abrirAvaliacao(m, m.avaliacoes.find((a) => a.id === x.avaliacaoId));
      } else editarMaterial(m, x);
    })
  );
  el.querySelectorAll('[data-ver-material]').forEach((b) => b.addEventListener('click', () => abrirMaterial(m, acharMaterial(m, b.dataset.verMaterial))));
  el.querySelectorAll('[data-baixar-material]').forEach((b) =>
    b.addEventListener('click', async () => {
      const x = acharMaterial(m, b.dataset.baixarMaterial);
      b.disabled = true;
      try {
        await baixar(formaDeVer(x).driveId, x.titulo);
      } catch (e) {
        aviso(e.message);
      } finally {
        b.disabled = false;
      }
    })
  );
  el.querySelectorAll('[data-excluir-material]').forEach((b) => b.addEventListener('click', () => pedirExclusao(m, acharMaterial(m, b.dataset.excluirMaterial))));
}

/** Cartão "Pergunta de estudo ativo" (sorteio sem IA). */
function cartaoPergunta(m) {
  const p = perguntaAtual;
  return `
    <section class="cartao pergunta-ativa">
      <header class="cartao-topo"><h2>${icone('pergunta')}<span>Pergunta de estudo ativo</span></h2>
        <button class="btn" data-sortear>${icone('ia', 'ic-mini')} ${p ? 'Outra pergunta' : 'Sortear pergunta'}</button></header>
      <div class="cartao-corpo">
        ${p ? `
          <p class="pa-texto">${esc(p.texto)}</p>
          <p class="meta">${esc(p.origem)} · <a href="#/cadeiras/${encodeURIComponent(p.cadeiraId)}${p.assunto ? `/${encodeURIComponent(p.assunto)}` : ''}">${esc(nomeCadeira(m, p.cadeiraId))}${p.assunto ? ` · ${esc(p.assunto)}` : ''}</a></p>
          ${p.resposta ? (respostaVisivel ? `<div class="pa-resposta">${formatar(p.resposta)}</div>` : '<button class="btn-mini" data-ver-resposta>Ver resposta</button>') : '<p class="meta">Responda de memória (em voz alta ou no papel) e depois confira no material do assunto.</p>'}`
        : `<p class="meta">Sorteia uma pergunta dos seus cartões, das dúvidas já sanadas ou de modelos sobre os assuntos que já tiveram aula${estado.cadeira ? ' desta cadeira' : ''}. Responda sem consultar.</p>`}
      </div>
    </section>`;
}

export function render(el, m) {
  const redesenhar = () => render(el, m);
  const todos = [...m.materiais, ...materiaisDeAvaliacoes(m)];
  const lista = todos.filter(
    (x) =>
      (!estado.cadeira || x.cadeiraId === estado.cadeira) &&
      (estado.origem === 'todas' || (estado.origem === 'colab' ? Boolean(x.autor) : estado.origem === 'minhas' ? x.origem !== 'Turma' && !x.autor : x.origem === 'Turma')) &&
      (!estado.tipo || x.tipo === estado.tipo) &&
      casa(`${x.titulo} ${x.assunto} ${x.tipo} ${x.obs}`, estado.busca)
  );
  // Agrupa por cadeira > assunto (material de avaliação sem assunto: grupo da avaliação)
  const grupos = new Map();
  for (const x of lista) {
    const k = `${x.cadeiraId}|${x.assunto}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(x);
  }
  const turmaPendente = m.materiais.filter((x) => x.origem === 'Turma' && !x.copiado).length;
  const tipos = [...new Set([...m.config.tiposMaterial.map((t) => t.nome)])];

  el.innerHTML = `
    <header class="cabecalho cabecalho-linha">
      <div><p class="sobretitulo">Links organizados por cadeira e assunto</p><h1>Materiais</h1></div>
      <div class="acoes-topo"><button class="btn btn-principal" data-novo>${icone('materiais', 'ic-mini')} + Material</button></div>
    </header>
    <div class="kpis">
      ${kpi({ rotulo: 'Materiais', valor: m.materiais.length })}
      ${kpi({ rotulo: 'Meus', valor: m.materiais.filter((x) => x.origem !== 'Turma').length })}
      ${kpi({ rotulo: 'Da turma ainda não copiados', valor: turmaPendente, tom: turmaPendente ? 'alerta' : '' })}
      ${kpi({ rotulo: 'A excluir', valor: m.materiaisAExcluir.length, sub: 'esperando confirmação', href: '#/pendencias', tom: m.materiaisAExcluir.length ? 'alerta' : '' })}
    </div>
    ${cartaoPergunta(m)}
    <div class="filtros">
      ${chips('origem', [['todas', 'Todos'], ['minhas', 'Meus'], ['turma', 'Da turma'], ['colab', 'Colaboradoras']], estado.origem)}
      ${chips('tipo', [['', 'Todos os tipos'], ...tipos.map((t) => [t, t])], estado.tipo)}
      ${seletorCadeira(m, estado.cadeira)}
      <input class="filtro-texto" type="search" placeholder="Buscar materiais" data-filtro-texto="busca" value="${esc(estado.busca)}">
    </div>
    ${grupos.size ? [...grupos.entries()].map(([k, itens]) => {
      const [cad, ass] = k.split('|');
      return `<section class="grupo-material">
        <h2 class="grupo-titulo"><a href="#/cadeiras/${encodeURIComponent(cad)}${ass ? `/${encodeURIComponent(ass)}` : ''}">${esc(nomeCadeira(m, cad))}${ass ? ` <span>· ${esc(ass)}</span>` : ''}</a></h2>
        <ul class="lista-materiais">${itens.map((x) => linhaMaterial(m, x, { mostrarCadeira: false })).join('')}</ul>
      </section>`;
    }).join('') : vazio('Nenhum material com esses filtros. Use “+ Material” ou o botão dentro de cada assunto.')}`;

  ligarFiltros(el, estado, () => {
    perguntaAtual = null;
    redesenhar();
  });
  ligarMateriais(el, m);
  el.querySelector('[data-novo]').addEventListener('click', () => novoMaterial(m, { cadeiraId: estado.cadeira, tipo: estado.tipo }));
  el.querySelector('[data-sortear]').addEventListener('click', () => {
    perguntaAtual = sortearPergunta(m, { cadeiraId: estado.cadeira });
    respostaVisivel = false;
    if (!perguntaAtual) aviso('Ainda não há cartões, dúvidas sanadas nem aulas dadas para sortear.');
    redesenhar();
  });
  el.querySelector('[data-ver-resposta]')?.addEventListener('click', () => {
    respostaVisivel = true;
    redesenhar();
  });
}
