// Converte o backup do Código M antigo (MVP feito no ChatGPT, que guardava
// tudo no navegador) em linhas das abas da planilha. Função pura.
// IDs antigos são mantidos com o prefixo "ANT-" (reimportar não duplica).
// Cadeira sem correspondência fica com o nome antigo em cadeira_id, para
// revisão na planilha — nada é descartado.

const chave = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function mapearCadeira(m, nome) {
  const k = chave(nome);
  if (!k) return { id: '', achou: true };
  const todos = [...m.cadeiras, ...m.modulos];
  const exato = todos.find((c) => chave(c.nome) === k || chave(c.id) === k);
  if (exato) return { id: exato.id, achou: true };
  const parcial = todos.find((c) => chave(c.nome).startsWith(k) || k.startsWith(chave(c.nome).split(' ')[0]) || chave(c.nome).split(' ')[0] === k.split(' ')[0]);
  if (parcial) return { id: parcial.id, achou: true };
  if (k === 'pessoal') return { id: '', achou: true };
  return { id: String(nome), achou: false };
}

const iso = (d) => (/^\d{4}-\d{2}-\d{2}/.test(String(d ?? '')) ? String(d).slice(0, 10) : '');

export function converterBackup(json, m) {
  const st = json?.state ?? json ?? {};
  const existe = (aba, id) => (m[aba] ?? []).some((x) => x.id === id);
  const semCorrespondencia = new Set();
  const cad = (nome) => {
    const r = mapearCadeira(m, nome);
    if (!r.achou) semCorrespondencia.add(String(nome));
    return r.id;
  };
  const linhas = { Estudos: [], Pendencias: [], Duvidas: [], Notas: [], Materiais: [] };

  for (const t of st.tasks ?? []) {
    const id = `ANT-${t.id}`;
    if (iso(t.date)) {
      if (!existe('estudos', id)) linhas.Estudos.push({ id, data: iso(t.date), cadeira_id: t.personal ? '' : cad(t.chair), assunto: t.topic ?? '', atividade: t.title || t.action || 'Estudo', feito: Boolean(t.done) });
    } else if (!existe('pendencias', id)) {
      linhas.Pendencias.push({ id, descricao: t.title || t.action || 'Tarefa sem data', cadeira_id: t.personal ? '' : cad(t.chair), prazo: '', status: t.done ? 'Feita' : 'Aberta', prioridade: 'Média' });
    }
  }
  for (const d of st.doubts ?? []) {
    const id = `ANT-${d.id}`;
    if (existe('duvidas', id) || !d.question) continue;
    const link = Object.values(d.links ?? {}).find(Boolean) ?? '';
    linhas.Duvidas.push({ id, criada: iso(d.created), cadeira_id: cad(d.chair), assunto: d.topic ?? '', pergunta: d.question, motivo: '', tentativa: '', resposta: d.answer ?? '', fonte: '', link, status: d.resolved ? 'Sanada' : 'Aberta', sanada_em: '' });
  }
  for (const [chaveGrupo, itens] of Object.entries(st.grades ?? {})) {
    for (const g of itens ?? []) {
      const id = `ANT-${g.id}`;
      if (existe('notas', id)) continue;
      linhas.Notas.push({ id, cadeira_id: cad(chaveGrupo), avaliacao_id: '', nome: g.name || 'Avaliação', vale: g.max ?? 10, peso: '', nota: g.score ?? '', bonus: '', obs: g.date ? `data ${g.date}` : '' });
    }
  }
  for (const x of st.materials ?? []) {
    const id = `ANT-${x.id}`;
    if (existe('materiais', id)) continue;
    const link = x.url || x.link || '';
    linhas.Materiais.push({
      id, criado: iso(x.created || x.date), cadeira_id: cad(x.chair), assunto: x.topic ?? '', tipo: x.type || x.kind || 'Arquivo',
      titulo: x.title || x.name || link || 'Material', link, origem: x.source === 'turma' || x.shared ? 'Turma' : 'Minha', copiado: '',
      obs: link ? '' : 'Arquivo estava só no navegador do Código M antigo: reenviar ao Drive',
    });
  }
  const total = Object.values(linhas).reduce((s, l) => s + l.length, 0);
  return { linhas, total, semCorrespondencia: [...semCorrespondencia] };
}
