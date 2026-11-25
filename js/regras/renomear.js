// Renomear ou mudar um assunto de cadeira: quais linhas mudam em cada aba.
// Funções puras (testáveis); quem grava é telas/estrutura.js.

import { doAssunto, mesmoAssunto } from './dominio.js';
import { gravarAtalhos } from '../dados/normalizar.js';

/** Linhas de cada aba que pertencem a um assunto (para renomear/mover). */
export function linhasDoAssunto(m, cadeiraId, assunto) {
  const daqui = (x) => doAssunto(x, cadeiraId, assunto);
  return {
    Aulas: m.todasAulas.filter(daqui),
    Estudos: m.estudos.filter(daqui),
    Duvidas: m.duvidas.filter(daqui),
    Questoes: m.questoes.filter(daqui),
    Cartoes: m.cartoes.filter(daqui),
    Materiais: [...m.materiais, ...m.materiaisAExcluir].filter(daqui),
  };
}

/**
 * Monta as mudanças de planilha para trocar (cadeira, assunto) -> (novaCadeira, novoAssunto),
 * inclusive nos atalhos de outros itens. Função pura (testável).
 * @returns {Object<string, Array<{id, campos}>>}
 */
export function mudancasRenomear(m, de, para) {
  const porAba = {};
  const somar = (aba, id, campos) => {
    const lista = (porAba[aba] ??= []);
    const atual = lista.find((x) => x.id === id);
    if (atual) Object.assign(atual.campos, campos);
    else lista.push({ id, campos: { ...campos } });
  };
  for (const [aba, linhas] of Object.entries(linhasDoAssunto(m, de.cadeiraId, de.assunto))) {
    for (const l of linhas) somar(aba, l.id, { cadeira_id: para.cadeiraId, assunto: para.assunto });
  }
  // Atalhos que apontavam para o assunto antigo
  for (const [aba, lista] of [['Materiais', [...m.materiais, ...m.materiaisAExcluir]], ['Duvidas', m.duvidas]]) {
    for (const x of lista) {
      if (!(x.assuntosExtra ?? []).some((r) => r.cadeiraId === de.cadeiraId && mesmoAssunto(r.assunto, de.assunto))) continue;
      const refs = x.assuntosExtra.map((r) => (r.cadeiraId === de.cadeiraId && mesmoAssunto(r.assunto, de.assunto) ? { ...para } : r));
      somar(aba, x.id, { assuntos_extra: gravarAtalhos(refs) });
    }
  }
  return porAba;
}
