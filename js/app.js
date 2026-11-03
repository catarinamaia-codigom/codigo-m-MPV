// Código M — inicialização, menu lateral e navegação entre telas.

import { carregar, emSimulacao, mensagemCarga, acabouDePreencher, linkPlanilha } from './dados/dataSource.js';
import * as google from './dados/google.js';
import { aviso } from './ui/componentes.js';
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
  const simulacao = emSimulacao();
  const conta = google.configurado()
    ? simulacao
      ? `<button class="btn btn-google" id="entrar">${icone('pessoa')} Entrar com Google</button>`
      : `<p class="rodape-conectada">${icone('checkCirculo', 'ic-mini')} Planilha conectada</p>
         <p class="rodape-links"><a href="${esc(linkPlanilha())}" target="_blank" rel="noopener">Abrir planilha ${icone('externo', 'ic-mini')}</a>
         · <button class="link-botao" id="sair">Sair</button></p>`
    : '';
  document.getElementById('lateral-rodape').innerHTML = `
    ${conta}
    <p class="rodape-periodo">${esc(modelo.config.periodo)} · ${esc(modelo.config.semestre)} · Turma ${esc(modelo.config.turma)}</p>
    <p class="rodape-hoje">${forcado ? 'Data simulada: ' : 'Hoje: '}${esc(formatoLongo(modelo.hoje))}</p>`;

  document.getElementById('entrar')?.addEventListener('click', entrarComGoogle);
  document.getElementById('sair')?.addEventListener('click', async () => {
    google.sair();
    await recarregar();
    aviso('Você saiu. Mostrando o modo simulação.');
  });

  const faixa = document.getElementById('faixa-simulacao');
  const problema = mensagemCarga();
  faixa.hidden = !simulacao && !problema;
  faixa.classList.toggle('faixa-erro', Boolean(problema));
  if (problema) {
    faixa.innerHTML = `<b>Não consegui abrir a planilha:</b> ${esc(problema)} Mostrando o modo simulação.`;
  } else if (simulacao) {
    faixa.innerHTML = google.configurado()
      ? `<b>Modo simulação</b>: cópia do horário, nada é salvo. <button class="link-botao" data-entrar>Entre com Google</button> para usar sua planilha.`
      : `<b>Modo simulação</b>: horário real do 1M; estudos e pendências são exemplos. Nada é salvo ainda.`;
    faixa.querySelector('[data-entrar]')?.addEventListener('click', entrarComGoogle);
  }
}

async function entrarComGoogle() {
  try {
    await google.entrar();
  } catch (erro) {
    aviso(erro.message);
    return;
  }
  elTela.innerHTML = '<p class="carregando">Abrindo sua planilha…</p>';
  await recarregar();
  if (acabouDePreencher()) aviso('Planilha preparada e preenchida com o horário do 1M.');
  else if (!emSimulacao()) aviso('Planilha conectada.');
}

/** Lê os dados de novo (da planilha ou do JSON) e redesenha a tela atual. */
async function recarregar({ rolarTopo = true } = {}) {
  try {
    modelo = await carregar();
  } catch (erro) {
    console.error(erro);
    aviso(`Erro ao carregar os dados: ${erro.message}`);
    return;
  }
  montarAvisos();
  navegar({ rolarTopo });
}

function navegar({ rolarTopo = true } = {}) {
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
  if (rolarTopo) window.scrollTo(0, 0);
}

async function iniciar() {
  montarMenu();
  if (google.conectado()) elTela.innerHTML = '<p class="carregando">Abrindo sua planilha…</p>';
  try {
    modelo = await carregar();
  } catch (erro) {
    console.error(erro);
    elTela.innerHTML = `<div class="erro"><h1>Não foi possível carregar os dados</h1><p>${esc(erro.message)}</p></div>`;
    return;
  }
  montarAvisos();
  window.addEventListener('hashchange', () => navegar());
  // Depois de salvar algo na planilha, relê os dados sem pular para o topo
  window.addEventListener('codigom:dados-mudaram', () => recarregar({ rolarTopo: false }));
  navegar();
  google.prepararLogin().catch(() => {}); // deixa o popup de login pronto
}

iniciar();
