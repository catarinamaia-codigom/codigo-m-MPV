// Importar do Anki para o Método Catarina.
//   • Baralho .apkg / coleção .colpkg: perguntas simples, omissão de palavras
//     (cloze), oclusão de imagem (nativa e do complemento antigo), imagens,
//     baralhos -> cadeira/assunto e, se quiser, o progresso de cada cartão.
//   • Texto exportado (.txt/.csv): frente ⇥ verso, como antes.
// Tudo no navegador: sem servidor, sem IA. Reimportar não duplica (anki_id).

import { esc } from '../util/texto.js';
import { abrirModal, fecharModal, aviso } from '../ui/componentes.js';
import { adicionarVarias, avisarMudanca, emSimulacao, novoId } from '../dados/dataSource.js';
import { guardarArquivo } from '../dados/arquivos.js';
import { abrirApkg, desenharPlano } from '../dados/apkg.js';
import { montarCartoes, sugerirDestino } from '../regras/anki.js';
import { opcoesCadeira } from './formularios.js';

const NOMES_TIPO = { basico: 'simples', cloze: 'omissão de palavras', oclusao: 'oclusão de imagem', 'oclusao-complemento': 'oclusão (complemento antigo)' };
const LOTE = 20; // cartões gravados por vez na planilha

export function importarAnki(m) {
  abrirModal('Importar do Anki', `
    <div class="formulario importar-anki">
      <p class="formulario-intro">No Anki: <b>Arquivo › Exportar › “Pacote de baralho do Anki (.apkg)”</b>, marcando “Incluir mídia” (e “Incluir agendamento”, se quiser trazer o progresso). Também aceita o backup da coleção (.colpkg) e o texto puro (.txt). Perguntas simples, omissão de palavras e oclusão de imagem viram cartões do Método Catarina, entrando como <b>automáticos</b>: os que você escreve continuam com prioridade.</p>
      <div class="campo largo"><label for="anki-arq">Arquivo do Anki</label><input id="anki-arq" type="file" accept=".apkg,.colpkg,.txt,.tsv,.csv"></div>
      <div id="anki-corpo"></div>
      <p class="formulario-erro" role="alert" hidden></p>
      <p class="anki-progresso meta" aria-live="polite"></p>
      <div class="formulario-acoes"><button class="btn" data-fechar>Fechar</button><button class="btn btn-principal" id="anki-ok" disabled>Importar</button></div>
    </div>`);
  const modal = document.querySelector('.modal');
  modal.classList.add('modal-largo');
  const corpo = modal.querySelector('#anki-corpo');
  const erro = modal.querySelector('.formulario-erro');
  const progresso = modal.querySelector('.anki-progresso');
  const botao = modal.querySelector('#anki-ok');
  const mostrarErro = (t) => {
    erro.textContent = t;
    erro.hidden = !t;
  };
  let importar = null; // função da importação escolhida

  modal.querySelector('#anki-arq').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    mostrarErro('');
    corpo.innerHTML = '';
    botao.disabled = true;
    if (!arquivo) return;
    if (/\.(apkg|colpkg)$/i.test(arquivo.name)) {
      progresso.textContent = 'Lendo o baralho…';
      try {
        importar = await prepararApkg(m, arquivo, corpo);
        botao.disabled = !importar;
      } catch (falha) {
        console.error(falha);
        mostrarErro(falha.message);
      }
      progresso.textContent = '';
    } else {
      importar = await prepararTexto(m, arquivo, corpo);
      botao.disabled = !importar;
    }
  });

  let rodando = false;
  let parar = false;
  botao.addEventListener('click', async () => {
    if (rodando) {
      parar = true;
      botao.textContent = 'Parando…';
      return;
    }
    mostrarErro('');
    rodando = true;
    parar = false;
    botao.textContent = 'Parar';
    try {
      const n = await importar({ progresso: (t) => (progresso.textContent = t), parar: () => parar, erro: mostrarErro });
      if (n !== null) {
        avisarMudanca();
        fecharModal();
        aviso(`${n} cartão(ões) importado(s)${emSimulacao() ? ' (simulação: somem ao recarregar)' : ''}.`);
      }
    } catch (falha) {
      console.error(falha);
      mostrarErro(`${falha.message} O que já foi importado ficou salvo; importe de novo para continuar de onde parou.`);
      avisarMudanca();
    } finally {
      rodando = false;
      botao.textContent = 'Importar';
    }
  });
}

