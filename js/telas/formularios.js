// Formulários de cadastro ("+ Registrar"). Com login gravam na planilha;
// no modo simulação ficam só nesta aba (somem ao recarregar).

import { abrirFormulario } from '../ui/formulario.js';
import { aviso } from '../ui/componentes.js';
import { adicionar, atualizar, emSimulacao, novoId } from '../dados/dataSource.js';
import { assuntosDaCadeira } from '../regras/dominio.js';

const onde = () => (emSimulacao() ? 'só nesta sessão (simulação)' : 'na planilha');
const salvo = (o) => aviso(`${o} salvo ${onde()}.`);

/** Opções de cadeira agrupadas: módulos (para provas integradas) e cadeiras. */
export function opcoesCadeira(m, { incluirModulos = false, vazio = false, textoVazio = '— nenhuma —' } = {}) {
  const ops = vazio ? [{ valor: '', texto: textoVazio }] : [];
  for (const mod of m.modulos) {
    if (incluirModulos) ops.push({ valor: mod.id, texto: `${mod.nome} (módulo inteiro)` });
    for (const c of m.cadeiras.filter((x) => x.moduloId === mod.id)) ops.push({ valor: c.id, texto: c.nome });
  }
  return ops;
}

const campoCadeira = (m, valor, extra = {}) => ({
  nome: 'cadeira_id', rotulo: 'Cadeira', tipo: 'select', opcoes: opcoesCadeira(m, extra), valor, obrigatorio: !extra.vazio,
});
const campoAssunto = (m, valor, obrigatorio = false) => ({
  nome: 'assunto', rotulo: 'Assunto', valor, largo: true, obrigatorio, dependeDe: 'cadeira_id',
  sugestoes: (cad) => (cad ? assuntosDaCadeira(m, cad) : []), dica: 'Comece a digitar: aparecem os assuntos das aulas.',
});
const ops = (lista) => lista.map((x) => ({ valor: x, texto: x }));

export function novaAvaliacao(m, { cadeiraId = '' } = {}) {
  abrirFormulario({
    titulo: 'Nova avaliação',
    campos: [
      { nome: 'titulo', rotulo: 'Título', obrigatorio: true, largo: true, dica: 'Ex.: 1º Trabalho oral de Bioquímica' },
      campoCadeira(m, cadeiraId, { incluirModulos: true }),
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: ops(m.config.tiposAvaliacao), valor: m.config.tiposAvaliacao[0], obrigatorio: true },
      { nome: 'data', rotulo: 'Data', tipo: 'date', obrigatorio: true },
      { nome: 'hora', rotulo: 'Início', tipo: 'time' },
      { nome: 'fim', rotulo: 'Fim', tipo: 'time' },
      { nome: 'local', rotulo: 'Local' },
      { nome: 'conteudo', rotulo: 'Conteúdo', tipo: 'textarea', largo: true, dica: 'Assuntos separados por ponto e vírgula' },
      { nome: 'obs', rotulo: 'Observação', largo: true },
    ],
    aoSalvar: async (v) => {
      await adicionar('Avaliacoes', { id: novoId('AV'), turma: 'Todas', ...v });
      salvo('Avaliação');
    },
  });
}

export function novoEstudo(m, { data = m.hoje, cadeiraId = '', assunto = '', atividade = '' } = {}) {
  abrirFormulario({
    titulo: 'Marcar estudo',
    campos: [
      { nome: 'atividade', rotulo: 'O que vou fazer', obrigatorio: true, largo: true, valor: atividade, dica: 'Ex.: Revisão D+1 com flashcards',
        sugestoes: ['Assistir à aula / ver material', 'Resumo ativo', 'Infográfico', 'Conversar com tutor (IA)', 'Elaborar dúvidas', 'Criar flashcards', 'Resolver questões', 'Estudar como cai na prova', 'Revisão'] },
      { nome: 'data', rotulo: 'Data', tipo: 'date', valor: data, obrigatorio: true },
      { nome: 'inicio', rotulo: 'Início', tipo: 'time' },
      { nome: 'fim', rotulo: 'Fim', tipo: 'time' },
      campoCadeira(m, cadeiraId, { vazio: true, textoVazio: 'Pessoal / sem cadeira' }),
      campoAssunto(m, assunto),
    ],
    aoSalvar: async (v) => {
      await adicionar('Estudos', { id: novoId('E'), feito: false, ...v });
      salvo('Estudo');
    },
  });
}

