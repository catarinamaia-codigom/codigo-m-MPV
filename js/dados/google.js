// Login Google feito no próprio navegador (Google Identity Services).
// O token vale ~1 hora e fica só nesta aba do navegador (sessionStorage);
// os dados em si ficam na planilha, nunca no navegador.

import { GOOGLE } from '../config.js';

const CHAVE = 'codigom.google.token';
let token = null;
let expira = 0;
let comDrive = false;
let email = '';
let cliente = null;
let renovando = false;
// Sessão: fica conectada enquanto houver uso; 3 horas sem mexer = sai.
export const LIMITE_INATIVIDADE = 3 * 60 * 60 * 1000;
const CHAVE_ATIVIDADE = 'codigom.atividade';
let ultimaAtividade = Date.now();
try {
  ultimaAtividade = Number(sessionStorage.getItem(CHAVE_ATIVIDADE)) || Date.now();
} catch {
  /* sem armazenamento */
}
let scriptCarregado = null;

try {
  const salvo = JSON.parse(sessionStorage.getItem(CHAVE) || 'null');
  if (salvo && salvo.expira > Date.now()) ({ token, expira, comDrive = false, email = '' } = salvo);
} catch {
  /* sem armazenamento: só pede login de novo */
}

export const configurado = () => Boolean(GOOGLE.clientId && GOOGLE.planilhaId);
export const conectado = () => Boolean(token) && Date.now() < expira - 60_000;
export const tokenAtual = () => (conectado() ? token : null);
/** true se o login deu a permissão do Drive (criar pastas e guardar arquivos). */
export const temDrive = () => conectado() && comDrive;
/** E-mail da conta que entrou (minúsculas). */
export const emailAtual = () => (conectado() ? email : '');

async function buscarEmail() {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) email = String((await r.json()).email || '').toLowerCase();
  } catch {
    /* sem e-mail: trata como dona */
  }
}

/** Carrega o script do Google (chamado cedo, para o botão abrir o popup na hora). */
export function prepararLogin() {
  if (!configurado()) return Promise.resolve();
  scriptCarregado ??= new Promise((ok, erro) => {
    if (window.google?.accounts?.oauth2) return ok();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => erro(new Error('Não foi possível carregar o login do Google. Verifique a internet.'));
    document.head.appendChild(s);
  });
  return scriptCarregado;
}

function guardar() {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify({ token, expira, comDrive, email }));
  } catch {
    /* tudo bem */
  }
}

function criarCliente() {
  cliente ??= window.google.accounts.oauth2.initTokenClient({ client_id: GOOGLE.clientId, scope: GOOGLE.escopos, callback: () => {} });
  return cliente;
}

/** Registra uso do site (clique ou tecla). */
export function registrarAtividade() {
  ultimaAtividade = Date.now();
  try {
    sessionStorage.setItem(CHAVE_ATIVIDADE, String(ultimaAtividade));
  } catch {
    /* tudo bem */
  }
}

/** true se passou do limite sem uso. */
export const inativo = () => Date.now() - ultimaAtividade > LIMITE_INATIVIDADE;

/**
 * Renova o acesso (o Google dá 1 hora por vez) enquanto a pessoa usa o site.
 * Chamada dentro de um clique/tecla, para o navegador permitir a janelinha
 * do Google, que abre e fecha sozinha porque o consentimento já foi dado.
 */
export function renovarNoGesto() {
  if (!token || renovando || inativo() || !window.google?.accounts?.oauth2) return;
  if (expira - Date.now() > 15 * 60 * 1000) return;
  renovando = true;
  const c = criarCliente();
  c.callback = (r) => {
    renovando = false;
    if (r.error || !r.access_token) return;
    token = r.access_token;
    expira = Date.now() + Number(r.expires_in || 3600) * 1000;
    comDrive = window.google.accounts.oauth2.hasGrantedAllScopes(r, GOOGLE.escopoDrive);
    guardar();
  };
  c.error_callback = () => (renovando = false);
  c.requestAccessToken({ prompt: '' });
}

/** Abre o popup de login do Google. Resolve quando houver token. */
export async function entrar() {
  await prepararLogin();
  return new Promise((ok, erro) => {
    criarCliente();
    cliente.callback = (r) => {
      if (r.error) return erro(new Error(`Login não concluído (${r.error}).`));
      if (!window.google.accounts.oauth2.hasGrantedAllScopes(r, GOOGLE.escopoPlanilha)) {
        return erro(new Error('Para usar a planilha, marque a permissão de ver e editar planilhas no login.'));
      }
      token = r.access_token;
      expira = Date.now() + Number(r.expires_in || 3600) * 1000;
      comDrive = window.google.accounts.oauth2.hasGrantedAllScopes(r, GOOGLE.escopoDrive);
      buscarEmail().finally(() => {
        guardar();
        registrarAtividade();
        ok(token);
      });
    };
    cliente.error_callback = (e) =>
      erro(new Error(e?.type === 'popup_closed' ? 'A janela de login foi fechada.' : 'O navegador bloqueou a janela de login.'));
    cliente.requestAccessToken({ prompt: '' });
  });
}

/** Sai. revogar=true só no botão Sair (por inatividade, só esquece o acesso). */
export function sair({ revogar = true } = {}) {
  if (revogar && token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token, () => {});
  token = null;
  expira = 0;
  comDrive = false;
  email = '';
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    /* tudo bem */
  }
}
