// Formulários de cadastro e edição ("+ Registrar" e cliques nos itens).
// Com login gravam na planilha (e os arquivos no Drive); no modo simulação
// ficam só nesta aba (somem ao recarregar).

import { abrirFormulario } from '../ui/formulario.js';
import { aviso } from '../ui/componentes.js';
import { adicionar, atualizar, emSimulacao, novoId } from '../dados/dataSource.js';
import { assuntosDaCadeira } from '../regras/dominio.js';
import { guardarArquivo, previaDestino, reclassificar } from '../dados/arquivos.js';
import { nomeCadeira } from '../dados/consultas.js';


const onde = () => (emSimulacao() ? 'só nesta sessão (simulação)' : 'na planilha');
const salvo = (o) => aviso(`${o} salvo ${onde()}.`);
const ops = (lista) => lista.map((x) => ({ valor: x, texto: x }));
const numero = (v) => String(v ?? '').replace(',', '.');

/** Opções de cadeira agrupadas: módulos (para provas integradas) e cadeiras, com o período. */
export function opcoesCadeira(m, { incluirModulos = false, vazio = false, textoVazio = '— nenhuma —' } = {}) {
  const lista = vazio ? [{ valor: '', texto: textoVazio }] : [];
  for (const mod of m.modulos) {
    if (incluirModulos) lista.push({ valor: mod.id, texto: `${mod.nome} ${mod.periodo} (módulo inteiro)` });
    for (const c of m.cadeiras.filter((x) => x.moduloId === mod.id)) lista.push({ valor: c.id, texto: nomeCadeira(m, c.id) });
  }
  return lista;
}

const campoCadeira = (m, valor, extra = {}) => ({
  nome: 'cadeira_id', rotulo: 'Cadeira', tipo: 'select', opcoes: opcoesCadeira(m, extra), valor, obrigatorio: !extra.vazio,
});
const campoAssunto = (m, valor, obrigatorio = false) => ({
  nome: 'assunto', rotulo: 'Assunto', valor, largo: true, obrigatorio, dependeDe: 'cadeira_id',
  sugestoes: (cad) => (cad ? assuntosDaCadeira(m, cad) : []), dica: 'Comece a digitar: aparecem os assuntos das aulas.',
});
const campoImagem = (nome, rotulo, atual = '') => ({ nome, rotulo, tipo: 'arquivo', aceita: 'image/*', imagem: true, largo: true, atual: atual ? 'imagem guardada' : '' });

// ── Estudos ─────────────────────────────────────────────

/** Marca/desmarca um estudo como feito. Feito ganha a data de hoje. */
export async function marcarEstudo(m, id, feito) {
  await atualizar('Estudos', id, feito ? { feito: true, data: m.hoje } : { feito: false });
}

export function novoEstudo(m, { data = '', cadeiraId = '', assunto = '', atividade = '' } = {}) {
  formularioEstudo(m, { data, cadeiraId, assunto, atividade, feito: false });
}

export function editarEstudo(m, e) {
  formularioEstudo(m, e);
}

function formularioEstudo(m, e) {
  const editar = Boolean(e.id);
  abrirFormulario({
    titulo: editar ? 'Estudo' : 'Marcar estudo',
    campos: [
      { nome: 'atividade', rotulo: 'O que vou fazer', obrigatorio: true, largo: true, valor: e.atividade,
        sugestoes: ['Assistir à aula / ver material', 'Resumo ativo', 'Infográfico', 'Conversar com tutor (IA)', 'Elaborar dúvidas', 'Criar flashcards', 'Resolver questões', 'Estudar como cai na prova', 'Revisão'] },
      campoCadeira(m, e.cadeiraId ?? '', { vazio: true, textoVazio: 'Pessoal / sem cadeira' }),
      campoAssunto(m, e.assunto ?? ''),
      { nome: 'data', rotulo: 'Quando', tipo: 'date', valor: e.data ?? '', dica: 'Pode deixar em branco e escolher o dia depois.' },
      { nome: 'inicio', rotulo: 'Início', tipo: 'time', valor: e.inicio ?? '' },
      { nome: 'fim', rotulo: 'Fim', tipo: 'time', valor: e.fim ?? '' },
      { nome: 'feito', rotulo: 'Situação', tipo: 'check', textoCheck: 'Já fiz', valor: Boolean(e.feito) },
    ],
    aoSalvar: async (v) => {
      const linha = { ...v, feito: v.feito };
      if (v.feito && !v.data) linha.data = m.hoje;
      if (editar) await atualizar('Estudos', e.id, linha);
      else await adicionar('Estudos', { id: novoId('E'), ...linha });
      salvo('Estudo');
    },
  });
}

