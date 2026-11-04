// Código M — inicialização, menu lateral, barra do topo e navegação.

import { carregar, emSimulacao, mensagemCarga, acabouDePreencher, linkPlanilha } from './dados/dataSource.js';
import * as google from './dados/google.js';
import { aviso } from './ui/componentes.js';
import { icone } from './ui/icones.js';
import { esc } from './util/texto.js';
import { formatoLongo, paraISO } from './util/datas.js';
import { nomeCadeira, pendenciasAbertas } from './dados/consultas.js';
import { cartoesVencidos } from './telas/metodo.js';
import { REGISTROS } from './telas/formularios.js';
import * as inicio from './telas/inicio.js';
import * as calendario from './telas/calendario.js';
import * as cadeiras from './telas/cadeiras.js';
import * as duvidas from './telas/duvidas.js';
import * as questoes from './telas/questoes.js';
import * as metodo from './telas/metodo.js';
import * as materiais from './telas/materiais.js';
import * as notas from './telas/notas.js';
import * as pendencias from './telas/pendencias.js';
import * as configuracoes from './telas/configuracoes.js';
import * as busca from './telas/busca.js';

const MENU = [
  { grupo: 'Hoje' },
  { rota: 'inicio', nome: 'Início', icone: 'inicio', tela: inicio },
  { rota: 'calendario', nome: 'Calendário', icone: 'calendario', tela: calendario },
  { rota: 'pendencias', nome: 'Pendências', icone: 'pendencias', tela: pendencias, contador: (m) => pendenciasAbertas(m).length },
  { grupo: 'Estudo' },
  { rota: 'cadeiras', nome: 'Cadeiras', icone: 'cadeiras', tela: cadeiras },
  { rota: 'metodo', nome: 'Método Catarina', icone: 'metodo', tela: metodo, contador: (m) => cartoesVencidos(m).length },
  { rota: 'duvidas', nome: 'Dúvidas', icone: 'duvidas', tela: duvidas, contador: (m) => m.duvidas.filter((d) => !d.sanada).length },
  { rota: 'questoes', nome: 'Questões', icone: 'questoes', tela: questoes },
  { rota: 'materiais', nome: 'Materiais', icone: 'materiais', tela: materiais },
  { grupo: 'Notas' },
  { rota: 'avaliacoes', nome: 'Avaliações e notas', icone: 'avaliacoes', tela: notas },
  { rota: 'configuracoes', nome: 'Configurações', icone: 'configuracoes', tela: configuracoes, rodape: true },
];
const TELAS = MENU.filter((i) => i.rota);
const OCULTAS = { busca: { rota: 'busca', nome: 'Busca', icone: 'inicio', tela: busca } };

const elTela = document.getElementById('tela');
const elMenu = document.getElementById('menu');
let modelo;
let profundidade = 0; // quantos passos dá para voltar dentro do site
let contexto = {}; // cadeira/assunto da tela atual, usado no "+ Registrar"

function montarMenu() {
  const item = (i) => {
    const n = i.contador && modelo ? i.contador(modelo) : 0;
    return `<li><a href="#/${i.rota}" data-rota="${i.rota}">${icone(i.icone)}<span>${esc(i.nome)}</span>${n ? `<b class="contador">${n}</b>` : ''}</a></li>`;
  };
  let html = '';
  let aberto = false;
  for (const i of MENU.filter((x) => !x.rodape)) {
    if (i.grupo) {
      html += `${aberto ? '</ul>' : ''}<p class="menu-secao">${esc(i.grupo)}</p><ul>`;
      aberto = true;
    } else html += item(i);
  }
  html += `</ul><ul class="menu-rodape">${MENU.filter((x) => x.rodape).map(item).join('')}</ul>`;
  elMenu.innerHTML = html;
}

