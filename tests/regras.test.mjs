import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { revisar, intervalo, recuperabilidade, previa } from '../js/regras/fsrs.js';
import { calcularMedia } from '../js/regras/notas.js';
import { avaliarQuestao, estatisticaQuestoes, dominioAssunto, assuntosDaCadeira } from '../js/regras/dominio.js';
import { converterBackup, mapearCadeira } from '../js/regras/importarAntigo.js';
import { normalizar } from '../js/dados/normalizar.js';

const abasJson = JSON.parse(fs.readFileSync(new URL('../data/simulacao.json', import.meta.url)));
const modelo = () => normalizar(structuredClone(abasJson), { hojeReal: '2026-11-04' });

test('FSRS: intervalos crescem com acertos e caem com erro', () => {
  let c = { estabilidade: 0, dificuldade: 0, revisoes: 0, lapsos: 0 };
  const a = revisar(c, 3, 0);
  assert.equal(a.revisoes, 1);
  assert.ok(a.intervalo >= 3 && a.intervalo <= 5, `1ª revisão "Bom" ~4 dias (veio ${a.intervalo})`);
  const b = revisar(a, 3, a.intervalo);
  assert.ok(b.intervalo > a.intervalo * 2, 'segundo acerto alonga bastante');
  const e = revisar(b, 1, b.intervalo);
  assert.equal(e.intervalo, 1, 'errou: volta amanhã');
  assert.equal(e.lapsos, 1);
  assert.ok(e.estabilidade < b.estabilidade);
  assert.equal(intervalo(10, 0.9), 10, 'com retenção 90% o intervalo é a estabilidade');
  assert.ok(Math.abs(recuperabilidade(10, 10) - 0.9) < 0.001);
  const p = previa(c, 0).map((x) => x.dias);
  assert.ok(p[0] <= p[1] && p[1] <= p[2] && p[2] <= p[3], 'botões em ordem crescente');
});

test('Notas: soma de pontos (Biofísica 4 + 4 + 2)', () => {
  const itens = [
    { vale: 4, peso: 4, nota: 3.2, bonus: false },
    { vale: 4, peso: 4, nota: null, bonus: false },
    { vale: 2, peso: 2, nota: null, bonus: false },
  ];
  const r = calcularMedia(itens);
  assert.equal(r.garantida, 3.2);
  assert.equal(r.parcial, 8);
  assert.equal(r.precisa, 6.33, 'precisa de 3,8 em 6 pontos = 6,33 de 10');
  const sim = calcularMedia(itens, undefined, { 1: '4', 2: '2' });
  assert.equal(sim.media, 9.2);
  assert.equal(sim.situacao, 'aprovada');
});

test('Notas: final e bônus', () => {
  const r = calcularMedia([{ vale: 10, peso: 10, nota: 6, bonus: false }, { vale: 10, peso: 10, nota: 5, bonus: false }]);
  assert.equal(r.media, 5.5);
  assert.equal(r.situacao, 'final');
  assert.equal(r.notaFinalNecessaria, 4.5, '(5,5 + 4,5) / 2 = 5');
  const b = calcularMedia([{ vale: 10, peso: 10, nota: 6.5, bonus: false }, { vale: 1, peso: 1, nota: 0.5, bonus: true }]);
  assert.equal(b.media, 7);
  assert.equal(b.situacao, 'aprovada');
  assert.equal(calcularMedia([]).vazio, true);
});

test('Questões: chute com confiança baixa conta como erro', () => {
  assert.deepEqual(avaliarQuestao({ resultado: 'Chutou', confianca: 2, motivos: [] }), { acerto: false, aprofundar: true });
  assert.deepEqual(avaliarQuestao({ resultado: 'Chutou', confianca: 4, motivos: [] }), { acerto: true, aprofundar: true });
  assert.deepEqual(avaliarQuestao({ resultado: 'Acertou', confianca: 5, motivos: [] }), { acerto: true, aprofundar: false });
  const e = estatisticaQuestoes([
    { resultado: 'Acertou', confianca: 4, motivos: [] },
    { resultado: 'Errou', confianca: 3, motivos: [] },
    { resultado: 'Chutou', confianca: 1, motivos: [] },
    { resultado: 'Chutou', confianca: 5, motivos: [] },
  ]);
  assert.equal(e.acertos, 2);
  assert.equal(e.taxa, 0.5);
});

test('Domínio: usa aulas, estudos e questões, com motivo', () => {
  const m = modelo();
  const d = dominioAssunto(m, 'histologia', 'Epitélio de Revestimento');
  assert.ok(d.nivel >= 3, 'tem questões registradas');
  assert.match(d.motivo, /acerto/);
  const futuro = dominioAssunto(m, 'histologia', 'Tecido Cardiovascular');
  assert.equal(futuro.nivel, 0);
  assert.ok(assuntosDaCadeira(m, 'histologia').length > 5);
});

