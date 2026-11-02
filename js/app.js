// Código M — inicialização, menu lateral e navegação entre telas.

import { carregar, emSimulacao } from './dados/dataSource.js';
import { icone } from './ui/icones.js';
import { esc } from './util/texto.js';
import { formatoLongo, paraISO } from './util/datas.js';
import * as inicio from './telas/inicio.js';
import * as calendario from './telas/calendario.js';
import * as cadeiras from './telas/cadeiras.js';
import * as emBreve from './telas/emBreve.js';

// Itens do menu. "tela" ausente = mostra "em breve".
const MENU = [
  { rota: 'inicio', nome: 'Início', icone: 'inicio', tela: inicio },
  { rota: 'calendario', nome: 'Calendário', icone: 'calendario', tela: calendario },
  { rota: 'cadeiras', nome: 'Cadeiras', icone: 'cadeiras', tela: cadeiras },
  { rota: 'materiais', nome: 'Materiais', icone: 'materiais', resumo: 'Slides, resumos, mapas e flashcards de cada aula, organizados no seu Google Drive com o padrão de nome do Código M.' },
  { rota: 'duvidas', nome: 'Dúvidas', icone: 'duvidas', resumo: 'Registre dúvidas por aula e motivo, e acompanhe até resolver.' },
  { rota: 'metodo', nome: 'Método Catarina', icone: 'metodo', resumo: 'Seu passo a passo de estudo, com revisões espaçadas e checklists.' },
  { rota: 'questoes', nome: 'Questões', icone: 'questoes', resumo: 'Banco de questões por cadeira e assunto, com controle de acertos e erros.' },
  { rota: 'avaliacoes', nome: 'Avaliações e notas', icone: 'avaliacoes', resumo: 'Notas lançadas e médias calculadas pelas fórmulas da aba Config.' },
  { rota: 'pendencias', nome: 'Pendências', icone: 'pendencias', resumo: 'Lista completa de pendências, com prazos e prioridades.' },
  { rota: 'configuracoes', nome: 'Configurações', icone: 'configuracoes', resumo: 'Login Google, planilha conectada e preferências.' },
];

const elTela = document.getElementById('tela');
const elMenu = document.getElementById('menu');
let modelo;

function montarMenu() {
  const item = (i) => `
      <li><a href="#/${i.rota}" data-rota="${i.rota}" class="${i.tela ? '' : 'breve'}" ${i.tela ? '' : 'title="Em breve"'}>
        ${icone(i.icone)}<span>${esc(i.nome)}</span>
      </a></li>`;
  elMenu.innerHTML = `
    <ul>${MENU.filter((i) => i.tela).map(item).join('')}</ul>
    <p class="menu-secao">Em breve</p>
    <ul>${MENU.filter((i) => !i.tela).map(item).join('')}</ul>`;

  document.getElementById('abrir-menu').innerHTML = icone('menu');
  document.getElementById('abrir-menu').addEventListener('click', () => document.body.classList.add('menu-aberto'));
  document.getElementById('fundo-menu').addEventListener('click', () => document.body.classList.remove('menu-aberto'));
}

function montarAvisos() {
  const forcado = modelo.hoje !== paraISO(new Date());
  document.getElementById('lateral-rodape').innerHTML = `
    <p class="rodape-periodo">${esc(modelo.config.periodo)} · ${esc(modelo.config.semestre)} · Turma ${esc(modelo.config.turma)}</p>
    <p class="rodape-hoje">${forcado ? 'Data simulada: ' : 'Hoje: '}${esc(formatoLongo(modelo.hoje))}</p>`;

  if (emSimulacao()) {
    const faixa = document.getElementById('faixa-simulacao');
    faixa.hidden = false;
    faixa.innerHTML = `<b>Modo simulação</b> — dados de exemplo; nada é salvo. A planilha Google entra na próxima etapa.`;
  }
}

function navegar() {
  const [rota = 'inicio', ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const item = MENU.find((i) => i.rota === rota) ?? MENU[0];

  elMenu.querySelectorAll('a').forEach((a) => {
    const ativo = a.dataset.rota === item.rota;
    a.classList.toggle('ativo', ativo);
    if (ativo) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.body.classList.remove('menu-aberto');
  document.title = `${item.nome} · Código M`;

  try {
    (item.tela ?? emBreve).render(elTela, modelo, params, item);
  } catch (erro) {
    console.error(erro);
    elTela.innerHTML = `<div class="erro"><h1>Algo deu errado nesta tela</h1><p>${esc(erro.message)}</p></div>`;
  }
  window.scrollTo(0, 0);
}

async function iniciar() {
  montarMenu();
  try {
    modelo = await carregar();
  } catch (erro) {
    console.error(erro);
    elTela.innerHTML = `<div class="erro"><h1>Não foi possível carregar os dados</h1><p>${esc(erro.message)}</p></div>`;
    return;
  }
  montarAvisos();
  window.addEventListener('hashchange', navegar);
  navegar();
}

iniciar();
