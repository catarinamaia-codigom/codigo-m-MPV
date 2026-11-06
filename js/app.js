// Código M — inicialização, menu lateral, barra do topo e navegação.

import { carregar, emSimulacao, mensagemCarga, acabouDePreencher, linkPlanilha } from './dados/dataSource.js';
import * as google from './dados/google.js';
import { aviso, abrirModal, fecharModal } from './ui/componentes.js';
import { adicionar, novoId } from './dados/dataSource.js';
import { icone } from './ui/icones.js';
import { esc } from './util/texto.js';
import { formatoLongo, paraISO } from './util/datas.js';
import { nomeCadeira, pendenciasAbertas } from './dados/consultas.js';
import { cartoesVencidos } from './telas/metodo.js';
import { REGISTROS } from './telas/formularios.js';
import { papelAtual } from './dados/arquivos.js';
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

// ?demo no endereço abre a demonstração (dados de exemplo, nada é salvo)
const DEMO = new URLSearchParams(location.search).has('demo');
const elCapa = document.getElementById('capa');
let comecou = false;
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

/** Convidadas: leitura não registra nada; colaboradora só envia materiais. */
function aplicarPapel() {
  const p = DEMO ? 'dona' : papelAtual(modelo).papel;
  document.body.dataset.papel = p;
  document.querySelectorAll('#registrar-menu [data-registro]').forEach((b) => (b.hidden = p === 'colaboradora' && b.dataset.registro !== 'material'));
}

function montarAvisos() {
  aplicarPapel();
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
    if (DEMO) {
      await recarregar();
      return;
    }
    mostrarCapa('Você saiu.');
  });

  const faixa = document.getElementById('faixa-simulacao');
  const problema = mensagemCarga();
  faixa.hidden = !problema && !(simulacao && DEMO);
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

/** Volta para a capa e avisa, no meio da tela, que é preciso entrar de novo. */
function encerrarSessao() {
  google.sair({ revogar: false });
  mostrarCapa();
  abrirModal('Sessão encerrada', `
    <div class="sessao-fim">
      <p>Por inatividade, você precisa entrar novamente.</p>
      <button class="btn btn-principal capa-entrar" data-reentrar>${icone('pessoa')} Entrar com Google</button>
    </div>`);
  document.querySelector('[data-reentrar]').addEventListener('click', () => {
    fecharModal();
    entrarComGoogle();
  });
}

// Uso do site mantém a sessão e renova o acesso do Google; 3 h parado = sai.
['pointerdown', 'keydown'].forEach((ev) =>
  document.addEventListener(ev, () => {
    if (!google.conectado()) return;
    google.registrarAtividade();
    google.renovarNoGesto();
  }, true)
);
setInterval(() => {
  if (DEMO || !comecou || !elCapa.hidden) return;
  if (google.inativo() || !google.conectado()) encerrarSessao();
}, 30_000);

/** Caixinha fixa de ideias: vira pendência para decidir depois. */
function montarIdeias() {
  const caixa = document.createElement('aside');
  caixa.className = 'ideias';
  caixa.innerHTML = `
    <button class="ideias-botao" aria-expanded="false" aria-controls="ideias-painel" title="Anotar ideia de melhoria">${icone('lampada')}<span>Ideia</span></button>
    <form class="ideias-painel" id="ideias-painel" hidden>
      <label for="ideias-texto">Ideia ou melhoria para o Código M</label>
      <textarea id="ideias-texto" rows="3" placeholder="Escreva rápido para não perder…" required></textarea>
      <div class="ideias-acoes"><span class="meta">Vai para Pendências › Ideias</span><button class="btn btn-principal" type="submit">Guardar</button></div>
    </form>`;
  document.body.appendChild(caixa);
  const botao = caixa.querySelector('.ideias-botao');
  const painel = caixa.querySelector('form');
  const texto = caixa.querySelector('textarea');
  botao.addEventListener('click', () => {
    painel.hidden = !painel.hidden;
    botao.setAttribute('aria-expanded', String(!painel.hidden));
    if (!painel.hidden) texto.focus();
  });
  texto.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) painel.requestSubmit();
    if (e.key === 'Escape') botao.click();
  });
  painel.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ideia = texto.value.trim();
    if (!ideia) return;
    const tela = document.getElementById('trilha').textContent.replace(/\s+/g, ' ').trim();
    try {
      await adicionar('Pendencias', { id: novoId('IDEIA'), descricao: `Ideia: ${ideia}${tela ? ` (tela: ${tela})` : ''}`, cadeira_id: '', prazo: '', status: 'Aberta', prioridade: 'Baixa' });
      texto.value = '';
      botao.click();
      aviso('Ideia guardada em Pendências › Ideias.');
    } catch (erro) {
      aviso(erro.message);
    }
  });
}