// ── Avaliações ──────────────────────────────────────────

export const SITUACOES_ENTREGA = ['Pendente', 'Enviado no Classroom', 'Não precisa'];

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
      { nome: 'vale', rotulo: 'Vale (pontos)', tipo: 'number', min: 0 },
      { nome: 'conteudo', rotulo: 'Conteúdo', tipo: 'textarea', largo: true, dica: 'Assuntos separados por ponto e vírgula' },
      { nome: 'obs', rotulo: 'Observação', largo: true },
    ],
    aoSalvar: async (v) => {
      await adicionar('Avaliacoes', { id: novoId('AV'), turma: 'Todas', entrega: 'Pendente', ...v, vale: numero(v.vale) });
      salvo('Avaliação');
    },
  });
}

/** Abre uma avaliação para mudar data, link, observação, nota e entrega. */
export function editarAvaliacao(m, a) {
  abrirFormulario({
    titulo: a.titulo,
    intro: `${nomeCadeira(m, a.cadeiraId)} · ${a.tipo}${a.conteudo ? `\nConteúdo: ${a.conteudo}` : ''}`,
    campos: [
      { nome: 'data', rotulo: 'Data', tipo: 'date', valor: a.data, obrigatorio: true },
      { nome: 'hora', rotulo: 'Início', tipo: 'time', valor: a.hora },
      { nome: 'vale', rotulo: 'Quanto vale', tipo: 'number', valor: a.vale ?? '', min: 0, dica: 'Pontos máximos (ex.: 4)' },
      { nome: 'nota', rotulo: 'Quanto tirei', tipo: 'number', valor: a.nota ?? '', min: 0, dica: 'Em branco = ainda não saiu' },
      { nome: 'entrega', rotulo: 'Entrega no Classroom', tipo: 'radios', opcoes: ops(SITUACOES_ENTREGA), valor: a.entrega || 'Pendente', largo: true },
      { nome: 'link', rotulo: 'Link do meu material', tipo: 'url', valor: a.link, largo: true, placeholder: 'https://…' },
      { nome: 'arquivo', rotulo: 'Ou envie o arquivo', tipo: 'arquivo', largo: true },
      { nome: 'obs', rotulo: 'Observação', tipo: 'textarea', valor: a.obs, largo: true },
      { nome: 'local', rotulo: 'Local', valor: a.local },
      { nome: 'titulo', rotulo: 'Título', valor: a.titulo, obrigatorio: true },
    ],
    previa: (v) => (v.arquivo ? previaDestino(m, { cadeiraId: a.cadeiraId, categoria: 'avaliacao' }) : ''),
    aoSalvar: async (v, progresso) => {
      const { arquivo, ...campos } = v;
      if (arquivo) {
        const r = await guardarArquivo(m, arquivo, { cadeiraId: a.cadeiraId, assunto: v.titulo, categoria: 'avaliacao', tipo: 'Avaliacao', data: v.data, progresso });
        campos.link = r.link || campos.link;
      }
      await atualizar('Avaliacoes', a.id, { ...campos, vale: numero(campos.vale), nota: numero(campos.nota) });
      salvo('Avaliação');
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

// ── Dúvidas ─────────────────────────────────────────────

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
      campoImagem('imagem', 'Imagem (print, slide, esquema)'),
    ],
    previa: (v) => (v.imagem ? previaDestino(m, { cadeiraId: v.cadeira_id, assunto: v.assunto, categoria: 'duvida' }) : ''),
    aoSalvar: async (v, progresso) => {
      const { imagem, ...campos } = v;
      const r = imagem && (await guardarArquivo(m, imagem, { cadeiraId: v.cadeira_id, assunto: v.assunto, categoria: 'duvida', tipo: 'Duvida', progresso, sufixo: Date.now().toString(36) }));
      await adicionar('Duvidas', { id: novoId('D'), criada: m.hoje, status: 'Aberta', ...campos, imagem: r?.id ?? '' });
      salvo('Dúvida');
    },
  });
}

