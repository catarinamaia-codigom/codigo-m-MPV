// Ligação com o Google. Estes valores não são segredos: o Client ID é
// público por natureza e a planilha só abre para quem tem acesso a ela.
export const GOOGLE = {
  // Google Cloud > Credenciais > ID do cliente OAuth (Aplicativo da Web)
  clientId: '942435104265-868tju9qfakp1fbhdb4j9ljd61beejvd.apps.googleusercontent.com',
  // Planilha "Código M - Dados" (Drive > Estudio-IA > 20-Medicina > Código M)
  planilhaId: '1GvvNTCEW-EBs0ViZJPJxZrvWPVik08xB4xARQN3JgAg',
  // Permissões pedidas no login: planilhas (obrigatória) e Drive (para criar
  // pastas e guardar arquivos no lugar certo). A do Drive é opcional: sem ela
  // o site funciona, mas guarda só links.
  escopoPlanilha: 'https://www.googleapis.com/auth/spreadsheets',
  escopoDrive: 'https://www.googleapis.com/auth/drive',
  // Pastas do Estúdio IA no Drive (Meu Drive > Estudio-IA > 20-Medicina).
  // IDs não são segredos: só abrem para quem tem acesso.
  pastas: {
    medicina: '1pO7v9XIET7K9eKSQQ-1pH3lDfYgJ0aXg', // 20-Medicina
    conhecimento: '1TvtWESRwK3WOz2CjzZYpp22pm5MFKDrF', // 20-Medicina/Conhecimento
    periodos: '1Q2FFI57HqJ6bAxGdg37c2TZvXOC1O5RZ', // 20-Medicina/Periodos
    caixa: '17_NUvR4MrzjWHOpzvZNRY2hxBs7GfOgu', // 90-Entrada/Caixa
  },
};
// E-mail do login: identifica convidadas (leitura ou colaboradora)
GOOGLE.escopoEmail = 'https://www.googleapis.com/auth/userinfo.email';
GOOGLE.escopos = `${GOOGLE.escopoPlanilha} ${GOOGLE.escopoDrive} ${GOOGLE.escopoEmail}`;