/** Capa: primeira tela, pede o login com o Google. */
function mostrarCapa(mensagem = '') {
  document.body.classList.add('na-capa');
  elCapa.hidden = false;
  const h = new Date().getHours();
  elCapa.innerHTML = `
    <div class="capa-cartao">
      <span class="capa-marca">M</span>
      <h1>Código <b>M</b></h1>
      <p class="capa-sub">Seu estúdio de Medicina</p>
      <p class="capa-texto">${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}. Entre com a sua conta Google para abrir suas aulas, dúvidas, revisões e materiais.</p>
      ${mensagem ? `<p class="capa-aviso">${esc(mensagem)}</p>` : ''}
      <button class="btn btn-principal capa-entrar" id="capa-entrar">${icone('pessoa')} Entrar com Google</button>
      <p class="capa-nota">Seus dados ficam na sua planilha e no seu Drive. O login vale nesta aba do navegador.</p>
    </div>`;
  document.getElementById('capa-entrar').addEventListener('click', entrarComGoogle);
  google.prepararLogin().catch(() => {});
}

function esconderCapa() {
  document.body.classList.remove('na-capa');
  elCapa.hidden = true;
  elCapa.innerHTML = '';
}

async function entrarComGoogle() {
  try {
    await google.entrar();
  } catch (erro) {
    aviso(erro.message);
    return;
  }
  esconderCapa();
  elTela.innerHTML = '<p class="carregando">Abrindo sua planilha…</p>';
  if (!comecou) await comecar();
  else await recarregar();
  if (emSimulacao()) return; // a capa já voltou com o motivo
  if (acabouDePreencher()) aviso('Planilha preparada e preenchida com o horário do 1M.');
  else aviso('Planilha conectada.');
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
  if (emSimulacao() && !DEMO) {
    encerrarSessao();
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

async function comecar() {
  comecou = true;
  try {
    modelo = await carregar();
  } catch (erro) {
    console.error(erro);
    elTela.innerHTML = `<div class="erro"><h1>Não foi possível carregar os dados</h1><p>${esc(erro.message)}</p></div>`;
    return;
  }
  if (emSimulacao() && !DEMO) {
    google.sair({ revogar: false });
    mostrarCapa(mensagemCarga() || 'Entre com Google para continuar.');
    comecou = false;
    return;
  }
  montarAvisos();
  if (!document.querySelector('.ideias')) montarIdeias();
  // Conta os passos para o botão Voltar saber se há para onde voltar
  history.replaceState({ passo: 0 }, '');
  window.addEventListener('popstate', (e) => (profundidade = e.state?.passo ?? Math.max(0, profundidade - 1)));
  window.addEventListener('hashchange', () => {
    if (!history.state || history.state.passo === undefined) {
      profundidade += 1;
      history.replaceState({ passo: profundidade }, '');
    }
    if (modelo) navegar();
  });
  // Depois de salvar algo, relê os dados sem pular para o topo
  window.addEventListener('codigom:dados-mudaram', () => recarregar({ rolarTopo: false }));
  navegar();
  google.prepararLogin().catch(() => {});
}

function iniciar() {
  montarBarra();
  if (!DEMO && !google.conectado()) {
    mostrarCapa();
    return;
  }
  if (google.conectado()) elTela.innerHTML = '<p class="carregando">Abrindo sua planilha…</p>';
  comecar();
}

iniciar();