export function responderDuvida(m, d) {
  abrirFormulario({
    titulo: 'Dúvida',
    campos: [
      { nome: 'pergunta', rotulo: 'Pergunta', tipo: 'textarea', valor: d.pergunta, largo: true, obrigatorio: true },
      { nome: 'tentativa', rotulo: 'Minha tentativa (sem consultar)', tipo: 'textarea', valor: d.tentativa, largo: true },
      { nome: 'resposta', rotulo: 'Resposta conferida', tipo: 'textarea', valor: d.resposta, largo: true, linhas: 5 },
      { nome: 'fonte', rotulo: 'Fonte (livro, página, artigo)', valor: d.fonte, largo: true },
      { nome: 'link', rotulo: 'Link (IA, vídeo, artigo)', tipo: 'url', valor: d.link, largo: true },
      campoImagem('imagem', 'Imagem', d.imagem),
      { nome: 'status', rotulo: 'Situação', tipo: 'radios', opcoes: ops(['Aberta', 'Sanada']), valor: d.sanada ? 'Sanada' : 'Aberta' },
    ],
    previa: (v) => (v.imagem ? previaDestino(m, { cadeiraId: d.cadeiraId, assunto: d.assunto, categoria: 'duvida' }) : ''),
    aoSalvar: async (v, progresso) => {
      const { imagem, ...campos } = v;
      const r = imagem && (await guardarArquivo(m, imagem, { cadeiraId: d.cadeiraId, assunto: d.assunto, categoria: 'duvida', tipo: 'Duvida', progresso, sufixo: Date.now().toString(36) }));
      await atualizar('Duvidas', d.id, { ...campos, sanada_em: v.status === 'Sanada' ? d.sanadaEm || m.hoje : '', ...(r ? { imagem: r.id } : {}) });
      salvo('Dúvida');
    },
  });
}

// ── Questões ────────────────────────────────────────────

export function novaQuestao(m, { cadeiraId = '', assunto = '', fonte = '' } = {}) {
  abrirFormulario({
    titulo: 'Registrar questão',
    campos: [
      { nome: 'resultado', rotulo: 'Resultado', tipo: 'radios', opcoes: ops(['Acertou', 'Errou', 'Chutou']), obrigatorio: true, largo: true },
      { nome: 'confianca', rotulo: 'Confiança', tipo: 'radios', opcoes: [1, 2, 3, 4, 5].map((n) => ({ valor: String(n), texto: String(n) })), valor: '3', largo: true,
        dica: 'Chute com confiança 1–2 conta como erro; com 4–5 conta acerto, mas pede aprofundamento.' },
      campoCadeira(m, cadeiraId),
      campoAssunto(m, assunto, true),
      campoImagem('imagem', 'Print da questão (caderno de erros)'),
      { nome: 'motivos', rotulo: 'Motivos', tipo: 'checks', opcoes: ops(m.config.motivosQuestao), largo: true },
      { nome: 'fonte', rotulo: 'Fonte', valor: fonte, dica: 'Ex.: Caderno GoodNotes, PI 2025.1 Q12' },
      { nome: 'data', rotulo: 'Data', tipo: 'date', valor: m.hoje, obrigatorio: true },
      { nome: 'obs', rotulo: 'Observação', largo: true },
    ],
    previa: (v) => (v.imagem ? previaDestino(m, { cadeiraId: v.cadeira_id, assunto: v.assunto, categoria: 'questao' }) : ''),
    textoBotao: 'Registrar',
    aoSalvar: async (v, progresso) => {
      const { imagem, ...campos } = v;
      const id = novoId('Q');
      const r = imagem && (await guardarArquivo(m, imagem, { cadeiraId: v.cadeira_id, assunto: v.assunto, categoria: 'questao', tipo: 'Questao', data: v.data, progresso, sufixo: id }));
      await adicionar('Questoes', { id, ...campos, imagem: r?.id ?? '' });
      salvo('Questão');
    },
  });
}

// ── Materiais ───────────────────────────────────────────