export function novaPendencia(m, { cadeiraId = '' } = {}) {
  abrirFormulario({
    titulo: 'Nova pendência',
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', obrigatorio: true, largo: true },
      { nome: 'prazo', rotulo: 'Prazo', tipo: 'date' },
      { nome: 'prioridade', rotulo: 'Prioridade', tipo: 'radios', opcoes: ops(['Alta', 'Média', 'Baixa']), valor: 'Média' },
      campoCadeira(m, cadeiraId, { vazio: true }),
    ],
    aoSalvar: async (v) => {
      await adicionar('Pendencias', { id: novoId('P'), status: 'Aberta', ...v });
      salvo('Pendência');
    },
  });
}

export function novaDuvida(m, { cadeiraId = '', assunto = '' } = {}) {
  abrirFormulario({
    titulo: 'Nova dúvida',
    intro: 'Escreva a pergunta agora. A tentativa de resposta e a resposta conferida podem ficar para depois.',
    campos: [
      { nome: 'pergunta', rotulo: 'Pergunta', tipo: 'textarea', obrigatorio: true, largo: true },
      campoCadeira(m, cadeiraId, { vazio: true, textoVazio: '— escolha —' }),
      campoAssunto(m, assunto),
      { nome: 'motivo', rotulo: 'Motivo', tipo: 'select', opcoes: [{ valor: '', texto: '—' }, ...ops(m.config.motivosDuvida)] },
      { nome: 'tentativa', rotulo: 'Minha tentativa (sem consultar)', tipo: 'textarea', largo: true },
    ],
    aoSalvar: async (v) => {
      await adicionar('Duvidas', { id: novoId('D'), criada: m.hoje, status: 'Aberta', ...v });
      salvo('Dúvida');
    },
  });
}

export function responderDuvida(m, d) {
  abrirFormulario({
    titulo: 'Responder dúvida',
    intro: d.pergunta,
    campos: [
      { nome: 'tentativa', rotulo: 'Minha tentativa (sem consultar)', tipo: 'textarea', valor: d.tentativa, largo: true },
      { nome: 'resposta', rotulo: 'Resposta conferida', tipo: 'textarea', valor: d.resposta, largo: true, linhas: 5 },
      { nome: 'fonte', rotulo: 'Fonte (livro, página, artigo)', valor: d.fonte, largo: true },
      { nome: 'link', rotulo: 'Link (IA, vídeo, artigo, imagem)', tipo: 'url', valor: d.link, largo: true },
      { nome: 'status', rotulo: 'Situação', tipo: 'radios', opcoes: ops(['Aberta', 'Sanada']), valor: d.sanada ? 'Sanada' : 'Aberta' },
    ],
    aoSalvar: async (v) => {
      const mudou = { ...v, sanada_em: v.status === 'Sanada' ? d.sanadaEm || m.hoje : '' };
      await atualizar('Duvidas', d.id, mudou);
      salvo('Dúvida');
    },
  });
}

export function novaQuestao(m, { cadeiraId = '', assunto = '', fonte = '' } = {}) {
  abrirFormulario({
    titulo: 'Registrar questão',
    campos: [
      { nome: 'resultado', rotulo: 'Resultado', tipo: 'radios', opcoes: ops(['Acertou', 'Errou', 'Chutou']), obrigatorio: true, largo: true },
      { nome: 'confianca', rotulo: 'Confiança', tipo: 'radios', opcoes: [1, 2, 3, 4, 5].map((n) => ({ valor: String(n), texto: String(n) })), valor: '3', largo: true,
        dica: 'Chute com confiança 1–2 conta como erro; com 4–5 conta acerto, mas pede aprofundamento.' },
      campoCadeira(m, cadeiraId),
      campoAssunto(m, assunto, true),
      { nome: 'motivos', rotulo: 'Motivos', tipo: 'checks', opcoes: ops(m.config.motivosQuestao), largo: true },
      { nome: 'fonte', rotulo: 'Fonte', valor: fonte, dica: 'Ex.: Caderno GoodNotes, PI 2025.1 Q12' },
      { nome: 'data', rotulo: 'Data', tipo: 'date', valor: m.hoje, obrigatorio: true },
      { nome: 'obs', rotulo: 'Observação', largo: true },
    ],
    textoBotao: 'Registrar',
    aoSalvar: async (v) => {
      await adicionar('Questoes', { id: novoId('Q'), ...v });
      salvo('Questão');
    },
  });
}

