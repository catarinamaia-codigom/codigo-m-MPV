// Tela CONFIGURAÇÕES — conexão com a planilha, situação de cada integração
// (o que está ligado e o que ainda depende de credencial ou decisão) e a
// migração do Código M antigo.

import { esc } from '../util/texto.js';
import { formatoLongo } from '../util/datas.js';
import { icone } from '../ui/icones.js';
import { aviso } from '../ui/componentes.js';
import { emSimulacao, linkPlanilha, adicionarVarias, mensagemCarga } from '../dados/dataSource.js';
import * as google from '../dados/google.js';
import { converterBackup } from '../regras/importarAntigo.js';

const INTEGRACOES = (m) => [
  ['Planilha Código M - Dados', emSimulacao() ? (mensagemCarga() ? 'falha' : 'desligada') : 'ligada',
    emSimulacao() ? (mensagemCarga() || 'Entre com Google no menu lateral.') : 'Leitura e gravação pela API do Google Sheets (grátis), com o login feito no navegador.'],
  ['Atalhos de IA', 'manual', 'Copiam um prompt pronto e abrem o chat. Usa a sua assinatura do chat; nenhuma API paga é chamada.'],
  ['Importar do Anki', 'ligada', 'Arquivo de texto exportado do Anki, no Método Catarina.'],
  ['Envio de arquivos ao Drive', 'pendente', 'Precisa da permissão “drive.file” no login e da pasta-raiz de Medicina escolhida por você. Hoje o Código M guarda links.'],
  ['Google Agenda (2 sentidos)', 'pendente', 'Próxima etapa: calendário “Medicina - Código M” e botão para abrir o evento de cada aula. Precisa da permissão de Agenda.'],
  ['Transcrição, OCR e IA por API', 'não usar', 'Exigiriam serviço pago. Fica de fora até você decidir.'],
];

const COR = { ligada: 'ok', manual: '', pendente: 'alerta', desligada: 'alerta', falha: 'ruim', 'não usar': '' };

export function render(el, m) {
  el.innerHTML = `
    <header class="cabecalho"><p class="sobretitulo">${esc(m.config.periodo)} · ${esc(m.config.semestre)} · Turma ${esc(m.config.turma)} (vê ${esc(m.config.turmasVisiveis.join(', '))})</p><h1>Configurações</h1></header>
    <div class="grade-2">
      <section class="cartao"><header class="cartao-topo"><h2>${icone('pessoa')}<span>Conta e dados</span></h2></header>
        <div class="cartao-corpo">
          ${emSimulacao()
            ? `<p>Você está no <b>modo simulação</b>: dá para testar tudo, mas nada fica salvo.</p>${google.configurado() ? `<button class="btn btn-google" data-entrar>${icone('pessoa')} Entrar com Google</button>` : ''}`
            : `<p>${icone('checkCirculo', 'ic-mini')} Conectada à planilha. Tudo o que você registra vai para lá.</p><p><a class="btn" href="${esc(linkPlanilha())}" target="_blank" rel="noopener">Abrir planilha ${icone('externo', 'ic-mini')}</a></p>`}
          <p class="nota">O que muda com frequência (atalhos e prompts de IA, motivos, tipos de material, regras de nota e de revisão) fica na aba <b>Config</b> da planilha. Hoje: ${esc(formatoLongo(m.hoje))}. Para testar outra data, acrescente <code>?hoje=AAAA-MM-DD</code> ao endereço.</p>
        </div></section>
      <section class="cartao"><header class="cartao-topo"><h2>${icone('arquivo')}<span>Trazer dados do Código M antigo</span></h2></header>
        <div class="cartao-corpo">
          <p>No Código M antigo, abra <b>Conexões e dados → Exportar backup completo</b> e escolha o arquivo aqui. Dúvidas, tarefas, notas e links vêm para a planilha; nada é apagado. Arquivos que estavam só no navegador precisam ser reenviados.</p>
          <input type="file" id="backup" accept=".json,application/json">
          <div id="backup-previa" class="previa-import"></div>
        </div></section>
    </div>
    <section class="cartao"><header class="cartao-topo"><h2>${icone('configuracoes')}<span>Integrações</span></h2></header>
      <div class="cartao-corpo"><table class="tabela">
        <thead><tr><th>Integração</th><th>Situação</th><th>Detalhe</th></tr></thead>
        <tbody>${INTEGRACOES(m).map(([n, s, d]) => `<tr><td class="t-forte">${esc(n)}</td><td><span class="tag ${COR[s] ? `tag-${COR[s]}` : ''}">${esc(s)}</span></td><td class="meta">${esc(d)}</td></tr>`).join('')}</tbody>
      </table></div></section>
    <section class="cartao"><header class="cartao-topo"><h2>${icone('ia')}<span>Atalhos de IA (aba Config)</span></h2></header>
      <div class="cartao-corpo"><ul class="lista-simples empilhada">${m.config.atalhosIA.map((a) => `<li><b>${esc(a.nome)}</b><span class="meta">${esc(a.prompt.slice(0, 160))}${a.prompt.length > 160 ? '…' : ''}</span></li>`).join('')}</ul></div></section>`;

  el.querySelector('[data-entrar]')?.addEventListener('click', () => document.getElementById('entrar')?.click());
  el.querySelector('#backup').addEventListener('change', async (e) => {
    const previa = el.querySelector('#backup-previa');
    let json;
    try {
      json = JSON.parse(await e.target.files[0].text());
    } catch {
      previa.innerHTML = '<p class="alerta-texto">Não consegui ler este arquivo como backup (JSON).</p>';
      return;
    }
    const r = converterBackup(json, m);
    previa.innerHTML = `
      <p><b>${r.total}</b> registro(s) novos: ${Object.entries(r.linhas).filter(([, l]) => l.length).map(([a, l]) => `${l.length} em ${a}`).join(', ') || 'nada novo'}.</p>
      ${r.semCorrespondencia.length ? `<p class="alerta-texto">Cadeiras sem correspondência (ficam com o nome antigo para você revisar na planilha): ${esc(r.semCorrespondencia.join(', '))}.</p>` : ''}
      ${r.total ? `<button class="btn btn-principal" data-importar>Importar ${emSimulacao() ? '(simulação)' : 'para a planilha'}</button>` : ''}`;
    previa.querySelector('[data-importar]')?.addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      ev.target.textContent = 'Importando…';
      try {
        for (const [aba, linhas] of Object.entries(r.linhas)) if (linhas.length) await adicionarVarias(aba, linhas);
        aviso(`${r.total} registros importados.`);
      } catch (falha) {
        ev.target.disabled = false;
        ev.target.textContent = 'Tentar de novo';
        aviso(falha.message);
      }
    });
  });
}