function montarBarra() {
  document.getElementById('abrir-menu').innerHTML = icone('menu');
  document.getElementById('abrir-menu').addEventListener('click', () => document.body.classList.add('menu-aberto'));
  document.getElementById('fundo-menu').addEventListener('click', () => document.body.classList.remove('menu-aberto'));

  const voltar = document.getElementById('voltar');
  voltar.innerHTML = `${icone('anterior', 'ic-mini')}<span>Voltar</span>`;
  voltar.addEventListener('click', () => {
    if (profundidade > 0) history.back();
    else location.hash = '#/inicio';
  });

  const btn = document.getElementById('registrar');
  const menu = document.getElementById('registrar-menu');
  btn.innerHTML = `<span aria-hidden="true">+</span> Registrar`;
  menu.innerHTML = REGISTROS.map((r) => `<button role="menuitem" data-registro="${r.tipo}">${icone(r.icone, 'ic-mini')}<span>${esc(r.nome)}</span></button>`).join('');
  const fechar = () => {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    btn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', fechar);
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-registro]');
    if (!b) return;
    fechar();
    REGISTROS.find((r) => r.tipo === b.dataset.registro).abrir(modelo, { ...contexto, data: modelo.hoje });
  });

  document.getElementById('busca').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = document.getElementById('busca-texto').value.trim();
    if (t) location.hash = `#/busca/${encodeURIComponent(t)}`;
  });
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
      ? `<b>Modo simulação</b>: dá para testar tudo, mas nada é salvo ao recarregar. <button class="link-botao" data-entrar>Entre com Google</button> para usar sua planilha.`
      : `<b>Modo simulação</b>: dá para testar tudo, mas nada é salvo ao recarregar.`;
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

function montarTrilha(item, params) {
  const partes = [`<a href="#/${item.rota}">${esc(item.nome)}</a>`];
  if (item.rota === 'cadeiras' && params[0]) {
    partes.push(params[1] ? `<a href="#/cadeiras/${encodeURIComponent(params[0])}">${esc(nomeCadeira(modelo, params[0]))}</a>` : `<span>${esc(nomeCadeira(modelo, params[0]))}</span>`);
    if (params[1]) partes.push(`<span>${esc(params[1])}</span>`);
  }
  if (item.rota === 'busca' && params[0]) partes.splice(0, 1, `<span>Busca: “${esc(params[0])}”</span>`);
  document.getElementById('trilha').innerHTML = partes.join(`<span class="sep">/</span>`);
}

function navegar({ rolarTopo = true } = {}) {
  const [rota = 'inicio', ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const item = TELAS.find((i) => i.rota === rota) ?? OCULTAS[rota] ?? TELAS[0];
  contexto = item.rota === 'cadeiras' && params[0] ? { cadeiraId: params[0], assunto: params[1] ?? '' } : {};

  montarMenu();
  elMenu.querySelectorAll('a').forEach((a) => {
    const ativo = a.dataset.rota === item.rota;
    a.classList.toggle('ativo', ativo);
    if (ativo) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.body.classList.remove('menu-aberto');
  document.title = `${item.nome} · Código M`;
  montarTrilha(item, params);
  document.getElementById('voltar').classList.toggle('inativo', profundidade === 0 && item.rota === 'inicio');
  if (item.rota !== 'busca') document.getElementById('busca-texto').value = '';

  try {
    item.tela.render(elTela, modelo, params, item);
  } catch (erro) {
    console.error(erro);
    elTela.innerHTML = `<div class="erro"><h1>Algo deu errado nesta tela</h1><p>${esc(erro.message)}</p></div>`;
  }
  if (rolarTopo) window.scrollTo(0, 0);
}

async function iniciar() {
  montarBarra();
  if (google.conectado()) elTela.innerHTML = '<p class="carregando">Abrindo sua planilha…</p>';
  try {
    modelo = await carregar();
  } catch (erro) {
    console.error(erro);
    elTela.innerHTML = `<div class="erro"><h1>Não foi possível carregar os dados</h1><p>${esc(erro.message)}</p></div>`;
    return;
  }
  montarAvisos();
  // Conta os passos para o botão Voltar saber se há para onde voltar
  history.replaceState({ passo: 0 }, '');
  window.addEventListener('popstate', (e) => (profundidade = e.state?.passo ?? Math.max(0, profundidade - 1)));
  window.addEventListener('hashchange', () => {
    if (!history.state || history.state.passo === undefined) {
      profundidade += 1;
      history.replaceState({ passo: profundidade }, '');
    }
    navegar();
  });
  // Depois de salvar algo, relê os dados sem pular para o topo
  window.addEventListener('codigom:dados-mudaram', () => recarregar({ rolarTopo: false }));
  navegar();
  google.prepararLogin().catch(() => {});
}

iniciar();
