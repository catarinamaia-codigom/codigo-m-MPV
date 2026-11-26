// Importar do Anki: lê .apkg reais (gerados pelo próprio Anki 26.09 com
// ferramentas/criar_apkg_teste.py) nos formatos novo (zstd) e antigo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { unzipSync } from '../js/vendor/fflate.mjs';
import { decompress } from '../js/vendor/fzstd.mjs';
import { lerApkg } from '../js/dados/apkg.js';
import {
  montarCartoes, sugerirDestino, aplicarCloze, preencherModelo, htmlParaTexto, extrairImagens, formasOclusao, lerProtobuf, converterAgendamento,
} from '../js/regras/anki.js';

const require = createRequire(import.meta.url);
const initSqlJs = require('../js/vendor/sql-wasm.js');
const SQL = await initSqlJs({ locateFile: (f) => new URL(`../js/vendor/${f}`, import.meta.url).pathname });
const ler = (nome) => lerApkg(new Uint8Array(fs.readFileSync(new URL(`./fixtures/${nome}`, import.meta.url))), { unzipSync, decompress, SQL });

for (const arquivo of ['novo.apkg', 'antigo.apkg']) {
  test(`${arquivo}: todos os tipos de cartão viram cartões do Código M`, () => {
    const { colecao, midia, formato } = ler(arquivo);
    assert.equal(formato, arquivo === 'novo.apkg' ? 'novo' : 'antigo');
    assert.deepEqual([...midia.keys()].sort(), ['coracao.png', 'esquema.png', 'mask-a.svg', 'mask-q.svg']);
    assert.deepEqual([...midia.get('coracao.png').slice(0, 4)], [137, 80, 78, 71], 'imagem descompactada (PNG)');

    const cs = montarCartoes(colecao);
    const porTipo = cs.reduce((a, c) => ((a[c.tipo] = (a[c.tipo] || 0) + 1), a), {});
    assert.deepEqual(porTipo, { basico: 4, cloze: 2, oclusao: 2, 'oclusao-complemento': 1 });

    const simples = cs.find((c) => c.frente.startsWith('Qual câmara'));
    assert.equal(simples.verso, 'Ventrículo esquerdo & parede espessa');
    assert.deepEqual(simples.imagemFrente, { imagens: ['coracao.png'], mascaras: [] });
    assert.equal(simples.deck, 'Medicina::Anatomia::Coração');
    assert.deepEqual(simples.tags, ['anatomia', 'coracao']);

    const [c1, c2] = cs.filter((c) => c.tipo === 'cloze');
    assert.equal(c1.frente, 'A [...] acontece no citosol e gera [...].');
    assert.equal(c2.frente, 'A glicólise acontece no [local] e gera 2 ATP.', 'dica da lacuna');
    assert.match(c2.verso, /\[citosol\][\s\S]*Lehninger cap\. 14/);

    const io = cs.filter((c) => c.tipo === 'oclusao');
    assert.deepEqual(io.map((c) => c.imagemFrente.ativo), [1, 2]);
    assert.equal(io[0].imagemFrente.formas.length, 3);
    assert.equal(io[0].frente, 'Esquema do coração');
    assert.equal(io[0].verso, 'Netter prancha 210');

    const ioe = cs.find((c) => c.tipo === 'oclusao-complemento');
    assert.deepEqual(ioe.imagemFrente, { imagens: ['esquema.png'], mascaras: ['mask-q.svg'] });
    assert.deepEqual(ioe.imagemVerso, { imagens: ['esquema.png'], mascaras: ['mask-a.svg'] });
    assert.equal(ioe.verso, 'Ver https://exemplo.com/atlas', 'o verso não repete a frente');

    const digitar = cs.find((c) => c.frente.startsWith('Valva'));
    assert.equal(digitar.frente, 'Valva entre AE e VE?\n• uma\n• palavra');
    assert.equal(digitar.verso, 'Mitral');

    const estudado = cs.find((c) => c.agendamento);
    assert.equal(estudado.frente, 'Glicólise');
    assert.deepEqual({ ...estudado.agendamento, vence: undefined, ultima: undefined }, { vence: undefined, ultima: undefined, estabilidade: 14.5, dificuldade: 6.2, revisoes: 4, lapsos: 1 });
    assert.equal(cs.filter((c) => c.suspenso).length, 1);
    assert.equal(new Set(cs.map((c) => c.ankiId)).size, cs.length, 'cada cartão tem um anki_id único (reimportar não duplica)');
  });
}