/** Baralho .apkg/.colpkg: lê, mostra o resumo e devolve a função que importa. */
async function prepararApkg(m, arquivo, corpo) {
  const { colecao, midia } = await abrirApkg(arquivo);
  const todos = montarCartoes(colecao);
  const jaTem = new Set(m.cartoes.map((c) => c.ankiId).filter(Boolean));
  const novos = todos.filter((c) => !jaTem.has(c.ankiId));
  if (!todos.length) {
    corpo.innerHTML = '<p class="vazio">Não encontrei cartões neste arquivo.</p>';
    return null;
  }
  const porTipo = Object.entries(novos.reduce((a, c) => ((a[c.tipo] = (a[c.tipo] || 0) + 1), a), {}));
  const decks = [...new Set(novos.map((c) => c.deck))].sort();
  const suspensos = novos.filter((c) => c.suspenso).length;
  const estudados = novos.filter((c) => c.agendamento).length;
  const cadeiras = m.cadeiras.map((c) => ({ id: c.id, nome: c.nome }));
  const opcoes = opcoesCadeira(m, { vazio: true, textoVazio: '— escolha a cadeira —' });

  corpo.innerHTML = `
    <p class="anki-resumo"><b>${todos.length}</b> cartões no arquivo${porTipo.length ? `: ${porTipo.map(([t, n]) => `${n} ${NOMES_TIPO[t] ?? t}`).join(', ')}` : ''}.
      ${todos.length - novos.length ? `<br>${todos.length - novos.length} já estavam no Código M e serão pulados.` : ''}
      ${midia.size ? `<br>${midia.size} imagem(ns) no pacote.` : ''}</p>
    ${novos.length ? `
      <p class="rotulo-lado">Para onde vai cada baralho</p>
      <div class="anki-decks">${decks.map((d, i) => {
        const s = sugerirDestino(d, cadeiras);
        const n = novos.filter((c) => c.deck === d).length;
        return `<div class="anki-deck">
          <span class="anki-deck-nome" title="${esc(d)}">${esc(d.split('::').slice(-2).join(' › ') || 'Sem baralho')} <small class="meta">${n}</small></span>
          <select data-deck-cad="${i}" aria-label="Cadeira de ${esc(d)}">${opcoes.map((o) => `<option value="${esc(o.valor)}" ${o.valor === s.cadeiraId ? 'selected' : ''}>${esc(o.texto)}</option>`).join('')}</select>
          <input data-deck-ass="${i}" value="${esc(s.assunto)}" placeholder="Assunto (opcional)" aria-label="Assunto de ${esc(d)}">
        </div>`;
      }).join('')}</div>
      <label class="opcao-check"><input type="checkbox" id="anki-progresso" ${estudados ? 'checked' : 'disabled'}><span>Trazer o progresso do Anki (${estudados} cartão(ões) já estudado(s) continuam de onde pararam)</span></label>
      ${suspensos ? `<label class="opcao-check"><input type="checkbox" id="anki-suspensos"><span>Incluir os ${suspensos} cartão(ões) suspenso(s)</span></label>` : ''}
      <p class="rotulo-lado">Prévia</p>
      <div class="anki-previa" id="anki-previa"><p class="meta">Desenhando…</p></div>` : '<p class="vazio">Todos os cartões deste arquivo já foram importados.</p>'}`;
  if (!novos.length) return null;

  // Prévia: até 3 cartões, com oclusão primeiro (se houver)
  const exemplos = [...novos.filter((c) => c.tipo.startsWith('oclusao')).slice(0, 1), ...novos.filter((c) => !c.tipo.startsWith('oclusao'))].slice(0, 3);
  Promise.all(exemplos.map(async (c) => {
    const [f, v] = await Promise.all([desenharPlano(c.imagemFrente, midia, 'f'), desenharPlano(c.imagemVerso, midia, 'v')]);
    return `<div class="anki-exemplo"><span class="tag">${esc(NOMES_TIPO[c.tipo] ?? c.tipo)}</span>
      <div><b>${esc(c.frente.slice(0, 160))}</b>${f ? `<img src="${URL.createObjectURL(f)}" alt="Frente">` : ''}</div>
      <div class="meta">${esc(c.verso.slice(0, 160)) || '—'}${v ? `<img src="${URL.createObjectURL(v)}" alt="Verso">` : ''}</div></div>`;
  }))
    .then((html) => (document.getElementById('anki-previa').innerHTML = html.join('')))
    .catch((e) => (document.getElementById('anki-previa').innerHTML = `<p class="meta">Prévia indisponível: ${esc(e.message)}</p>`));

  return async ({ progresso, parar, erro }) => {
    const destino = new Map(decks.map((d, i) => [d, { cadeiraId: corpo.querySelector(`[data-deck-cad="${i}"]`).value, assunto: corpo.querySelector(`[data-deck-ass="${i}"]`).value.trim() }]));
    const semCadeira = decks.filter((d) => !destino.get(d).cadeiraId);
    if (semCadeira.length) {
      erro(`Escolha a cadeira de: ${semCadeira.map((d) => d.split('::').pop()).join(', ')}.`);
      return null;
    }
    const comProgresso = corpo.querySelector('#anki-progresso')?.checked;
    const comSuspensos = corpo.querySelector('#anki-suspensos')?.checked;
    const fila = novos.filter((c) => comSuspensos || !c.suspenso);
    const enviadas = new Map(); // mesma imagem no mesmo lugar: envia uma vez só
    const imagem = async (plano, lado, d, id) => {
      if (!plano) return '';
      const chave = `${JSON.stringify(plano)}|${d.cadeiraId}|${d.assunto}`;
      if (!enviadas.has(chave)) {
        const arquivo = await desenharPlano(plano, midia, `anki-${lado}`);
        const r = arquivo && (await guardarArquivo(m, arquivo, { cadeiraId: d.cadeiraId, assunto: d.assunto, categoria: 'cartao', tipo: `Cartao ${lado}`, sufixo: id }));
        enviadas.set(chave, r?.id ?? '');
      }
      return enviadas.get(chave);
    };
    let lote = [];
    let feitos = 0;
    const gravar = async () => {
      if (!lote.length) return;
      await adicionarVarias('Cartoes', lote, { silencioso: true });
      feitos += lote.length;
      lote = [];
    };
    for (const [i, c] of fila.entries()) {
      if (parar()) break;
      progresso(`Cartão ${i + 1} de ${fila.length}${c.imagemFrente || c.imagemVerso ? ' (guardando imagens…)' : ''}`);
      const d = destino.get(c.deck);
      const id = novoId('C');
      const ag = comProgresso ? c.agendamento : null;
      lote.push({
        id, criado: m.hoje, cadeira_id: d.cadeiraId, assunto: d.assunto, frente: c.frente, verso: c.verso,
        fonte: `Anki · ${c.deck}`, origem: 'Anki', anki_id: c.ankiId,
        vence: ag?.vence ?? m.hoje, estabilidade: ag?.estabilidade ?? '', dificuldade: ag?.dificuldade ?? '',
        revisoes: ag?.revisoes ?? 0, lapsos: ag?.lapsos ?? 0, ultima: ag?.ultima ?? '',
        imagem_frente: await imagem(c.imagemFrente, 'frente', d, id),
        imagem_verso: await imagem(c.imagemVerso, 'verso', d, id),
      });
      if (lote.length >= LOTE) await gravar();
    }
    await gravar();
    if (parar()) aviso(`Parado: ${feitos} cartão(ões) importado(s). Importe de novo para continuar.`);
    return feitos;
  };
}

