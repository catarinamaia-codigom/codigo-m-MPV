// Ideias de 25/11: atalhos entre assuntos, exclusão em duas etapas, dúvidas
// mais novas em cima, opções novas, links clicáveis, visualizador, perguntas
// de estudo ativo e renomear assunto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizar, lerAtalhos, gravarAtalhos } from '../js/dados/normalizar.js';
import { ligadoAoAssunto, atalhoDoAssunto, assuntosDaCadeira, assuntosSecundarios } from '../js/regras/dominio.js';
import { linkificar } from '../js/util/texto.js';
import { idYoutube, idDoLink, formaDeVer } from '../js/dados/drive.js';
import { sortearPergunta } from '../js/regras/perguntas.js';
import { mudancasRenomear } from '../js/regras/renomear.js';
import { SheetsAdapter, montarSemente } from '../js/dados/adaptadores/sheetsAdapter.js';
import { nomeCadeira } from '../js/dados/consultas.js';
import { PlanilhaFalsa } from './planilhaFalsa.mjs';

const json = JSON.parse(fs.readFileSync(new URL('../data/simulacao.json', import.meta.url)));
const base = (extra = {}) => normalizar({ ...json, ...extra }, { hojeReal: '2026-11-25' });

test('atalhos: lidos e gravados no formato cadeira::assunto', () => {
  const refs = lerAtalhos('anatomia::Coração; anatomia::Músculos do tórax');
  assert.deepEqual(refs, [{ cadeiraId: 'anatomia', assunto: 'Coração' }, { cadeiraId: 'anatomia', assunto: 'Músculos do tórax' }]);
  assert.equal(gravarAtalhos(refs), 'anatomia::Coração; anatomia::Músculos do tórax');
  assert.deepEqual(lerAtalhos(''), []);
});

test('material ligado a mais de um assunto aparece como atalho no outro', () => {
  const m = base({ Materiais: [{ id: 'M-1', cadeira_id: 'anatomia', assunto: 'Coração', titulo: 'Atlas', tipo: 'Slide', assuntos_extra: 'anatomia::Músculos do tórax' }] });
  const x = m.materiais[0];
  assert.ok(ligadoAoAssunto(x, 'anatomia', 'Coração') && !atalhoDoAssunto(x, 'anatomia', 'Coração'));
  assert.ok(ligadoAoAssunto(x, 'anatomia', 'musculos do torax'), 'compara sem acento e sem maiúscula');
  assert.ok(atalhoDoAssunto(x, 'anatomia', 'Músculos do tórax'));
  assert.ok(!ligadoAoAssunto(x, 'anatomia', 'Neurocrânio'));
});

test('excluir em duas etapas: "A excluir" sai das listas e espera em Pendências; "Excluído" some', () => {
  const m = base({
    Materiais: [
      { id: 'M-1', titulo: 'ativo', cadeira_id: 'anatomia' },
      { id: 'M-2', titulo: 'esperando', cadeira_id: 'anatomia', status: 'A excluir' },
      { id: 'M-3', titulo: 'apagado', cadeira_id: 'anatomia', status: 'Excluído' },
      { id: 'M-4', titulo: 'status de outro script', cadeira_id: 'anatomia', status: 'importado' },
    ],
  });
  assert.deepEqual(m.materiais.map((x) => x.id).sort(), ['M-1', 'M-4']);
  assert.deepEqual(m.materiaisAExcluir.map((x) => x.id), ['M-2']);
});

test('dúvidas: mais novas em cima, também dentro do mesmo dia', () => {
  const cedo = `D-${(1764000000000).toString(36)}`;
  const tarde = `D-${(1764003600000).toString(36)}`;
  const m = base({
    Duvidas: [
      { id: cedo, criada: '2026-11-20', pergunta: 'primeira do dia' },
      { id: 'D-antiga', criada: '2026-11-10', pergunta: 'antiga' },
      { id: tarde, criada: '2026-11-20', pergunta: 'segunda do dia' },
    ],
  });
  assert.deepEqual(m.duvidas.map((d) => d.pergunta), ['segunda do dia', 'primeira do dia', 'antiga']);
});

test('opções novas: motivos de dúvida, Goodnotes, gravação e tipos de atividade', () => {
  const c = base().config;
  for (const mot of ['Errei questão', 'Não conhecia', 'Curiosidade']) assert.ok(c.motivosDuvida.includes(mot), mot);
  assert.equal(c.motivosDuvida.filter((x) => x === 'Errei questão').length, 1, 'não repete o que já está na Config');
  const tipos = c.tiposMaterial.map((t) => t.nome);
  for (const t of ['Goodnotes | Pessoal', 'Goodnotes | Colaborativo', 'Gravação de aula', 'Link de site', 'Trabalho da disciplina', 'Trabalho extra']) assert.ok(tipos.includes(t), t);
  for (const t of ['Escrevendo trabalho', 'Atividade extra', 'Atividade estratégica', 'Atividade de foco residência']) assert.ok(c.tiposAtividade.includes(t), t);
});

