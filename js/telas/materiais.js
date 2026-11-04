// Tela MATERIAIS — links de slides, resumos, gravações, livros… por cadeira
// e assunto, com ícone por tipo. Material da turma fica separado do seu,
// com um check rápido de "já copiei".

import { esc } from '../util/texto.js';
import { formatoCurto } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { chips, seletorCadeira, ligarFiltros, vazio, aviso, casa, kpi } from '../ui/componentes.js';
import { atualizar } from '../dados/dataSource.js';
import { nomeCadeira } from '../dados/consultas.js';
import { novoMaterial, editarMaterial } from './formularios.js';

const estado = { cadeira: '', origem: 'todas', busca: '', tipo: '' };

/** Ícone do tipo de material (pela aba Config). */
export const iconeTipo = (m, tipo) => m.config.tiposMaterial.find((t) => t.nome === tipo)?.icone ?? 'arquivo';

/** Linha de um material (também usada nas páginas da cadeira e do assunto). */
export function linhaMaterial(m, x, { mostrarCadeira = true, mostrarAssunto = false } = {}) {
  const onde = [mostrarCadeira ? nomeCadeira(m, x.cadeiraId) : '', (mostrarCadeira || mostrarAssunto) ? x.assunto || 'sem assunto' : ''].filter(Boolean).join(' · ');
  return `
    <li class="material">
      <span class="material-icone">${icone(iconeTipo(m, x.tipo))}</span>
      <div class="material-texto">
        ${x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener" class="t-forte">${esc(x.titulo || x.link)}</a>` : `<span class="t-forte">${esc(x.titulo)}</span>`}
        <p class="meta">${esc(x.tipo)}${onde ? ` · ${esc(onde)}` : ''}${x.criado ? ` · ${formatoCurto(x.criado)}` : ''}${x.obs ? ` · ${esc(x.obs)}` : ''}</p>
      </div>
      ${x.driveId ? `<span class="tag tag-ok" title="Guardado no Drive">${icone('nuvem', 'ic-mini')} Drive</span>` : ''}
      <span class="tag ${x.origem === 'Turma' ? 'tag-turma' : ''}">${esc(x.origem)}</span>
      ${x.origem === 'Turma' ? `<label class="copiado" title="Já copiei para a minha pasta"><input type="checkbox" data-copiado="${esc(x.id)}" ${x.copiado ? 'checked' : ''}> copiado</label>` : ''}
      <button class="btn-mini" data-editar-material="${esc(x.id)}" title="Editar ou mudar de lugar" aria-label="Editar ${esc(x.titulo)}">${icone('anotacao', 'ic-mini')}</button>
    </li>`;
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
  if (m) el.querySelectorAll('[data-editar-material]').forEach((b) => b.addEventListener('click', () => editarMaterial(m, m.materiais.find((x) => x.id === b.dataset.editarMaterial))));
}

export function render(el, m) {
  const redesenhar = () => render(el, m);
  const lista = m.materiais.filter(
    (x) =>
      (!estado.cadeira || x.cadeiraId === estado.cadeira) &&
      (estado.origem === 'todas' || (estado.origem === 'minhas') === (x.origem !== 'Turma')) &&
      (!estado.tipo || x.tipo === estado.tipo) &&
      casa(`${x.titulo} ${x.assunto} ${x.tipo} ${x.obs}`, estado.busca)
  );
  // Agrupa por cadeira > assunto
  const grupos = new Map();
  for (const x of lista) {
    const k = `${x.cadeiraId}|${x.assunto}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(x);
  }
  const turmaPendente = m.materiais.filter((x) => x.origem === 'Turma' && !x.copiado).length;

  el.innerHTML = `
    <header class="cabecalho cabecalho-linha">
      <div><p class="sobretitulo">Links organizados por cadeira e assunto</p><h1>Materiais</h1></div>
      <div class="acoes-topo"><button class="btn btn-principal" data-novo>${icone('materiais', 'ic-mini')} + Material</button></div>
    </header>
    <div class="kpis">
      ${kpi({ rotulo: 'Materiais', valor: m.materiais.length })}
      ${kpi({ rotulo: 'Meus', valor: m.materiais.filter((x) => x.origem !== 'Turma').length })}
      ${kpi({ rotulo: 'Da turma ainda não copiados', valor: turmaPendente, tom: turmaPendente ? 'alerta' : '' })}
      ${kpi({ rotulo: 'Guardados no Drive', valor: m.materiais.filter((x) => x.driveId).length, sub: 'enviados pelo Código M ou pelo Classroom' })}
    </div>
    <div class="filtros">
      ${chips('origem', [['todas', 'Todos'], ['minhas', 'Meus'], ['turma', 'Da turma']], estado.origem)}
      ${chips('tipo', [['', 'Todos os tipos'], ...m.config.tiposMaterial.map((t) => [t.nome, t.nome])], estado.tipo)}
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

  ligarFiltros(el, estado, redesenhar);
  ligarMateriais(el, m);
  el.querySelector('[data-novo]').addEventListener('click', () => novoMaterial(m, { cadeiraId: estado.cadeira, tipo: estado.tipo }));
}
