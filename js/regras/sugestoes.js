// Sugestão de estudo POR REGRAS (sem IA, sem custo).
// Cada sugestão traz o "motivo", para a Catarina saber por que ela apareceu.
// Os parâmetros (janela de provas, intervalos de revisão, pré-leitura,
// quantidade) vêm da aba Config, grupo "sugestoes".

import { somarDias, diasEntre, formatoCurto, contagemDias } from '../util/datas.js';
import { nomeCadeira } from '../dados/consultas.js';

const TIPOS_TEORICOS = ['teórica', 'teorica', 'tutoria'];
const ehTeorica = (aula) => TIPOS_TEORICOS.includes(aula.tipo.toLowerCase());
const plural = (n, s, p) => (n === 1 ? s : p);

export function gerarSugestoes(m) {
  const { hoje, config } = m;
  const cfg = config.sugestoes;
  const sugestoes = [];

  const temEstudo = (cadeiraId, assunto, aPartirDe) =>
    m.estudos.some(
      (e) => e.cadeiraId === cadeiraId && e.assunto.toLowerCase() === assunto.toLowerCase() && e.data >= aPartirDe
    );

  // 1) Avaliação se aproximando
  for (const av of m.avaliacoes) {
    const faltam = diasEntre(hoje, av.data);
    if (faltam < 0 || faltam > cfg.janelaAvaliacaoDias) continue;
    const blocos = m.estudos.filter((e) => e.cadeiraId === av.cadeiraId && e.data >= hoje && e.data <= av.data).length;
    let motivo = `${av.titulo} ${contagemDias(hoje, av.data)} (${formatoCurto(av.data)}).`;
    if (av.conteudo) motivo += ` Conteúdo: ${av.conteudo}.`;
    motivo += blocos
      ? ` Você já marcou ${blocos} ${plural(blocos, 'bloco', 'blocos')} de estudo até lá.`
      : ' Ainda não há estudo marcado para ela.';
    sugestoes.push({
      regra: 'avaliacao',
      titulo: `Revisar ${nomeCadeira(m, av.cadeiraId)} para a avaliação`,
      cadeiraId: av.cadeiraId,
      assunto: av.conteudo.split(';')[0]?.trim() || av.titulo,
      motivo,
      peso: Math.max(60, 110 - faltam * 4) - (blocos ? 8 : 0),
    });
  }

  // 2) Revisão espaçada (D+1, D+7, D+30 ... conforme Config)
  for (const n of cfg.revisaoIntervalos) {
    const dataAula = somarDias(hoje, -n);
    for (const aula of m.aulas.filter((a) => a.data === dataAula && ehTeorica(a))) {
      if (temEstudo(aula.cadeiraId, aula.assunto, somarDias(aula.data, Math.max(1, n - 1)))) continue;
      sugestoes.push({
        regra: 'revisao',
        titulo: `Revisar: ${aula.assunto}`,
        cadeiraId: aula.cadeiraId,
        assunto: aula.assunto,
        motivo: `Aula de ${formatoCurto(aula.data)} (${n} ${plural(n, 'dia', 'dias')} atrás). Revisão espaçada de ${n} ${plural(n, 'dia', 'dias')} ajuda a fixar antes de esquecer.`,
        peso: n <= 1 ? 72 : n <= 7 ? 62 : 52,
      });
    }
  }

  // 3) Aulas recentes que ficaram sem nenhuma revisão
  const primeiro = Math.min(...cfg.revisaoIntervalos, 1);
  for (let n = primeiro + 1; n <= 6; n++) {
    if (cfg.revisaoIntervalos.includes(n)) continue;
    const dataAula = somarDias(hoje, -n);
    for (const aula of m.aulas.filter((a) => a.data === dataAula && ehTeorica(a))) {
      if (temEstudo(aula.cadeiraId, aula.assunto, aula.data)) continue;
      sugestoes.push({
        regra: 'atrasada',
        titulo: `Revisão atrasada: ${aula.assunto}`,
        cadeiraId: aula.cadeiraId,
        assunto: aula.assunto,
        motivo: `A aula foi em ${formatoCurto(aula.data)} e ainda não tem nenhuma revisão registrada.`,
        peso: 66 - n,
      });
    }
  }

  // 4) Pré-leitura das aulas de amanhã
  if (cfg.preLeitura) {
    const amanha = somarDias(hoje, 1);
    for (const aula of m.aulas.filter((a) => a.data === amanha && ehTeorica(a))) {
      sugestoes.push({
        regra: 'preleitura',
        titulo: `Pré-leitura: ${aula.assunto}`,
        cadeiraId: aula.cadeiraId,
        assunto: aula.assunto,
        motivo: `Aula de ${nomeCadeira(m, aula.cadeiraId)} amanhã às ${aula.inicio}. 15–20 min de leitura antes deixam a aula mais produtiva.`,
        peso: 40,
      });
    }
  }

  // Remove repetidas (mesma cadeira + assunto), mantendo a mais importante
  const vistas = new Map();
  for (const s of sugestoes.sort((a, b) => b.peso - a.peso)) {
    const chave = `${s.cadeiraId}|${s.assunto.toLowerCase()}`;
    if (!vistas.has(chave)) vistas.set(chave, s);
  }
  return [...vistas.values()].slice(0, cfg.max);
}