export function novoMaterial(m, { cadeiraId = '', assunto = '' } = {}) {
  const tipos = m.config.tiposMaterial.map((t) => t.nome);
  abrirFormulario({
    titulo: 'Adicionar material (link)',
    intro: 'Cole o link do arquivo no Drive (ou outro endereço). O envio de arquivos direto para o Drive ainda não está ligado.',
    campos: [
      { nome: 'titulo', rotulo: 'Título', obrigatorio: true, largo: true },
      { nome: 'link', rotulo: 'Link', tipo: 'url', largo: true, placeholder: 'https://drive.google.com/…' },
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: ops(tipos), valor: tipos[0] },
      { nome: 'origem', rotulo: 'Origem', tipo: 'select', opcoes: ops(m.config.origensMaterial), valor: 'Minha' },
      campoCadeira(m, cadeiraId),
      campoAssunto(m, assunto),
      { nome: 'obs', rotulo: 'Observação', largo: true },
    ],
    aoSalvar: async (v) => {
      await adicionar('Materiais', { id: novoId('M'), criado: m.hoje, copiado: v.origem === 'Turma' ? 'FALSE' : '', ...v });
      salvo('Material');
    },
  });
}

export function novoCartao(m, { cadeiraId = '', assunto = '', frente = '', verso = '', fonte = '' } = {}) {
  abrirFormulario({
    titulo: 'Novo cartão (Método Catarina)',
    intro: 'Uma pergunta por cartão. Cartões que você escreve contam como validados e entram primeiro.',
    campos: [
      { nome: 'frente', rotulo: 'Frente (pergunta)', tipo: 'textarea', obrigatorio: true, largo: true, valor: frente },
      { nome: 'verso', rotulo: 'Verso (resposta)', tipo: 'textarea', obrigatorio: true, largo: true, valor: verso },
      campoCadeira(m, cadeiraId),
      campoAssunto(m, assunto),
      { nome: 'fonte', rotulo: 'Fonte', largo: true, valor: fonte },
    ],
    aoSalvar: async (v) => {
      await adicionar('Cartoes', { id: novoId('C'), criado: m.hoje, origem: 'Validado', vence: m.hoje, revisoes: 0, lapsos: 0, ...v });
      salvo('Cartão');
    },
  });
}

export function novaNota(m, { cadeiraId = '', avaliacao = null, nota = null } = {}) {
  const editar = Boolean(nota);
  abrirFormulario({
    titulo: editar ? 'Editar nota' : '+ Avaliação na calculadora',
    intro: 'Peso em branco = vale (soma de pontos). Para média simples, deixe tudo valendo 10.',
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true, largo: true, valor: nota?.nome ?? avaliacao?.titulo ?? '' },
      campoCadeira(m, nota?.cadeiraId ?? avaliacao?.cadeiraId ?? cadeiraId, { incluirModulos: true }),
      { nome: 'vale', rotulo: 'Vale (pontos)', tipo: 'number', valor: nota?.vale ?? 10, obrigatorio: true, min: 0 },
      { nome: 'peso', rotulo: 'Peso', tipo: 'number', valor: nota && nota.peso !== nota.vale ? nota.peso : '', min: 0 },
      { nome: 'nota', rotulo: 'Nota tirada', tipo: 'number', valor: nota?.nota ?? '', min: 0, dica: 'Em branco = ainda não saiu' },
      { nome: 'bonus', rotulo: 'É nota extra / bônus?', tipo: 'radios', opcoes: ops(['Não', 'Sim']), valor: nota?.bonus ? 'Sim' : 'Não' },
      { nome: 'obs', rotulo: 'Observação', largo: true, valor: nota?.obs ?? '' },
    ],
    aoSalvar: async (v) => {
      const linha = { ...v, bonus: v.bonus === 'Sim' ? 'sim' : '', vale: v.vale.replace(',', '.'), peso: v.peso.replace(',', '.'), nota: v.nota.replace(',', '.') };
      if (editar) await atualizar('Notas', nota.id, linha);
      else await adicionar('Notas', { id: novoId('N'), avaliacao_id: avaliacao?.id ?? '', ...linha });
      salvo('Nota');
    },
  });
}

/** Menu do botão "+ Registrar" (topo) — o contexto pré-preenche cadeira/assunto. */
export const REGISTROS = [
  { tipo: 'duvida', nome: 'Dúvida', icone: 'duvidas', abrir: novaDuvida },
  { tipo: 'questao', nome: 'Questão', icone: 'questoes', abrir: novaQuestao },
  { tipo: 'estudo', nome: 'Estudo', icone: 'estudo', abrir: novoEstudo },
  { tipo: 'cartao', nome: 'Cartão', icone: 'flashcard', abrir: novoCartao },
  { tipo: 'material', nome: 'Material', icone: 'materiais', abrir: novoMaterial },
  { tipo: 'avaliacao', nome: 'Avaliação', icone: 'avaliacoes', abrir: novaAvaliacao },
  { tipo: 'pendencia', nome: 'Pendência', icone: 'pendencias', abrir: novaPendencia },
];
