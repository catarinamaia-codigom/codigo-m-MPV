import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizar, lerConfig, turmaVisivel } from '../js/dados/normalizar.js';
import { linhasParaObjetos } from '../js/dados/adaptadores/sheetsAdapter.js';
import { normalizarData, diasEntre, inicioDaSemana } from '../js/util/datas.js';
import { nomeArquivo } from '../js/util/texto.js';
import { gerarSugestoes } from '../js/regras/sugestoes.js';

const abas = JSON.parse(fs.readFileSync(new URL('../data/simulacao.json', import.meta.url)));

test('datas: aceita formato da planilha (dd/mm/aaaa) e ISO', () => {
  assert.equal(normalizarData('03/11/2026'), '2026-11-03');
  assert.equal(normalizarData('2026-11-3'), '2026-11-03');
  assert.equal(normalizarData('lixo'), '');
  assert.equal(diasEntre('2026-11-02', '2026-11-10'), 8);
  assert.equal(inicioDaSemana('2026-11-08'), '2026-11-02'); // domingo -> segunda anterior
});

test('nome de arquivo segue o padrão e tira acentos', () => {
  assert.equal(
    nomeArquivo({ periodo: '1M', tipo: 'Resumo', cadeira: 'Bioquímica', assunto: 'Glicólise', data: '2026-11-03', aluna: 'Catarina', ext: 'pdf' }),
    '[1M] [Resumo] [Bioquimica] [Glicolise] [03-11-2026] [Catarina].pdf'
  );
});

test('só aparecem práticas da turma TA (TA, TA1, TA2) e aulas para todas', () => {
  const m = normalizar(abas, { hojeReal: '2026-11-03' });
  for (const a of m.aulas) assert.ok(!/TB/.test(a.turma), `aula de TB apareceu: ${a.data} ${a.assunto}`);
  assert.ok(m.todasAulas.some((a) => a.turma.startsWith('TB')), 'o horário tem práticas de TB');
  assert.ok(m.aulas.some((a) => a.turma === 'TA1/TA2'), 'práticas TA1/TA2 aparecem');
  assert.ok(!turmaVisivel('TB1/TB2', ['TA', 'TA1', 'TA2']));
  assert.ok(turmaVisivel('TA1/TA2', ['TA', 'TA1', 'TA2']));
  assert.ok(turmaVisivel('todas', ['TA']));
});

test('dados importados do PDF são consistentes', () => {
  const m = normalizar(abas, { hojeReal: '2026-11-03' });
  const ids = new Set([...m.cadeiras.map((c) => c.id), ...m.modulos.map((x) => x.id), '']);
  for (const a of m.todasAulas) assert.ok(ids.has(a.cadeiraId), `cadeira desconhecida: ${a.cadeiraId}`);
  for (const a of m.avaliacoes) assert.ok(ids.has(a.cadeiraId), `cadeira desconhecida: ${a.cadeiraId}`);
  const feriados = new Set(m.feriados.map((f) => f.data));
  for (const a of m.todasAulas) assert.ok(!feriados.has(a.data), `aula em dia sem aula: ${a.data}`);
  assert.ok(m.avaliacoes.some((a) => a.data === '2026-11-11' && a.cadeiraId === 'anatomia'));
});

test('Config vira objeto organizado', () => {
  const c = lerConfig(abas.Config);
  assert.equal(c.periodo, '1M');
  assert.deepEqual(c.turmasVisiveis, ['TA', 'TA1', 'TA2']);
  assert.deepEqual(c.sugestoes.revisaoIntervalos, [1, 7, 30]);
  assert.ok(c.atalhosIA.length > 0 && c.tiposMaterial.length > 0);
});

test('adaptador da planilha converte linhas em objetos', () => {
  const r = linhasParaObjetos([['id', 'nome'], ['1', 'Ana'], ['', ''], ['2']]);
  assert.deepEqual(r, [{ id: '1', nome: 'Ana' }, { id: '2', nome: '' }]);
});

test('sugestões têm motivo e respeitam o limite da Config', () => {
  const m = normalizar(abas, { hojeReal: '2026-11-03' });
  const s = gerarSugestoes(m);
  assert.ok(s.length > 0 && s.length <= m.config.sugestoes.max);
  for (const x of s) assert.ok(x.motivo.length > 10);
  assert.equal(s[0].regra, 'avaliacao'); // 2ª Avaliação de Anatomia (11/11) vem primeiro
});
