import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SheetsAdapter, ErroLogin, montarSemente, letraColuna, objetoParaLinha, ABAS } from '../js/dados/adaptadores/sheetsAdapter.js';
import { normalizar } from '../js/dados/normalizar.js';
import { PlanilhaFalsa } from './planilhaFalsa.mjs';

const abasJson = JSON.parse(fs.readFileSync(new URL('../data/simulacao.json', import.meta.url)));
const novoAdaptador = (falsa, token = 'token-teste') =>
  new SheetsAdapter({ planilhaId: 'ID', obterToken: () => token, fetch: falsa.fetch });

test('letraColuna e objetoParaLinha', () => {
  assert.equal(letraColuna(0), 'A');
  assert.equal(letraColuna(25), 'Z');
  assert.equal(letraColuna(26), 'AA');
  assert.deepEqual(objetoParaLinha(['id', 'feito', 'x'], { id: 'E1', feito: true }), ['E1', 'TRUE', '']);
});

test('semente: horário real entra, estudos e pendências de exemplo não', () => {
  const s = montarSemente(abasJson);
  assert.equal(s.Aulas.length, abasJson.Aulas.length + 1);
  assert.equal(s.Estudos.length, 1);
  assert.equal(s.Pendencias.length, 1);
});

test('primeiro login: planilha vazia vira a planilha do Código M', async () => {
  const falsa = new PlanilhaFalsa();
  const ad = novoAdaptador(falsa);
  const preencheu = await ad.garantirEstrutura(async () => montarSemente(abasJson));
  assert.equal(preencheu, true);
  assert.deepEqual([...falsa.abas.keys()].sort(), [...ABAS].sort(), 'a "Página1" virou Config e as outras abas foram criadas');
  assert.equal(falsa.locale, 'pt_BR');

  const abas = await ad.lerAbas();
  assert.equal(abas.Aulas.length, abasJson.Aulas.length);
  assert.equal(abas.Estudos.length, 0);
  const m = normalizar(abas, { hojeReal: '2026-11-03' });
  assert.ok(m.aulas.length > 100 && m.avaliacoes.length > 5, 'o site entende a planilha');

  // Segunda vez: nada é reescrito
  assert.equal(await ad.garantirEstrutura(async () => assert.fail('não deveria pedir a semente')), false);
});

test('aba apagada é recriada só com o cabeçalho', async () => {
  const falsa = new PlanilhaFalsa();
  const ad = novoAdaptador(falsa);
  await ad.garantirEstrutura(async () => montarSemente(abasJson));
  falsa.abas.delete('Pendencias');
  assert.equal(await ad.garantirEstrutura(async () => assert.fail('não deveria pedir a semente')), false);
  assert.deepEqual(falsa.abas.get('Pendencias').valores, [['id', 'descricao', 'cadeira_id', 'prazo', 'status', 'prioridade']]);
});

test('adicionar e atualizar linhas', async () => {
  const falsa = new PlanilhaFalsa();
  const ad = novoAdaptador(falsa);
  await ad.garantirEstrutura(async () => montarSemente(abasJson));

  await ad.adicionarLinha('Avaliacoes', { id: 'AV-x', data: '2026-11-20', cadeira_id: 'bioquimica', titulo: '1º Trabalho oral', tipo: 'Trabalho oral' });
  await ad.adicionarLinha('Estudos', { id: 'E-1', data: '2026-11-03', atividade: 'Revisão', feito: false });
  await ad.atualizarLinha('Estudos', 'E-1', { feito: true });

  const m = normalizar(await ad.lerAbas(), { hojeReal: '2026-11-03' });
  const av = m.avaliacoes.find((a) => a.id === 'AV-x');
  assert.equal(av.titulo, '1º Trabalho oral');
  assert.equal(av.data, '2026-11-20');
  assert.equal(m.estudos.find((e) => e.id === 'E-1').feito, true);

  await assert.rejects(ad.atualizarLinha('Estudos', 'nao-existe', { feito: true }), /Não encontrei/);
});

test('sem login ou login expirado gera ErroLogin', async () => {
  const falsa = new PlanilhaFalsa();
  await assert.rejects(novoAdaptador(falsa, null).lerAbas(), ErroLogin);
  await assert.rejects(novoAdaptador(falsa, 'token-velho').lerAbas(), ErroLogin);
});
