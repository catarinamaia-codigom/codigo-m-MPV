// Organização das cadeiras e assuntos: criar assunto à mão, renomear ou
// mudar um assunto de cadeira (planilha + Drive), trocar o assunto de uma
// aula só, criar cadeira e criar "zona de interesse" (bloco próprio de
// estudo e pesquisa, que funciona como um módulo com suas linhas).

import { abrirFormulario } from '../ui/formulario.js';
import { aviso } from '../ui/componentes.js';
import { adicionar, atualizar, atualizarVarias, avisarMudanca, emSimulacao, novoId } from '../dados/dataSource.js';
import { assuntosDaCadeira, mesmoAssunto, registroAssunto } from '../regras/dominio.js';
import { linhasDoAssunto, mudancasRenomear } from '../regras/renomear.js';
import { nomeCadeira } from '../dados/consultas.js';
import { renomearAssuntoNoDrive } from '../dados/arquivos.js';
import { semAcentos } from '../util/texto.js';
import { opcoesCadeira } from './formularios.js';

const irPara = (cadeiraId, assunto = '') => (location.hash = `#/cadeiras/${encodeURIComponent(cadeiraId)}${assunto ? `/${encodeURIComponent(assunto)}` : ''}`);
const ehIdDrive = (id) => /^[\w-]{20,}$/.test(id ?? '');
const slug = (t) => semAcentos(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
const idUnico = (base, usados) => {
  let id = base;
  for (let i = 2; usados.includes(id); i++) id = `${base}-${i}`;
  return id;
};
const campoSecundaria = (m, cadeiraPrincipal, valor = '') => ({
  nome: 'cadeira_secundaria', rotulo: 'Cadeira secundária (atalho)', tipo: 'select', largo: true, valor,
  opcoes: opcoesCadeira(m, { vazio: true }).filter((o) => o.valor !== cadeiraPrincipal),
  dica: 'O assunto aparece também nessa cadeira, como atalho para esta página.',
});

/** + Assunto: cria um assunto sem aula no cronograma (estudo próprio, pesquisa…). */
export function novoAssunto(m, { cadeiraId }) {
  abrirFormulario({
    titulo: `Novo assunto em ${nomeCadeira(m, cadeiraId)}`,
    campos: [
      { nome: 'assunto', rotulo: 'Nome do assunto', obrigatorio: true, largo: true },
      campoSecundaria(m, cadeiraId),
      { nome: 'obs', rotulo: 'Observação', tipo: 'textarea', largo: true },
    ],
    aoSalvar: async (v) => {
      if (assuntosDaCadeira(m, cadeiraId).some((a) => mesmoAssunto(a, v.assunto))) throw new Error('Esta cadeira já tem um assunto com esse nome.');
      await adicionar('Assuntos', { id: novoId('AS'), cadeira_id: cadeiraId, assunto: v.assunto, cadeira_secundaria: v.cadeira_secundaria, criado: m.hoje, obs: v.obs }, { silencioso: true });
      avisarMudanca();
      aviso('Assunto criado.');
      irPara(cadeiraId, v.assunto);
    },
  });
}

/** Renomear / mudar de cadeira / ligar a cadeira secundária. */
export function renomearAssunto(m, cadeiraId, assunto) {
  const reg = registroAssunto(m, cadeiraId, assunto);
  const linhas = linhasDoAssunto(m, cadeiraId, assunto);
  const total = Object.values(linhas).reduce((s, l) => s + l.length, 0);
  abrirFormulario({
    titulo: 'Renomear ou mover assunto',
    intro: `Muda em tudo o que é deste assunto (${total} registro(s): aulas, materiais, dúvidas, questões, cartões, estudos) e, no Drive, a pasta e os nomes dos arquivos.`,
    campos: [
      { nome: 'assunto', rotulo: 'Nome do assunto', valor: assunto, obrigatorio: true, largo: true },
      { nome: 'cadeira_id', rotulo: 'Cadeira principal', tipo: 'select', opcoes: opcoesCadeira(m), valor: cadeiraId, obrigatorio: true },
      campoSecundaria(m, cadeiraId, reg?.secundaria ?? ''),
      { nome: 'obs', rotulo: 'Observação do assunto', tipo: 'textarea', largo: true, valor: reg?.obs ?? '' },
    ],
    textoBotao: 'Aplicar',
    aoSalvar: async (v, progresso) => {
      const para = { cadeiraId: v.cadeira_id, assunto: v.assunto.trim() };
      const mudouNome = para.cadeiraId !== cadeiraId || para.assunto !== assunto;
      if (mudouNome && para.cadeiraId !== cadeiraId && assuntosDaCadeira(m, para.cadeiraId).some((a) => mesmoAssunto(a, para.assunto))) {
        if (!confirm(`${nomeCadeira(m, para.cadeiraId)} já tem “${para.assunto}”. Juntar os dois assuntos?`)) return;
      }
      if (mudouNome) {
        progresso('Atualizando a planilha…');
        for (const [aba, mudancas] of Object.entries(mudancasRenomear(m, { cadeiraId, assunto }, para))) {
          await atualizarVarias(aba, mudancas, { silencioso: true });
        }
      }
      const registro = { cadeira_id: para.cadeiraId, assunto: para.assunto, cadeira_secundaria: v.cadeira_secundaria === para.cadeiraId ? '' : v.cadeira_secundaria, obs: v.obs };
      if (reg) await atualizar('Assuntos', reg.id, registro, { silencioso: true });
      else if (registro.cadeira_secundaria || registro.obs) await adicionar('Assuntos', { id: novoId('AS'), criado: m.hoje, ...registro }, { silencioso: true });

      let drive = '';
      if (mudouNome && !emSimulacao()) {
        progresso('Acertando o Drive…');
        const itens = [
          ...linhas.Materiais.filter((x) => ehIdDrive(x.driveId)).map((x) => ({ id: x.driveId, categoria: 'material', origem: x.origem })),
          ...linhas.Duvidas.filter((x) => ehIdDrive(x.imagem)).map((x) => ({ id: x.imagem, categoria: 'duvida' })),
          ...linhas.Questoes.filter((x) => ehIdDrive(x.imagem)).map((x) => ({ id: x.imagem, categoria: 'questao' })),
          ...linhas.Cartoes.flatMap((x) => [x.imagemFrente, x.imagemVerso]).filter(ehIdDrive).map((id) => ({ id, categoria: 'cartao' })),
        ];
        try {
          drive = await renomearAssuntoNoDrive(m, { de: { cadeiraId, assunto }, para, itens });
        } catch (e) {
          drive = `não consegui mudar o Drive (${e.message}). A planilha já foi atualizada.`;
        }
      }
      avisarMudanca();
      aviso(mudouNome ? `Assunto atualizado.${drive ? ` Drive: ${drive}.` : ''}` : 'Assunto atualizado.');
      if (mudouNome) irPara(para.cadeiraId, para.assunto);
    },
  });
}

const TIPOS_AULA = ['Teórica', 'Prática', 'Tutoria', 'Campo', 'Caso clínico', 'Módulo', 'Outro'];

/**
 * + Aula ou editar uma aula: data, horário, tipo, local, professor, cadeira
 * e assunto. Mudar cadeira/assunto aqui muda só ESTA aula (para o assunto
 * inteiro, use "Renomear / mudar cadeira" no topo da página do assunto).
 */
export function formularioAula(m, aula = {}) {
  const editar = Boolean(aula.id);
  abrirFormulario({
    titulo: editar ? 'Aula' : 'Nova aula',
    intro: editar ? 'Muda só esta aula. Para o assunto inteiro, use “Renomear / mudar cadeira” no topo da página do assunto.' : '',
    campos: [
      { nome: 'data', rotulo: 'Data', tipo: 'date', valor: aula.data ?? m.hoje, obrigatorio: true },
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: TIPOS_AULA.map((t) => ({ valor: t, texto: t })), valor: aula.tipo || 'Teórica' },
      { nome: 'inicio', rotulo: 'Início', tipo: 'time', valor: aula.inicio ?? '' },
      { nome: 'fim', rotulo: 'Fim', tipo: 'time', valor: aula.fim ?? '' },
      { nome: 'cadeira_id', rotulo: 'Cadeira', tipo: 'select', opcoes: opcoesCadeira(m), valor: aula.cadeiraId ?? '', obrigatorio: true },
      { nome: 'assunto', rotulo: 'Assunto', valor: aula.assunto ?? '', obrigatorio: true, largo: true, dependeDe: 'cadeira_id',
        sugestoes: (cad) => (cad ? assuntosDaCadeira(m, cad) : []), dica: 'Escolha um assunto existente ou escreva um novo.' },
      { nome: 'local', rotulo: 'Local', valor: aula.local ?? '' },
      { nome: 'professor', rotulo: 'Professor(a)', valor: aula.professor ?? '' },
    ],
    aoSalvar: async (v) => {
      if (editar) await atualizar('Aulas', aula.id, v, { silencioso: true });
      else await adicionar('Aulas', { id: novoId('A'), turma: 'Todas', ...v }, { silencioso: true });
      avisarMudanca();
      aviso(editar ? 'Aula atualizada.' : 'Aula criada.');
      const mudou = !editar || v.cadeira_id !== aula.cadeiraId || !mesmoAssunto(v.assunto, aula.assunto);
      if (mudou) irPara(v.cadeira_id, v.assunto);
    },
  });
}

