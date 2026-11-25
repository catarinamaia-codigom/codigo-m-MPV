// Tela PENDÊNCIAS — lista completa, atrasadas primeiro.

import { esc } from '../util/texto.js';
import { formatoCurto, contagemDias } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { chips, seletorCadeira, ligarFiltros, vazio, aviso } from '../ui/componentes.js';
import { atualizar, atualizarVarias, emSimulacao } from '../dados/dataSource.js';
import { paraLixeira } from '../dados/drive.js';
import { iconeTipo } from './materiais.js';
import { nomeCadeira, pendenciasAbertas, ideiasAbertas } from '../dados/consultas.js';
import { novaPendencia } from './formularios.js';

const estado = { status: 'abertas', cadeira: '' };

export function render(el, m) {
  const redesenhar = () => render(el, m);
  const abertas = pendenciasAbertas(m);
  const ideias = ideiasAbertas(m);
  const feitas = m.pendencias.filter((p) => p.feita);
  const aExcluir = m.materiaisAExcluir.filter((x) => !estado.cadeira || x.cadeiraId === estado.cadeira);
  const base = estado.status === 'abertas' ? abertas : estado.status === 'ideias' ? ideias : estado.status === 'excluir' ? [] : feitas;
  const lista = base.filter((p) => !estado.cadeira || p.cadeiraId === estado.cadeira);

  el.innerHTML = `
    <header class="cabecalho cabecalho-linha">
      <div><p class="sobretitulo">${abertas.filter((p) => p.faltam !== null && p.faltam < 0).length} atrasada(s)</p><h1>Pendências</h1></div>
      <div class="acoes-topo"><button class="btn btn-principal" data-nova>${icone('pendencias', 'ic-mini')} + Pendência</button></div>
    </header>
    <div class="filtros">
      ${chips('status', [['abertas', `Abertas (${abertas.length})`], ['ideias', `Ideias (${ideias.length})`], ['excluir', `A excluir (${m.materiaisAExcluir.length})`], ['feitas', `Feitas (${feitas.length})`]], estado.status)}
      ${seletorCadeira(m, estado.cadeira)}
    </div>
    <section class="cartao"><div class="cartao-corpo">
      ${estado.status === 'excluir' ? blocoExcluir(m, aExcluir) : lista.length ? `<ul class="lista-pendencias">${lista.map((p) => `
        <li class="${p.feita ? 'feita' : ''}">
          <span class="prioridade p-${esc(p.prioridade.toLowerCase())}" title="Prioridade ${esc(p.prioridade)}"></span>
          <div><strong>${esc(p.descricao)}</strong>
            <p class="meta">${p.cadeiraId ? `${esc(nomeCadeira(m, p.cadeiraId))} · ` : ''}${p.prazo ? `prazo ${formatoCurto(p.prazo)}` : 'sem prazo'} · ${esc(p.prioridade)}</p></div>
          ${!p.feita && p.prazo ? `<span class="prazo ${p.faltam < 0 ? 'atrasada' : p.faltam <= 1 ? 'proxima' : ''}">${p.faltam < 0 ? `atrasada ${-p.faltam} d` : esc(contagemDias(m.hoje, p.prazo))}</span>` : ''}
          <button class="btn-concluir" data-alternar="${esc(p.id)}" title="${p.feita ? 'Reabrir' : 'Marcar como feita'}" aria-label="${p.feita ? 'Reabrir' : 'Concluir'}: ${esc(p.descricao)}">${icone(p.feita ? 'anterior' : 'check', 'ic-mini')}</button>
        </li>`).join('')}</ul>` : vazio(estado.status === 'abertas' ? 'Nenhuma pendência aberta.' : 'Nada concluído ainda.')}
    </div></section>`;

  ligarFiltros(el, estado, redesenhar);
  ligarExcluir(el, m);
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

/** Materiais que você mandou excluir: confirme (vai para a lixeira do Drive) ou restaure. */
function blocoExcluir(m, itens) {
  if (!itens.length) return vazio('Nada esperando exclusão. Use o botão de lixeira de um material para mandar para cá.');
  return `
    <p class="meta">Estes materiais já sumiram das listas. <b>Excluir de vez</b> manda o arquivo para a lixeira do Drive (dá para recuperar lá por 30 dias) e tira da planilha.</p>
    <ul class="lista-materiais">${itens.map((x) => `
      <li class="material">
        <span class="material-icone">${icone(iconeTipo(m, x.tipo))}</span>
        <div class="material-texto">${x.link ? `<a class="t-forte" href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.titulo)}</a>` : `<span class="t-forte">${esc(x.titulo)}</span>`}
          <p class="meta">${esc(x.tipo)} · ${esc(nomeCadeira(m, x.cadeiraId))}${x.assunto ? ` · ${esc(x.assunto)}` : ''}${x.driveId ? ' · arquivo no Drive' : ' · só link'}</p></div>
        <button class="btn-mini" data-restaurar="${esc(x.id)}">${icone('anterior', 'ic-mini')} Restaurar</button>
        <button class="btn-mini btn-mini-perigo" data-excluir-vez="${esc(x.id)}">${icone('lixeira', 'ic-mini')} Excluir de vez</button>
      </li>`).join('')}</ul>
    ${itens.length > 1 ? `<div class="formulario-acoes"><button class="btn btn-perigo" data-excluir-todos>${icone('lixeira', 'ic-mini')} Excluir os ${itens.length} de vez</button></div>` : ''}`;
}

async function excluirDeVez(m, itens) {
  const falhas = new Map(); // id -> mensagem
  for (const x of itens) {
    if (x.driveId && !emSimulacao()) {
      try {
        await paraLixeira(x.driveId);
      } catch (e) {
        falhas.set(x.id, `${x.titulo}: ${e.message}`); // não some da lista se o arquivo continuar no Drive
      }
    }
  }
  const ok = itens.filter((x) => !falhas.has(x.id));
  if (ok.length) await atualizarVarias('Materiais', ok.map((x) => ({ id: x.id, campos: { status: 'Excluído' } })));
  aviso(falhas.size ? `Não consegui excluir ${falhas.size}: ${[...falhas.values()][0]}` : `${ok.length} material(is) excluído(s). No Drive, ficam na lixeira por 30 dias.`);
}

function ligarExcluir(el, m) {
  const achar = (id) => m.materiaisAExcluir.find((x) => x.id === id);
  el.querySelectorAll('[data-restaurar]').forEach((b) =>
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await atualizar('Materiais', b.dataset.restaurar, { status: '' });
        aviso('Material restaurado.');
      } catch (e) {
        b.disabled = false;
        aviso(e.message);
      }
    })
  );
  el.querySelectorAll('[data-excluir-vez]').forEach((b) =>
    b.addEventListener('click', async () => {
      const x = achar(b.dataset.excluirVez);
      if (!confirm(`Excluir de vez “${x.titulo}”?${x.driveId ? ' O arquivo vai para a lixeira do Drive.' : ''}`)) return;
      b.disabled = true;
      await excluirDeVez(m, [x]);
    })
  );
  el.querySelector('[data-excluir-todos]')?.addEventListener('click', async (e) => {
    const itens = m.materiaisAExcluir.filter((x) => !estado.cadeira || x.cadeiraId === estado.cadeira);
    if (!confirm(`Excluir de vez ${itens.length} materiais? Os arquivos vão para a lixeira do Drive.`)) return;
    e.currentTarget.disabled = true;
    await excluirDeVez(m, itens);
  });
}