test('links colados viram clicáveis, sem abrir brecha para HTML', () => {
  const h = linkificar('Veja https://drive.google.com/file/d/abc123/view. <script>x</script> e www.ufpe.br');
  assert.match(h, /<a href="https:\/\/drive\.google\.com\/file\/d\/abc123\/view" target="_blank" rel="noopener">/);
  assert.match(h, /<\/a>\. &lt;script&gt;/, 'ponto final fica fora do link; HTML é escapado');
  assert.match(h, /href="https:\/\/www\.ufpe\.br"/);
});

test('visualizador reconhece YouTube e Drive', () => {
  assert.equal(idYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'dQw4w9WgXcQ');
  assert.equal(idYoutube('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(idDoLink('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing'), '1AbCdEfGhIjKlMnOp');
  assert.equal(formaDeVer({ link: 'https://youtu.be/dQw4w9WgXcQ' }).tipo, 'youtube');
  assert.equal(formaDeVer({ driveId: '1AbCdEfGhIjKlMnOp', link: '' }).url, 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview');
  assert.equal(formaDeVer({ link: 'https://goodnotes.com/s/abc' }).tipo, '', 'Goodnotes abre em outra aba');
});

test('pergunta de estudo ativo: sorteia de cartões, dúvidas sanadas e modelos', () => {
  const m = base({ Cartoes: [{ id: 'C-1', cadeira_id: 'anatomia', assunto: 'Coração', frente: 'Quais as câmaras?', verso: '4' }] });
  const p0 = sortearPergunta(m, { cadeiraId: 'anatomia', aleatorio: () => 0 });
  assert.equal(p0.origem, 'Cartão');
  assert.equal(p0.resposta, '4');
  const p1 = sortearPergunta(m, { cadeiraId: 'anatomia', aleatorio: () => 0.99 });
  assert.equal(p1.origem, 'Pergunta modelo');
  assert.ok(!p1.texto.includes('{'), 'modelo preenchido');
  assert.equal(p1.cadeiraId, 'anatomia');
});

test('renomear assunto: muda todas as abas e os atalhos que apontavam para ele', () => {
  const m = base({
    Materiais: [
      { id: 'M-1', cadeira_id: 'histologia', assunto: 'Tecido Ósseo / Ossificação', titulo: 'a' },
      { id: 'M-2', cadeira_id: 'histologia', assunto: 'Tecido cartilaginoso', titulo: 'b', assuntos_extra: 'histologia::Tecido Ósseo / Ossificação' },
    ],
    Duvidas: [{ id: 'D-1', cadeira_id: 'histologia', assunto: 'tecido osseo / ossificacao', pergunta: 'p' }],
  });
  const de = { cadeiraId: 'histologia', assunto: 'Tecido Ósseo / Ossificação' };
  const para = { cadeiraId: 'histologia', assunto: 'Tecido ósseo' };
  const mud = mudancasRenomear(m, de, para);
  assert.ok(mud.Aulas.length >= 1, 'a aula de 12/11 muda');
  assert.deepEqual(mud.Aulas[0].campos, { cadeira_id: 'histologia', assunto: 'Tecido ósseo' });
  assert.deepEqual(mud.Duvidas, [{ id: 'D-1', campos: { cadeira_id: 'histologia', assunto: 'Tecido ósseo' } }]);
  assert.deepEqual(mud.Materiais.find((x) => x.id === 'M-2').campos, { assuntos_extra: 'histologia::Tecido ósseo' });
});

test('assunto criado à mão, cadeira secundária e zona de interesse', () => {
  const m = base({
    Assuntos: [{ id: 'AS-1', cadeira_id: 'interprofissional', assunto: 'Projeto de pesquisa', cadeira_secundaria: 'aps' }],
    Modulos: [...json.Modulos, { id: 'z-cardio', periodo: 'Livre', nome: 'Cardiologia', ordem: '90', tipo: 'Zona de interesse' }],
    Cadeiras: [...json.Cadeiras, { id: 'eletro', modulo_id: 'z-cardio', nome: 'Eletrocardiograma', ordem: '20' }],
  });
  assert.ok(assuntosDaCadeira(m, 'interprofissional').includes('Projeto de pesquisa'));
  assert.deepEqual(assuntosSecundarios(m, 'aps').map((a) => a.assunto), ['Projeto de pesquisa']);
  assert.equal(nomeCadeira(m, 'eletro'), 'Eletrocardiograma', 'zona de interesse não leva "Livre" no nome');
  assert.equal(nomeCadeira(m, 'anatomia'), 'Anatomia 1M');
});

test('planilha: aba Assuntos é criada e várias linhas mudam numa só gravação', async () => {
  const falsa = new PlanilhaFalsa();
  const ad = new SheetsAdapter({ planilhaId: 'ID', obterToken: () => 'token-teste', fetch: falsa.fetch });
  await ad.garantirEstrutura(async () => montarSemente(json));
  assert.ok(falsa.abas.has('Assuntos'));
  const ids = falsa.abas.get('Aulas').valores.slice(1, 4).map((l) => l[0]);
  const antes = falsa.chamadas.length;
  await ad.atualizarVarias('Aulas', ids.map((id) => ({ id, campos: { assunto: 'Novo nome' } })));
  assert.equal(falsa.chamadas.length - antes, 2, 'uma leitura e uma gravação');
  const abas = await ad.lerAbas();
  assert.deepEqual(abas.Aulas.filter((a) => ids.includes(a.id)).map((a) => a.assunto), ['Novo nome', 'Novo nome', 'Novo nome']);
});
