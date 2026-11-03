// Login Google feito no próprio navegador (Google Identity Services).
// O token vale ~1 hora e fica só nesta aba do navegador (sessionStorage);
// os dados em si ficam na planilha, nunca no navegador.

import { GOOGLE } from '../config.js';

const CHAVE = 'codigom.google.token';
let token = null;
let expira = 0;
let cliente = null;
let scriptCarregado = null;

try {
  const salvo = JSON.parse(sessionStorage.getItem(CHAVE) || 'null');
  if (salvo && salvo.expira > Date.now()) ({ token, expira } = salvo);
} catch {
  /* sem armazenamento: só pede login de novo */
}

export const configurado = () => Boolean(GOOGLE.clientId && GOOGLE.planilhaId);
export const conectado = () => Boolean(token) && Date.now() < expira - 60_000;
export const tokenAtual = () => (conectado() ? token : null);

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

/** Abre o popup de login do Google. Resolve quando houver token. */
export async function entrar() {
  await prepararLogin();
  return new Promise((ok, erro) => {
    cliente ??= window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE.clientId,
      scope: GOOGLE.escopos,
      callback: () => {},
    });
    cliente.callback = (r) => {
      if (r.error) return erro(new Error(`Login não concluído (${r.error}).`));
      if (!window.google.accounts.oauth2.hasGrantedAllScopes(r, GOOGLE.escopos)) {
        return erro(new Error('Para usar a planilha, marque a permissão de ver e editar planilhas no login.'));
      }
      token = r.access_token;
      expira = Date.now() + Number(r.expires_in || 3600) * 1000;
      try {
        sessionStorage.setItem(CHAVE, JSON.stringify({ token, expira }));
      } catch {
        /* tudo bem */
      }
      ok(token);
    };
    cliente.error_callback = (e) =>
      erro(new Error(e?.type === 'popup_closed' ? 'A janela de login foi fechada.' : 'O navegador bloqueou a janela de login.'));
    cliente.requestAccessToken({ prompt: '' });
  });
}

export function sair() {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token, () => {});
  token = null;
  expira = 0;
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    /* tudo bem */
  }
}