/** Atalho rápido: o assunto aparece também em outra cadeira. */
export function atalhoEmOutraCadeira(m, cadeiraId, assunto) {
  const reg = registroAssunto(m, cadeiraId, assunto);
  abrirFormulario({
    titulo: 'Atalho em outra cadeira',
    intro: `“${assunto}” continua em ${nomeCadeira(m, cadeiraId)} e aparece também na cadeira escolhida, como atalho para esta página.`,
    campos: [campoSecundaria(m, cadeiraId, reg?.secundaria ?? '')],
    aoSalvar: async (v) => {
      if (reg) await atualizar('Assuntos', reg.id, { cadeira_secundaria: v.cadeira_secundaria }, { silencioso: true });
      else await adicionar('Assuntos', { id: novoId('AS'), cadeira_id: cadeiraId, assunto, cadeira_secundaria: v.cadeira_secundaria, criado: m.hoje, obs: '' }, { silencioso: true });
      avisarMudanca();
      aviso(v.cadeira_secundaria ? `Atalho criado em ${nomeCadeira(m, v.cadeira_secundaria)}.` : 'Atalho removido.');
    },
  });
}

/** + Cadeira: dentro de um módulo do curso ou de uma zona de interesse. */
export function novaCadeira(m, { moduloId = '' } = {}) {
  abrirFormulario({
    titulo: 'Nova cadeira ou linha',
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true, largo: true },
      { nome: 'modulo_id', rotulo: 'Dentro de', tipo: 'select', obrigatorio: true, largo: true, valor: moduloId,
        opcoes: m.modulos.map((x) => ({ valor: x.id, texto: x.tipo ? `${x.nome} (zona de interesse)` : `${x.nome} · ${x.periodo}` })) },
    ],
    aoSalvar: async (v) => {
      const id = idUnico(slug(v.nome), m.cadeiras.map((c) => c.id));
      await adicionar('Cadeiras', { id, modulo_id: v.modulo_id, nome: v.nome, ordem: m.cadeiras.length + 1 }, { silencioso: true });
      avisarMudanca();
      aviso('Cadeira criada.');
      irPara(id);
    },
  });
}