test('modelos do Anki: condicionais, filtros e lacunas', () => {
  const campos = { Front: 'F', Back: 'B', Extra: '', Texto: 'a {{c1::x}} b {{c2::y::dica}} c {{c1,2::z}}' };
  assert.equal(preencherModelo('{{Front}}{{#Extra}}[{{Extra}}]{{/Extra}}{{^Extra}}(sem extra){{/Extra}}', campos, { lado: 'frente' }), 'F(sem extra)');
  assert.equal(preencherModelo('{{type:Back}}', campos, { lado: 'frente' }), '');
  assert.equal(preencherModelo('{{type:Back}}', campos, { lado: 'verso' }), 'B');
  assert.equal(aplicarCloze(campos.Texto, 2, 'frente'), 'a x b [dica] c [...]');
  assert.equal(aplicarCloze(campos.Texto, 1, 'verso'), 'a [x] b y c [z]');
  assert.equal(htmlParaTexto('<div>um&nbsp;dois</div><script>x()</script>[sound:a.mp3]três &amp; &#233;'), 'um dois\ntrês & é');
  assert.equal(htmlParaTexto('linha 1<div>linha 2</div><div>linha 3</div>'), 'linha 1\nlinha 2\nlinha 3', 'jeito que o editor do Anki grava');
  assert.equal(htmlParaTexto('a<br><br>b'), 'a\n\nb', 'linha em branco de propósito continua');
  assert.deepEqual(extrairImagens(`<img src="a b.png"> <img src='c.jpg'> <img class=x src=d.gif>`), ['a b.png', 'c.jpg', 'd.gif']);
});

test('oclusão nativa: formas, grupos e modo "esconder todas"', () => {
  const f = formasOclusao('{{c1::image-occlusion:rect:left=.1:top=.2:width=.3:height=.4:oi=1}}{{c2,3::image-occlusion:polygon:points=0.1,0.1 0.2,0.3 0.3,0.1:oi=0}}');
  assert.deepEqual(f[0], { n: [1], forma: 'rect', left: 0.1, top: 0.2, width: 0.3, height: 0.4, oi: 1 });
  assert.deepEqual(f[1].n, [2, 3]);
  assert.equal(f[1].points, '0.1,0.1 0.2,0.3 0.3,0.1');
});

test('protobuf, progresso e destino sugerido', () => {
  const pb = lerProtobuf(new Uint8Array([0x0a, 0x02, 0x6f, 0x69, 0x10, 0x96, 0x01]));
  assert.equal(new TextDecoder().decode(pb.get(1)[0]), 'oi');
  assert.equal(pb.get(2)[0], 150);
  assert.equal(converterAgendamento({ reps: 0, tipo: 0 }, 0), null, 'cartão novo entra como novo');
  const sm2 = converterAgendamento({ reps: 3, tipo: 2, due: 10, ivl: 6, fator: 2500, lapsos: 0, dados: {} }, Date.UTC(2026, 10, 1, 3) / 1000);
  assert.deepEqual(sm2, { vence: '2026-11-11', estabilidade: 6, dificuldade: 5, revisoes: 3, lapsos: 0, ultima: '2026-11-05' });
  const cad = [{ id: 'anatomia', nome: 'Anatomia' }, { id: 'bioquimica', nome: 'Bioquímica' }];
  assert.deepEqual(sugerirDestino('Medicina::Anatomia::Coração', cad), { cadeiraId: 'anatomia', assunto: 'Coração' });
  assert.deepEqual(sugerirDestino('1M::bioquimica', cad), { cadeiraId: 'bioquimica', assunto: '' });
  assert.deepEqual(sugerirDestino('Default', cad), { cadeiraId: '', assunto: '' });
});
