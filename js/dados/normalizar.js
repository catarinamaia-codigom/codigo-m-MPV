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
    tiposMaterial: (() => {
      const tipos = (grupos.tipo_material ?? []).map((i) => ({ nome: i.chave, icone: i.valor || 'arquivo' }));
      if (!tipos.some((t) => t.icone === 'infografico')) tipos.splice(Math.min(2, tipos.length), 0, { nome: 'Infográfico', icone: 'infografico' });
      return tipos;
    })(),
    motivosDuvida: (grupos.motivo_duvida ?? []).map((i) => i.chave),
    tiposAvaliacao: (grupos.tipo_avaliacao ?? []).map((i) => i.chave).filter(Boolean).length
      ? grupos.tipo_avaliacao.map((i) => i.chave).filter(Boolean)
      : ['Prova teórica', 'Prova prática', 'Trabalho oral', 'Seminário', 'Prova integrada', 'Trabalho', 'Outro'],
    atalhosIA: (grupos.atalho_ia ?? []).map((i) => ({ nome: i.chave, prompt: i.valor })),
    formulasNota: mapa('formula_nota'),
    motivosQuestao: (grupos.motivo_questao ?? []).map((i) => i.chave).filter(Boolean).length
      ? grupos.motivo_questao.map((i) => i.chave).filter(Boolean)
      : ['Não sabia o conteúdo', 'Confundi conceitos', 'Li errado / desatenção', 'Esqueci', 'Interpretação do enunciado', 'Necessita aprofundamento'],
    origensMaterial: ['Minha', 'Turma', 'Professor', 'Livro', 'IA'],
    notas: {
      mediaAprovacao: num(mapa('notas').media_aprovacao, 7),
      mediaFinal: num(mapa('notas').media_final, 5),
    },
    retencaoDesejada: Math.min(0.97, Math.max(0.7, num(mapa('metodo').retencao_desejada, 0.9))),
    cartoesNovosPorDia: num(mapa('metodo').novos_por_dia, 20),
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
      aconteceu: bool(a.aconteceu),
      presente: bool(a.presente),
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
      link: txt(a.link),
      vale: txt(a.vale) === '' ? null : num(a.vale, 10),
      nota: txt(a.nota) === '' ? null : num(a.nota, 0),
      entrega: txt(a.entrega),
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
    .filter((e) => e.id && e.atividade)
    .sort((a, b) => (a.data ? 0 : 1) - (b.data ? 0 : 1) || porDataHora(a, b));

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

  const duvidas = (abas.Duvidas ?? [])
    .map((d) => ({
      id: txt(d.id),
      criada: normalizarData(d.criada),
      cadeiraId: txt(d.cadeira_id),
      assunto: txt(d.assunto),
      pergunta: txt(d.pergunta),
      motivo: txt(d.motivo),
      tentativa: txt(d.tentativa),
      resposta: txt(d.resposta),
      fonte: txt(d.fonte),
      link: txt(d.link),
      sanada: ['sanada', 'resolvida', 'ok', 'feita'].includes(txt(d.status).toLowerCase()),
      sanadaEm: normalizarData(d.sanada_em),
      imagem: txt(d.imagem),
    }))
    .filter((d) => d.id && d.pergunta)
    .sort((a, b) => b.criada.localeCompare(a.criada));

  const questoes = (abas.Questoes ?? [])
    .map((q) => ({
      id: txt(q.id),
      data: normalizarData(q.data),
      cadeiraId: txt(q.cadeira_id),
      assunto: txt(q.assunto),
      fonte: txt(q.fonte),
      resultado: (() => {
        const r = txt(q.resultado).toLowerCase();
        return r.startsWith('ac') ? 'Acertou' : r.startsWith('ch') ? 'Chutou' : r.startsWith('er') ? 'Errou' : '';
      })(),
      confianca: Math.min(5, Math.max(1, Math.round(num(q.confianca, 3)))),
      motivos: lista(q.motivos),
      obs: txt(q.obs),
      imagem: txt(q.imagem),
    }))
    .filter((q) => q.id && q.resultado)
    .sort((a, b) => b.data.localeCompare(a.data));

  const notas = (abas.Notas ?? [])
    .map((n) => {
      const vale = num(n.vale, 10) || 10;
      return {
        id: txt(n.id),
        cadeiraId: txt(n.cadeira_id),
        avaliacaoId: txt(n.avaliacao_id),
        nome: txt(n.nome),
        vale,
        peso: txt(n.peso) === '' ? vale : num(n.peso, vale),
        nota: txt(n.nota) === '' ? null : num(n.nota, 0),
        bonus: txt(n.bonus).toLowerCase() === 'sim' || txt(n.bonus).toLowerCase() === 'true',
        obs: txt(n.obs),
      };
    })
    .filter((n) => n.id && n.nome);

  // Também lê linhas gravadas pelo script do Classroom (nomes de coluna alternativos)
  const materiais = (abas.Materiais ?? [])
    .map((x) => {
      const driveId = txt(x.drive_id || x.arquivo_id || x.id_drive);
      return {
        id: txt(x.id || x.material_id || driveId),
        criado: normalizarData(x.criado || x.data || x.importado_em),
        cadeiraId: txt(x.cadeira_id),
        assunto: txt(x.assunto),
        tipo: txt(x.tipo) || 'Arquivo',
        titulo: txt(x.titulo || x.nome || x.titulo_original || x.nome_original),
        link: txt(x.link || x.url || x.link_drive) || (driveId ? `https://drive.google.com/file/d/${driveId}/view` : ''),
        origem: txt(x.origem || x.fonte) || 'Minha',
        copiado: bool(x.copiado),
        obs: txt(x.obs),
        driveId,
        hash: txt(x.hash),
        nomeOriginal: txt(x.nome_original),
      };
    })
    .filter((x) => x.id && (x.titulo || x.link))
    .sort((a, b) => b.criado.localeCompare(a.criado));

  const cartoes = (abas.Cartoes ?? [])
    .map((c) => ({
      id: txt(c.id),
      criado: normalizarData(c.criado),
      cadeiraId: txt(c.cadeira_id),
      assunto: txt(c.assunto),
      frente: txt(c.frente),
      verso: txt(c.verso),
      fonte: txt(c.fonte),
      validado: !['automatico', 'automático', 'ia', 'anki'].includes(txt(c.origem).toLowerCase()),
      origem: txt(c.origem) || 'Validado',
      vence: normalizarData(c.vence),
      estabilidade: num(c.estabilidade, 0),
      dificuldade: num(c.dificuldade, 0),
      revisoes: num(c.revisoes, 0),
      lapsos: num(c.lapsos, 0),
      ultima: normalizarData(c.ultima),
      imagemFrente: txt(c.imagem_frente),
      imagemVerso: txt(c.imagem_verso),
    }))
    .filter((c) => c.id && c.frente);

  const revisoes = (abas.Revisoes ?? [])
    .map((r) => ({ data: normalizarData(r.data), cartaoId: txt(r.cartao_id), nota: num(r.nota, 0), intervalo: num(r.intervalo, 0) }))
    .filter((r) => r.data && r.cartaoId && r.nota >= 1);

  const convites = (abas.Convites ?? [])
    .map((c) => ({ email: txt(c.email), convidadoEm: normalizarData(c.convidado_em), papel: txt(c.papel) || 'leitura', status: txt(c.status), obs: txt(c.obs) }))
    .filter((c) => c.email);

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
    duvidas,
    questoes,
    notas,
    materiais,
    cartoes,
    revisoes,
    convites,
  };
}