/** + Zona de interesse: bloco próprio (como um módulo) para linhas de estudo e pesquisa. */
export function novaZona(m) {
  abrirFormulario({
    titulo: 'Nova zona de interesse',
    intro: 'Um bloco seu, fora do cronograma da faculdade (ex.: Cardiologia, Pesquisa em sono, Residência). Dentro dele você cria linhas (como cadeiras) e assuntos.',
    campos: [
      { nome: 'nome', rotulo: 'Nome da zona', obrigatorio: true, largo: true },
      { nome: 'linha', rotulo: 'Primeira linha de estudo', largo: true, dica: 'Em branco = usa o mesmo nome da zona.' },
    ],
    aoSalvar: async (v) => {
      const idZona = idUnico(`z-${slug(v.nome)}`, m.modulos.map((x) => x.id));
      await adicionar('Modulos', { id: idZona, periodo: 'Livre', nome: v.nome, ordem: 90 + m.modulos.length, tipo: 'Zona de interesse' }, { silencioso: true });
      const idLinha = idUnico(slug(v.linha || v.nome), m.cadeiras.map((c) => c.id));
      await adicionar('Cadeiras', { id: idLinha, modulo_id: idZona, nome: v.linha || v.nome, ordem: m.cadeiras.length + 1 }, { silencioso: true });
      avisarMudanca();
      aviso('Zona de interesse criada.');
      irPara(idLinha);
    },
  });
}
