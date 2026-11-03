// Formulários de cadastro: "+ Avaliação", "+ Estudo" e "+ Pendência".
// Gravam direto na planilha (exigem login Google).

import { abrirFormulario } from '../ui/formulario.js';
import { aviso } from '../ui/componentes.js';
import { adicionar, emSimulacao, novoId } from '../dados/dataSource.js';

function podeGravar() {
  if (!emSimulacao()) return true;
  aviso('Entre com Google (no menu) para salvar na sua planilha.');
  return false;
}

/** Opções de cadeira agrupadas: módulos (para provas integradas) e cadeiras. */
function opcoesCadeira(m, { incluirModulos = false, vazio = false } = {}) {
  const ops = vazio ? [{ valor: '', texto: '— nenhuma —' }] : [];
  for (const mod of m.modulos) {
    if (incluirModulos) ops.push({ valor: mod.id, texto: `${mod.nome} (módulo inteiro)` });
    for (const c of m.cadeiras.filter((x) => x.moduloId === mod.id)) ops.push({ valor: c.id, texto: c.nome });
  }
  return ops;
}

export function novaAvaliacao(m, { cadeiraId = '' } = {}) {
  if (!podeGravar()) return;
  const tipos = m.config.tiposAvaliacao.map((t) => ({ valor: t, texto: t }));
  abrirFormulario({
    titulo: 'Nova avaliação',
    campos: [
      { nome: 'titulo', rotulo: 'Título', obrigatorio: true, largo: true, dica: 'Ex.: 1º Trabalho oral de Bioquímica' },
      { nome: 'cadeira_id', rotulo: 'Cadeira', tipo: 'select', opcoes: opcoesCadeira(m, { incluirModulos: true }), valor: cadeiraId, obrigatorio: true },
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: tipos, valor: tipos[0]?.valor, obrigatorio: true },
      { nome: 'data', rotulo: 'Data', tipo: 'date', obrigatorio: true },
      { nome: 'hora', rotulo: 'Início', tipo: 'time' },
      { nome: 'fim', rotulo: 'Fim', tipo: 'time' },
      { nome: 'local', rotulo: 'Local' },
      { nome: 'conteudo', rotulo: 'Conteúdo', tipo: 'textarea', largo: true, dica: 'Assuntos separados por ponto e vírgula' },
      { nome: 'obs', rotulo: 'Observação', largo: true },
    ],
    aoSalvar: async (v) => {
      await adicionar('Avaliacoes', { id: novoId('AV'), turma: 'Todas', ...v });
      aviso('Avaliação salva na planilha.');
    },
  });
}

export function novoEstudo(m, { data = m.hoje } = {}) {
  if (!podeGravar()) return;
  abrirFormulario({
    titulo: 'Marcar estudo',
    campos: [
      { nome: 'atividade', rotulo: 'O que vou fazer', obrigatorio: true, largo: true, dica: 'Ex.: Revisão D+1 com flashcards' },
      { nome: 'data', rotulo: 'Data', tipo: 'date', valor: data, obrigatorio: true },
      { nome: 'inicio', rotulo: 'Início', tipo: 'time' },
      { nome: 'fim', rotulo: 'Fim', tipo: 'time' },
      { nome: 'cadeira_id', rotulo: 'Cadeira', tipo: 'select', opcoes: opcoesCadeira(m, { vazio: true }) },
      { nome: 'assunto', rotulo: 'Assunto', largo: true },
    ],
    aoSalvar: async (v) => {
      await adicionar('Estudos', { id: novoId('E'), feito: false, ...v });
      aviso('Estudo marcado na planilha.');
    },
  });
}

export function novaPendencia(m) {
  if (!podeGravar()) return;
  const prioridades = ['Alta', 'Média', 'Baixa'].map((p) => ({ valor: p, texto: p }));
  abrirFormulario({
    titulo: 'Nova pendência',
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', obrigatorio: true, largo: true },
      { nome: 'prazo', rotulo: 'Prazo', tipo: 'date' },
      { nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', opcoes: prioridades, valor: 'Média' },
      { nome: 'cadeira_id', rotulo: 'Cadeira', tipo: 'select', opcoes: opcoesCadeira(m, { vazio: true }) },
    ],
    aoSalvar: async (v) => {
      await adicionar('Pendencias', { id: novoId('P'), status: 'Aberta', ...v });
      aviso('Pendência salva na planilha.');
    },
  });
}
