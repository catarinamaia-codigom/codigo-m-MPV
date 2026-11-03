// Ligação com o Google. Estes valores não são segredos: o Client ID é
// público por natureza e a planilha só abre para quem tem acesso a ela.
export const GOOGLE = {
  // Google Cloud > Credenciais > ID do cliente OAuth (Aplicativo da Web)
  clientId: '942435104265-868tju9qfakp1fbhdb4j9ljd61beejvd.apps.googleusercontent.com',
  // Planilha "Código M - Dados" (Drive > Estudio-IA > 20-Medicina > Código M)
  planilhaId: '1GvvNTCEW-EBs0ViZJPJxZrvWPVik08xB4xARQN3JgAg',
  // Permissão pedida no login: ler e editar planilhas
  escopos: 'https://www.googleapis.com/auth/spreadsheets',
};