test('Importar backup do Código M antigo', () => {
  const m = modelo();
  assert.equal(mapearCadeira(m, 'Histologia').id, 'histologia');
  assert.equal(mapearCadeira(m, 'Bioquimica').id, 'bioquimica');
  assert.equal(mapearCadeira(m, 'Identidade Médica').id, 'mdm');
  const backup = {
    state: {
      tasks: [
        { id: 't1', chair: 'Histologia', topic: 'Epitélio', title: 'Resumo', date: '2026-10-27', done: true },
        { id: 't2', chair: 'Cadeira Inventada', title: 'Sem data' },
      ],
      doubts: [{ id: 'd1', chair: 'Anatomia', topic: 'Ombro', question: 'Manguito?', answer: 'SITS', resolved: true, links: { ai: 'https://claude.ai/x' }, created: '2026-10-20' }],
      grades: { Biofísica: [{ id: 'g1', name: 'AV1', score: '3,5', max: 4 }] },
      materials: [{ id: 'm1', title: 'PDF local', chair: 'Citologia', hasFile: true }],
    },
  };
  const r = converterBackup(backup, m);
  assert.equal(r.linhas.Estudos.length, 1);
  assert.equal(r.linhas.Estudos[0].cadeira_id, 'histologia');
  assert.equal(r.linhas.Pendencias.length, 1, 'tarefa sem data vira pendência');
  assert.deepEqual(r.semCorrespondencia, ['Cadeira Inventada']);
  assert.equal(r.linhas.Pendencias[0].cadeira_id, 'Cadeira Inventada', 'nada é descartado');
  assert.equal(r.linhas.Duvidas[0].status, 'Sanada');
  assert.equal(r.linhas.Duvidas[0].link, 'https://claude.ai/x');
  assert.equal(r.linhas.Notas[0].cadeira_id, 'biofisica');
  assert.match(r.linhas.Materiais[0].obs, /reenviar/);
  assert.equal(r.total, 5);
  // Reimportar não duplica
  m.duvidas.push({ id: 'ANT-d1' });
  assert.equal(converterBackup(backup, m).linhas.Duvidas.length, 0);
});

test('Simulação: abas novas são lidas pelo modelo', () => {
  const m = modelo();
  assert.ok(m.duvidas.length && m.questoes.length && m.notas.length && m.materiais.length && m.cartoes.length);
  assert.equal(m.notas.find((n) => n.id === 'N-ex1').nota, 3.2, 'vírgula decimal da planilha');
  assert.equal(m.notas.find((n) => n.id === 'N-ex1').peso, 4, 'peso em branco = vale');
});

test('Drive: destino de cada coisa, com a regra dos colchetes', async () => {
  const { destino, textoDestino, semestreDoPeriodo, bloco } = await import('../js/dados/drive.js').catch(() => ({}));
  if (!destino) return; // drive.js usa APIs do navegador só nas funções de rede
  assert.equal(semestreDoPeriodo('1M'), '2026.2');
  assert.equal(semestreDoPeriodo('2M'), '2027.1');
  assert.equal(semestreDoPeriodo('3M'), '2027.2');
  assert.equal(bloco('Músculos: membro/inferior'), '[Musculos membro inferior]');
  const base = { periodo: '1M', cadeira: 'Anatomia' };
  assert.equal(textoDestino(destino({ ...base, assunto: 'Ombro' })), '20-Medicina/Conhecimento/[Anatomia]/[Ombro]/');
  assert.equal(textoDestino(destino({ ...base, assunto: 'Ombro', origem: 'Turma' })), '20-Medicina/Conhecimento/[Anatomia]/[Ombro]/[Turma]/');
  assert.equal(textoDestino(destino({ ...base, assunto: 'Ombro', categoria: 'questao' })), '20-Medicina/Conhecimento/[Anatomia]/[Ombro]/[Caderno de erros]/');
  assert.equal(textoDestino(destino({ ...base, assunto: '' })), '20-Medicina/Conhecimento/[Anatomia]/[_A-classificar]/');
  assert.equal(textoDestino(destino({ ...base, categoria: 'avaliacao' })), '20-Medicina/Periodos/[1M] [2026.2]/[Anatomia]/[Avaliacoes]/');
});

test('Estudos sem data ficam guardados; cadeira mostra o período; faltas', async () => {
  const { nomeCadeira, faltasDaCadeira } = await import('../js/dados/consultas.js');
  const m = modelo();
  assert.ok(m.estudos.some((e) => !e.data), 'estudo sem data não é descartado');
  assert.equal(nomeCadeira(m, 'anatomia'), 'Anatomia 1M');
  const aula = m.aulas.find((a) => a.cadeiraId === 'anatomia');
  aula.aconteceu = true;
  assert.equal(faltasDaCadeira(m, 'anatomia'), 1, 'teve aula e não fui = falta');
  aula.presente = true;
  assert.equal(faltasDaCadeira(m, 'anatomia'), 0);
  assert.ok(m.config.tiposMaterial.some((t) => t.icone === 'infografico'), 'infográfico é um tipo de material');
});