export function novoMaterial(m, { cadeiraId = '', assunto = '', tipo = '' } = {}) {
  formularioMaterial(m, { cadeiraId, assunto, tipo: tipo || m.config.tiposMaterial[0]?.nome, origem: 'Minha' });
}

export function editarMaterial(m, x) {
  formularioMaterial(m, x);
}

function formularioMaterial(m, x) {
  const editar = Boolean(x.id);
  const tipos = m.config.tiposMaterial.map((t) => t.nome);
  abrirFormulario({
    titulo: editar ? 'Material' : 'Adicionar material',
    intro: editar ? '' : 'Envie o arquivo (PDF, imagem, gravação…) ou cole um link. O Código M guarda no lugar certo do Drive.',
    campos: [
      ...(editar ? [] : [{ nome: 'arquivo', rotulo: 'Arquivo', tipo: 'arquivo', largo: true, imagem: true }]),
      { nome: 'link', rotulo: editar ? 'Link' : 'Ou um link', tipo: 'url', largo: true, valor: x.link ?? '', placeholder: 'https://…' },
      { nome: 'titulo', rotulo: 'Título', largo: true, valor: x.titulo ?? '', dica: editar ? '' : 'Em branco = nome do arquivo' },
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: ops(tipos), valor: x.tipo },
      { nome: 'origem', rotulo: 'Origem', tipo: 'select', opcoes: ops(m.config.origensMaterial), valor: x.origem ?? 'Minha' },
      campoCadeira(m, x.cadeiraId ?? ''),
      campoAssunto(m, x.assunto ?? ''),
      { nome: 'obs', rotulo: 'Observação', largo: true, valor: x.obs ?? '' },
    ],
    previa: (v) => (v.arquivo || x.driveId ? previaDestino(m, { cadeiraId: v.cadeira_id, assunto: v.assunto, origem: v.origem }) : ''),
    aoSalvar: async (v, progresso) => {
      const { arquivo, ...campos } = v;
      if (editar) {
        const mudou = campos.cadeira_id !== x.cadeiraId || campos.assunto !== x.assunto || campos.origem !== x.origem;
        if (mudou && x.driveId) {
          progresso('Movendo no Drive…');
          await reclassificar(m, x.driveId, { cadeiraId: campos.cadeira_id, assunto: campos.assunto, origem: campos.origem });
        }
        await atualizar('Materiais', x.id, campos);
        salvo('Material');
        return;
      }
      if (!arquivo && !campos.link) throw new Error('Escolha um arquivo ou cole um link.');
      let r = null;
      if (arquivo) {
        const igual = m.materiais.find((y) => y.hash && y.nomeOriginal === arquivo.name && y.cadeiraId === campos.cadeira_id);
        if (igual) throw new Error(`Este arquivo já está no Código M: “${igual.titulo}”.`);
        r = await guardarArquivo(m, arquivo, { cadeiraId: campos.cadeira_id, assunto: campos.assunto, origem: campos.origem, tipo: campos.tipo, progresso });
        const repetido = r.hash && m.materiais.find((y) => y.hash === r.hash);
        if (repetido) throw new Error(`Este arquivo já foi enviado antes: “${repetido.titulo}”. Nada foi duplicado.`);
      }
      await adicionar('Materiais', {
        id: novoId('M'), criado: m.hoje, ...campos,
        titulo: campos.titulo || arquivo?.name.replace(/\.[^.]+$/, '') || campos.link,
        link: r?.link || campos.link,
        copiado: campos.origem === 'Turma' ? 'FALSE' : '',
        drive_id: r && !r.simulado ? r.id : '', hash: r?.hash ?? '', nome_original: arquivo?.name ?? '',
      });
      aviso(r && !r.simulado ? `Enviado ao Drive: ${r.destino}` : `Material salvo ${onde()}.`);
    },
  });
}

// ── Cartões ─────────────────────────────────────────────

