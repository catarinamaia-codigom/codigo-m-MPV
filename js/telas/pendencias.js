// Tela PENDÊNCIAS — lista completa, atrasadas primeiro.

import { esc } from '../util/texto.js';
import { formatoCurto, contagemDias } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { chips, seletorCadeira, ligarFiltros, vazio, aviso } from '../ui/componentes.js';
import { atualizar } from '../dados/dataSource.js';
import { nomeCadeira, pendenciasAbertas, ideiasAbertas } from '../dados/consultas.js';
import { novaPendencia } from './formularios.js';

const estado = { status: 'abertas', cadeira: '' };

export function render(el, m) {
  const redesenhar = () => render(el, m);
  const abertas = pendenciasAbertas(m);
  const ideias = ideiasAbertas(m);
  const feitas = m.pendencias.filter((p) => p.feita);
  const base = estado.status === 'abertas' ? abertas : estado.status === 'ideias' ? ideias : feitas;
  const lista = base.filter((p) => !estado.cadeira || p.cadeiraId === estado.cadeira);

  el.innerHTML = `
    <header class="cabecalho cabecalho-linha">
      <div><p class="sobretitulo">${abertas.filter((p) => p.faltam !== null && p.faltam < 0).length} atrasada(s)</p><h1>Pendências</h1></div>
      <div class="acoes-topo"><button class="btn btn-principal" data-nova>${icone('pendencias', 'ic-mini')} + Pendência</button></div>
    </header>
    <div class="filtros">
      ${chips('status', [['abertas', `Abertas (${abertas.length})`], ['ideias', `Ideias (${ideias.length})`], ['feitas', `Feitas (${feitas.length})`]], estado.status)}
      ${seletorCadeira(m, estado.cadeira)}
    </div>
    <section class="cartao"><div class="cartao-corpo">
      ${lista.length ? `<ul class="lista-pendencias">${lista.map((p) => `
        <li class="${p.feita ? 'feita' : ''}">
          <span class="prioridade p-${esc(p.prioridade.toLowerCase())}" title="Prioridade ${esc(p.prioridade)}"></span>
          <div><strong>${esc(p.descricao)}</strong>
            <p class="meta">${p.cadeiraId ? `${esc(nomeCadeira(m, p.cadeiraId))} · ` : ''}${p.prazo ? `prazo ${formatoCurto(p.prazo)}` : 'sem prazo'} · ${esc(p.prioridade)}</p></div>
          ${!p.feita && p.prazo ? `<span class="prazo ${p.faltam < 0 ? 'atrasada' : p.faltam <= 1 ? 'proxima' : ''}">${p.faltam < 0 ? `atrasada ${-p.faltam} d` : esc(contagemDias(m.hoje, p.prazo))}</span>` : ''}
          <button class="btn-concluir" data-alternar="${esc(p.id)}" title="${p.feita ? 'Reabrir' : 'Marcar como feita'}" aria-label="${p.feita ? 'Reabrir' : 'Concluir'}: ${esc(p.descricao)}">${icone(p.feita ? 'anterior' : 'check', 'ic-mini')}</button>
        </li>`).join('')}</ul>` : vazio(estado.status === 'abertas' ? 'Nenhuma pendência aberta.' : 'Nada concluído ainda.')}
    </div></section>`;

  ligarFiltros(el, estado, redesenhar);
  el.querySelector('[data-nova]').addEventListener('click', () => novaPendencia(m, { cadeiraId: estado.cadeira }));
  el.querySelectorAll('[data-alternar]').forEach((b) =>
    b.addEventListener('click', async () => {
      const p = m.pendencias.find((x) => x.id === b.dataset.alternar);
      b.disabled = true;
      try {
        await atualizar('Pendencias', p.id, { status: p.feita ? 'Aberta' : 'Feita' });
      } catch (e) {
        b.disabled = false;
        aviso(e.message);
      }
    })
  );
}
