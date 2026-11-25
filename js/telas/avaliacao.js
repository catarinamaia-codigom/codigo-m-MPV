// Painel de uma AVALIAÇÃO — funciona como um assunto: reúne os materiais
// anexados (que também aparecem no material geral da cadeira e, se ligados,
// nas aulas/assuntos) e as atividades de execução (escrever trabalho etc.).

import { esc, linkificar } from '../util/texto.js';
import { formatoLongo, diasEntre } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { abrirModal, vazio } from '../ui/componentes.js';
import { nomeCadeira } from '../dados/consultas.js';
import { linhaMaterial, ligarMateriais, materiaisDeAvaliacoes } from './materiais.js';
import { linhaEstudo, ligarEstudos } from './cadeiras.js';
import { editarAvaliacao, novoMaterial, novoEstudo } from './formularios.js';

const num = (v) => String(v).replace('.', ',');

export function abrirAvaliacao(m, a) {
  if (!a) return;
  const materiais = [...m.materiais.filter((x) => x.avaliacaoId === a.id), ...materiaisDeAvaliacoes(m).filter((x) => x.avaliacaoId === a.id)];
  const atividades = m.estudos.filter((e) => e.avaliacaoId === a.id);
  const n = diasEntre(m.hoje, a.data);
  const quando = `${formatoLongo(a.data)}${a.hora ? `, ${a.hora}${a.fim ? `–${a.fim}` : ''}` : ''}`;

  abrirModal(
    a.titulo,
    `<div class="av-painel">
      <p class="meta">${esc(nomeCadeira(m, a.cadeiraId))} · ${esc(a.tipo)} · ${esc(quando)}${a.local ? ` · ${esc(a.local)}` : ''}
        ${n >= 0 ? ` · <b>${n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`}</b>` : ''}</p>
      <p class="av-tags">
        ${a.vale !== null ? `<span class="tag">vale ${num(a.vale)}</span>` : ''}
        ${a.nota !== null ? `<span class="tag tag-ok">tirei ${num(a.nota)}</span>` : ''}
        ${a.entrega ? `<span class="tag ${a.entrega === 'Pendente' ? 'tag-alerta' : ''}">${esc(a.entrega)}</span>` : ''}</p>
      ${a.conteudo ? `<div class="av-bloco"><span class="rotulo-lado">Conteúdo</span><p>${linkificar(a.conteudo)}</p></div>` : ''}
      ${a.obs ? `<div class="av-bloco"><span class="rotulo-lado">Observação</span><p>${linkificar(a.obs)}</p></div>` : ''}

      <section class="av-secao">
        <header><h3>${icone('materiais', 'ic-mini')} Materiais da avaliação <small>${materiais.length}</small></h3>
          <button class="btn-mini" data-av-material>+ Material</button></header>
        ${materiais.length ? `<ul class="lista-materiais">${materiais.map((x) => linhaMaterial(m, x, { mostrarCadeira: false, mostrarAssunto: true })).join('')}</ul>`
          : vazio('Nada anexado. Os materiais daqui também aparecem no material geral da cadeira.')}
      </section>

      <section class="av-secao">
        <header><h3>${icone('trabalho', 'ic-mini')} Atividades <small>${atividades.length}</small></h3>
          <button class="btn-mini" data-av-atividade>+ Atividade</button></header>
        ${atividades.length ? `<ul class="lista-estudos">${atividades.map((e) => linhaEstudo(m, e, { mostrarCadeira: false })).join('')}</ul>`
          : vazio('Ex.: Escrevendo trabalho, Atividade extra.')}
      </section>

      <div class="formulario-acoes"><button class="btn btn-principal" data-av-editar>${icone('anotacao', 'ic-mini')} Editar avaliação (data, nota, entrega…)</button></div>
    </div>`
  );
  const painel = document.querySelector('.modal');
  painel.classList.add('modal-largo');
  ligarMateriais(painel, m);
  ligarEstudos(painel, m);
  painel.querySelector('[data-av-editar]').addEventListener('click', () => editarAvaliacao(m, a));
  painel.querySelector('[data-av-material]').addEventListener('click', () =>
    novoMaterial(m, { cadeiraId: a.cadeiraId, avaliacaoId: a.id, tipo: 'Trabalho da disciplina' })
  );
  painel.querySelector('[data-av-atividade]').addEventListener('click', () =>
    novoEstudo(m, { cadeiraId: a.cadeiraId, avaliacaoId: a.id, tipo: 'Escrevendo trabalho' })
  );
}