/** Texto exportado do Anki (frente ⇥ verso por linha). */
async function prepararTexto(m, arquivo, corpo) {
  const limpar = (t) => t.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  const linhas = (await arquivo.text())
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => (l.includes('\t') ? l.split('\t') : l.split(';')))
    .filter((p) => p.length >= 2 && limpar(p[0]))
    .map((p) => ({ frente: limpar(p[0]), verso: limpar(p[1]) }));
  if (!linhas.length) {
    corpo.innerHTML = '<p class="vazio">Não encontrei cartões neste arquivo.</p>';
    return null;
  }
  corpo.innerHTML = `
    <p class="anki-resumo"><b>${linhas.length}</b> cartão(ões) de texto. Primeiro: “${esc(linhas[0].frente.slice(0, 120))}”</p>
    <div class="formulario-campos">
      <div class="campo"><label for="anki-cad">Cadeira</label><select id="anki-cad">${opcoesCadeira(m).map((o) => `<option value="${esc(o.valor)}">${esc(o.texto)}</option>`).join('')}</select></div>
      <div class="campo"><label for="anki-ass">Assunto <small>(opcional)</small></label><input id="anki-ass"></div>
    </div>`;
  return async () => {
    const cad = corpo.querySelector('#anki-cad').value;
    const ass = corpo.querySelector('#anki-ass').value.trim();
    await adicionarVarias('Cartoes', linhas.map((l) => ({
      id: novoId('C'), criado: m.hoje, cadeira_id: cad, assunto: ass, frente: l.frente, verso: l.verso,
      fonte: 'Anki', origem: 'Anki', vence: m.hoje, revisoes: 0, lapsos: 0,
    })), { silencioso: true });
    return linhas.length;
  };
}