export function novoCartao(m, { cadeiraId = '', assunto = '', frente = '', verso = '', fonte = '' } = {}) {
  abrirFormulario({
    titulo: 'Novo cartão (Método Catarina)',
    intro: 'Uma pergunta por cartão. Cartões que você escreve contam como validados e entram primeiro. Dá para colar um print na frente e outro no verso.',
    campos: [
      { nome: 'frente', rotulo: 'Frente (pergunta)', tipo: 'textarea', obrigatorio: true, largo: true, valor: frente },
      campoImagem('imagem_frente', 'Imagem da frente'),
      { nome: 'verso', rotulo: 'Verso (resposta)', tipo: 'textarea', obrigatorio: true, largo: true, valor: verso },
      campoImagem('imagem_verso', 'Imagem do verso'),
      campoCadeira(m, cadeiraId),
      campoAssunto(m, assunto),
      { nome: 'fonte', rotulo: 'Fonte', largo: true, valor: fonte },
    ],
    previa: (v) => (v.imagem_frente || v.imagem_verso ? previaDestino(m, { cadeiraId: v.cadeira_id, assunto: v.assunto, categoria: 'cartao' }) : ''),
    aoSalvar: async (v, progresso) => {
      const { imagem_frente: f, imagem_verso: t, ...campos } = v;
      const id = novoId('C');
      const opc = { cadeiraId: v.cadeira_id, assunto: v.assunto, categoria: 'cartao', progresso };
      const rf = f && (await guardarArquivo(m, f, { ...opc, tipo: 'Cartao frente', sufixo: id }));
      const rv = t && (await guardarArquivo(m, t, { ...opc, tipo: 'Cartao verso', sufixo: id }));
      await adicionar('Cartoes', { id, criado: m.hoje, origem: 'Validado', vence: m.hoje, revisoes: 0, lapsos: 0, ...campos, imagem_frente: rf?.id ?? '', imagem_verso: rv?.id ?? '' });
      salvo('Cartão');
    },
  });
}

// ── Calculadora de notas ────────────────────────────────

export function novaNota(m, { cadeiraId = '', nota = null } = {}) {
  const editar = Boolean(nota);
  abrirFormulario({
    titulo: editar ? 'Editar nota' : '+ Avaliação na calculadora',
    intro: 'Para notas que não estão no calendário (ex.: pontos internos). Peso em branco = vale (soma de pontos).',
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true, largo: true, valor: nota?.nome ?? '' },
      campoCadeira(m, nota?.cadeiraId ?? cadeiraId, { incluirModulos: true }),
      { nome: 'vale', rotulo: 'Vale (pontos)', tipo: 'number', valor: nota?.vale ?? 10, obrigatorio: true, min: 0 },
      { nome: 'peso', rotulo: 'Peso', tipo: 'number', valor: nota && nota.peso !== nota.vale ? nota.peso : '', min: 0 },
      { nome: 'nota', rotulo: 'Nota tirada', tipo: 'number', valor: nota?.nota ?? '', min: 0, dica: 'Em branco = ainda não saiu' },
      { nome: 'bonus', rotulo: 'É nota extra / bônus?', tipo: 'radios', opcoes: ops(['Não', 'Sim']), valor: nota?.bonus ? 'Sim' : 'Não' },
      { nome: 'obs', rotulo: 'Observação', largo: true, valor: nota?.obs ?? '' },
    ],
    aoSalvar: async (v) => {
      const linha = { ...v, bonus: v.bonus === 'Sim' ? 'sim' : '', vale: numero(v.vale), peso: numero(v.peso), nota: numero(v.nota) };
      if (editar) await atualizar('Notas', nota.id, linha);
      else await adicionar('Notas', { id: novoId('N'), avaliacao_id: '', ...linha });
      salvo('Nota');
    },
  });
}

/** Menu do botão "+ Registrar" (topo) — o contexto pré-preenche cadeira/assunto. */
export const REGISTROS = [
  { tipo: 'duvida', nome: 'Dúvida', icone: 'duvidas', abrir: novaDuvida },
  { tipo: 'questao', nome: 'Questão', icone: 'questoes', abrir: novaQuestao },
  { tipo: 'estudo', nome: 'Estudo', icone: 'estudo', abrir: (m, x) => novoEstudo(m, { ...x, data: '' }) },
  { tipo: 'cartao', nome: 'Cartão', icone: 'flashcard', abrir: novoCartao },
  { tipo: 'material', nome: 'Material', icone: 'materiais', abrir: novoMaterial },
  { tipo: 'avaliacao', nome: 'Avaliação', icone: 'avaliacoes', abrir: novaAvaliacao },
  { tipo: 'pendencia', nome: 'Pendência', icone: 'pendencias', abrir: novaPendencia },
];

