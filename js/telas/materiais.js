// Tela MATERIAIS — links de slides, resumos, gravações, livros… por cadeira
// e assunto, com ícone por tipo. Material da turma fica separado do seu,
// com um check rápido de "já copiei".

import { esc } from '../util/texto.js';
import { formatoCurto } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { chips, seletorCadeira, ligarFiltros, vazio, aviso, casa, kpi } from '../ui/componentes.js';
import { atualizar } from '../dados/dataSource.js';
import { nomeCadeira } from '../dados/consultas.js';
import { novoMaterial } from './formularios.js';

const estado = { cadeira: '', origem: 'todas', busca: '' };

/** Ícone do tipo de material (pela aba Config). */
export const iconeTipo = (m, tipo) => m.config.tiposMaterial.find((t) => t.nome === tipo)?.icone ?? 'arquivo';

/** Linha de um material (também usada na página do assunto). */
export function linhaMaterial(m, x, { mostrarCadeira = true } = {}) {
  return `
    <li class="material">
      <span class="material-icone">${icone(iconeTipo(m, x.tipo))}</span>
      <div class="material-texto">
        ${x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener" class="t-forte">${esc(x.titulo || x.link)}</a>` : `<span class="t-forte">${esc(x.titulo)}</span>`}
        <p class="meta">${esc(x.tipo)}${mostrarCadeira ? ` · ${esc(nomeCadeira(m, x.cadeiraId))}${x.assunto ? ` · ${esc(x.assunto)}` : ''}` : ''}${x.criado ? ` · ${formatoCurto(x.criado)}` : ''}${x.obs ? ` · ${esc(x.obs)}` : ''}</p>
      </div>
      <span class="tag ${x.origem === 'Turma' ? 'tag-turma' : ''}">${esc(x.origem)}</span>
      ${x.origem === 'Turma' ? `<label class="copiado" title="Já copiei para a minha pasta"><input type="checkbox" data-copiado="${esc(x.id)}" ${x.copiado ? 'checked' : ''}> copiado</label>` : ''}
    </li>`;
}

export function ligarMateriais(el) {
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
}

export function render(el, m) {
  const redesenhar = () => render(el, m);
  const lista = m.materiais.filter(
    (x) =>
      (!estado.cadeira || x.cadeiraId === estado.cadeira) &&
      (estado.origem === 'todas' || (estado.origem === 'minhas') === (x.origem !== 'Turma')) &&
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
      <div class="kpi kpi-nota"><span class="kpi-rotulo">${icone('alerta', 'ic-mini')}Envio ao Drive</span><span class="kpi-sub">Por enquanto o Código M guarda <b>links</b>. Enviar arquivos direto para a pasta certa do Drive é a próxima etapa (precisa de uma permissão extra do Google).</span></div>
    </div>
    <div class="filtros">
      ${chips('origem', [['todas', 'Todos'], ['minhas', 'Meus'], ['turma', 'Da turma']], estado.origem)}
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
  ligarMateriais(el);
  el.querySelector('[data-novo]').addEventListener('click', () => novoMaterial(m, { cadeiraId: estado.cadeira }));
}
