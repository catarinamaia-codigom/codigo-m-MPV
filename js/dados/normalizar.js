// Transforma as abas "cruas" (texto, como vêm da planilha) no modelo
// usado pelas telas: tipos corretos, datas padronizadas, Config organizada.
// Funções puras — fáceis de testar e iguais para JSON ou planilha.

import { normalizarData, normalizarHora } from '../util/datas.js';
import { lista } from '../util/texto.js';

const txt = (v) => String(v ?? '').trim();
const bool = (v) => ['true', 'sim', 'verdadeiro', '1', 'x', 'feito'].includes(txt(v).toLowerCase());
const num = (v, padrao = 0) => {
  const n = parseFloat(txt(v).replace(',', '.'));
  return Number.isFinite(n) ? n : padrao;
};

/** Turmas que sempre aparecem (aulas para a turma inteira). */
const TURMAS_GERAIS = ['', 'todas', 'geral', 'todos'];

/**
 * Aba Config (colunas: grupo | chave | valor | obs) -> objeto organizado.
 * Itens de lista (tipos de material, motivos, atalhos) são uma linha cada,
 * para ficar fácil acrescentar ou apagar direto na planilha.
 */
export function lerConfig(linhas = []) {
  const grupos = {};
  for (const l of linhas) {
    const grupo = txt(l.grupo).toLowerCase();
    if (!grupo) continue;
    (grupos[grupo] ??= []).push({ chave: txt(l.chave), valor: txt(l.valor), obs: txt(l.obs) });
  }
  const mapa = (g) => Object.fromEntries((grupos[g] ?? []).map((i) => [i.chave, i.valor]));
  const geral = mapa('geral');
  const sug = mapa('sugestoes');

  return {
    periodo: geral.periodo || '1M',
    semestre: geral.semestre || '',
    aluna: geral.aluna || '',
    turma: geral.turma || '',
    turmasVisiveis: lista(geral.turmas_visiveis).map((t) => t.toUpperCase()),
    dataSimulada: normalizarData(geral.data_simulada),
    iaUrl: geral.ia_url || 'https://claude.ai/new',
    sugestoes: {
      janelaAvaliacaoDias: num(sug.janela_avaliacao_dias, 14),
      revisaoIntervalos: lista(sug.revisao_intervalos_dias).map((n) => num(n)).filter((n) => n > 0),
      preLeitura: sug.pre_leitura === undefined ? true : bool(sug.pre_leitura),
      max: num(sug.max_sugestoes, 4),
    },
    cronograma: mapa('cronograma'),
    tiposMaterial: (grupos.tipo_material ?? []).map((i) => ({ nome: i.chave, icone: i.valor || 'arquivo' })),
    motivosDuvida: (grupos.motivo_duvida ?? []).map((i) => i.chave),
    tiposAvaliacao: (grupos.tipo_avaliacao ?? []).map((i) => i.chave).filter(Boolean).length
      ? grupos.tipo_avaliacao.map((i) => i.chave).filter(Boolean)
      : ['Prova teórica', 'Prova prática', 'Trabalho oral', 'Seminário', 'Prova integrada', 'Trabalho', 'Outro'],
    atalhosIA: (grupos.atalho_ia ?? []).map((i) => ({ nome: i.chave, prompt: i.valor })),
    formulasNota: mapa('formula_nota'),
    grupos, // acesso genérico a qualquer grupo novo criado na planilha
  };
}

/** Aceita turma única ("TA1") ou várias ("TA1/TA2"): visível se alguma estiver na lista. */
export function turmaVisivel(turma, turmasVisiveis) {
  const t = txt(turma).toUpperCase();
  if (TURMAS_GERAIS.includes(t.toLowerCase())) return true;
  return t.split(/[\/,;]/).map((x) => x.trim()).some((x) => turmasVisiveis.includes(x));
}

const porDataHora = (a, b) =>
  (a.data + (a.inicio || a.hora || '')).localeCompare(b.data + (b.inicio || b.hora || ''));

/** Abas cruas -> modelo completo usado pelas telas. */
export function normalizar(abas, { modo = 'simulacao', hojeReal } = {}) {
  const config = lerConfig(abas.Config);

  const modulos = (abas.Modulos ?? [])
    .map((m) => ({ id: txt(m.id), periodo: txt(m.periodo), nome: txt(m.nome), ordem: num(m.ordem, 99) }))
    .filter((m) => m.id)
    .sort((a, b) => a.ordem - b.ordem);

  const cadeiras = (abas.Cadeiras ?? [])
    .map((c) => ({ id: txt(c.id), moduloId: txt(c.modulo_id), nome: txt(c.nome), ordem: num(c.ordem, 99) }))
    .filter((c) => c.id)
    .sort((a, b) => a.ordem - b.ordem);

  const todasAulas = (abas.Aulas ?? [])
    .map((a) => ({
      id: txt(a.id),
      data: normalizarData(a.data),
      inicio: normalizarHora(a.inicio),
      fim: normalizarHora(a.fim),
      cadeiraId: txt(a.cadeira_id),
      assunto: txt(a.assunto),
      tipo: txt(a.tipo),
      turma: txt(a.turma) || 'Todas',
      local: txt(a.local),
      professor: txt(a.professor),
    }))
    .filter((a) => a.data)
    .sort(porDataHora);

  const avaliacoesTodas = (abas.Avaliacoes ?? [])
    .map((a) => ({
      id: txt(a.id),
      data: normalizarData(a.data),
      hora: normalizarHora(a.hora),
      fim: normalizarHora(a.fim),
      cadeiraId: txt(a.cadeira_id),
      titulo: txt(a.titulo),
      tipo: txt(a.tipo),
      conteudo: txt(a.conteudo),
      turma: txt(a.turma) || 'Todas',
      local: txt(a.local),
      obs: txt(a.obs),
    }))
    .filter((a) => a.data)
    .sort(porDataHora);

  const estudos = (abas.Estudos ?? [])
    .map((e) => ({
      id: txt(e.id),
      data: normalizarData(e.data),
      inicio: normalizarHora(e.inicio),
      fim: normalizarHora(e.fim),
      cadeiraId: txt(e.cadeira_id),
      assunto: txt(e.assunto),
      atividade: txt(e.atividade),
      feito: bool(e.feito),
    }))
    .filter((e) => e.data)
    .sort(porDataHora);

  const pendencias = (abas.Pendencias ?? [])
    .map((p) => ({
      id: txt(p.id),
      descricao: txt(p.descricao),
      cadeiraId: txt(p.cadeira_id),
      prazo: normalizarData(p.prazo),
      feita: ['feita', 'concluida', 'concluída', 'ok'].includes(txt(p.status).toLowerCase()),
      prioridade: txt(p.prioridade) || 'Média',
    }))
    .filter((p) => p.descricao);

  const feriados = (abas.Feriados ?? [])
    .map((f) => ({ data: normalizarData(f.data), nome: txt(f.nome) }))
    .filter((f) => f.data);

  const visivel = (x) => turmaVisivel(x.turma, config.turmasVisiveis);

  return {
    modo,
    hoje: config.dataSimulada || hojeReal,
    config,
    modulos,
    cadeiras,
    aulas: todasAulas.filter(visivel), // só Todas + turmas visíveis (TA, TA1, TA2)
    todasAulas,
    avaliacoes: avaliacoesTodas.filter(visivel),
    estudos,
    pendencias,
    feriados,
  };
}
