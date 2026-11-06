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
import { testar as testarDrive, compartilhar } from '../dados/drive.js';
import { GOOGLE } from '../config.js';
import { adicionar } from '../dados/dataSource.js';
import { papelAtual } from '../dados/arquivos.js';

const INTEGRACOES = (m) => [
  ['Planilha Código M - Dados', emSimulacao() ? (mensagemCarga() ? 'falha' : 'desligada') : 'ligada',
    emSimulacao() ? (mensagemCarga() || 'Entre com Google no menu lateral.') : 'Leitura e gravação pela API do Google Sheets (grátis), com o login feito no navegador.'],
  ['Atalhos de IA', 'manual', 'Copiam um prompt pronto e abrem o chat. Usa a sua assinatura do chat; nenhuma API paga é chamada.'],
  ['Importar do Anki', 'ligada', 'Arquivo de texto exportado do Anki, no Método Catarina.'],
  ['Google Drive (pastas e arquivos)', emSimulacao() ? 'desligada' : google.temDrive() ? 'ligada' : 'falta permissão',
    google.temDrive() ? 'Cria as pastas que faltam e guarda cada arquivo no lugar certo de 20-Medicina. Use “Testar Drive” abaixo.' : 'Ative a API do Drive no Google Cloud e entre de novo marcando o Drive (passo a passo abaixo).'],
  ['Google Agenda (2 sentidos)', 'pendente', 'Próxima etapa: calendário “Medicina - Código M” e botão para abrir o evento de cada aula. Precisa da permissão de Agenda.'],
  ['Transcrição, OCR e IA por API', 'não usar', 'Exigiriam serviço pago. Fica de fora até você decidir.'],
];

const COR = { ligada: 'ok', manual: '', pendente: 'alerta', desligada: 'alerta', falha: 'ruim', 'falta permissão': 'alerta', 'não usar': '' };

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
    <section class="cartao"><header class="cartao-topo"><h2>${icone('nuvem')}<span>Drive</span></h2>${!emSimulacao() ? '<button class="btn" data-testar-drive>Testar Drive</button>' : ''}</header>
      <div class="cartao-corpo">
        <p id="drive-resultado" class="meta">${google.temDrive() ? 'Permissão do Drive concedida neste login.' : 'Ainda sem a permissão do Drive neste login.'}</p>
        <p>Onde cada coisa vai (dentro de <b>Meu Drive › Estudio-IA › 20-Medicina</b>):</p>
        <ul class="lista-simples empilhada">
          <li><b>Material de um assunto</b><span class="meta">Conhecimento/[Cadeira]/[Assunto]/ · da turma em [Turma]</span></li>
          <li><b>Print de questão, cartão ou dúvida</b><span class="meta">Conhecimento/[Cadeira]/[Assunto]/[Caderno de erros] · [Cartoes] · [Duvidas]</span></li>
          <li><b>Material sem assunto</b><span class="meta">Conhecimento/[Cadeira]/[_A-classificar]/ — ao escolher o assunto depois, o arquivo é movido</span></li>
          <li><b>Material de avaliação</b><span class="meta">Periodos/[1M] [2026.2]/[Cadeira]/[Avaliacoes]/</span></li>
        </ul>
        <details class="passos"><summary>Como ligar a permissão do Drive (uma vez só)</summary>
          <ol>
            <li>Abra <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener">Google Cloud › Google Drive API</a> no projeto do Código M e clique em <b>Ativar</b>.</li>
            <li>Em <b>Google Auth Platform › Acesso a dados</b>, clique em <b>Adicionar ou remover escopos</b>, marque <code>…/auth/drive</code> e salve.</li>
            <li>Em <b>Público-alvo</b>, confira que o app está <b>Em teste</b> e que o seu e-mail está nos usuários de teste.</li>
            <li>Aqui no Código M: <b>Sair</b> e <b>Entrar com Google</b> de novo. Marque a caixa do Drive. Se aparecer “o Google não verificou este app”, clique em <b>Avançado › Acessar</b> (o app é seu).</li>
          </ol>
        </details>
      </div></section>
    <section class="cartao"><header class="cartao-topo"><h2>${icone('pessoa')}<span>Convidar pessoas</span></h2></header>
      <div class="cartao-corpo">
        <p class="meta">A pessoa recebe um e-mail do Google e passa a <b>ver e baixar</b> a sua planilha e a pasta 20-Medicina. Ela não consegue editar nem excluir arquivos. No Código M, entra com o próprio Google e vê os seus dados só para leitura.</p>
        <form class="convite" data-convite>
          <input type="email" name="email" required placeholder="email@exemplo.com" aria-label="E-mail da pessoa" class="filtro-texto">
          <input name="nome" required placeholder="Nome (ex.: Carolaine)" aria-label="Nome" class="filtro-texto convite-nome">
          <input name="sigla" placeholder="Sigla (ex.: L)" maxlength="3" aria-label="Sigla nos arquivos" class="filtro-texto convite-sigla">
          <select name="papel" class="filtro-select" aria-label="Acesso"><option value="leitura">Só ver e baixar</option><option value="colaboradora">Colaboradora: ver, baixar e enviar materiais</option></select>
          <button class="btn btn-principal" type="submit" ${google.temDrive() ? '' : 'disabled title="Precisa da permissão do Drive"'}>Enviar convite</button>
        </form>
        <p class="meta" id="convite-resultado"></p>
        ${m.convites.length ? `<ul class="lista-simples">${m.convites.map((c) => `<li><b>${c.sigla ? `<span class="tag tag-sigla">${esc(c.sigla)}</span> ` : ''}${esc(c.nome || c.email)}</b><span class="meta">${esc(c.email)} · ${esc(c.papel)} · ${c.convidadoEm ? esc(c.convidadoEm.split('-').reverse().join('/')) : ''}</span></li>`).join('')}</ul>` : ''}
        <details class="passos"><summary>Etapa manual no Google Cloud (para cada convidado)</summary>
          <ol>
            <li>Abra <a href="https://console.cloud.google.com/auth/audience" target="_blank" rel="noopener">Google Cloud › Google Auth Platform › Público-alvo</a> no projeto do Código M.</li>
            <li>Em <b>Usuários de teste</b>, clique em <b>Adicionar usuários</b>, cole o e-mail convidado e salve. Sem isso, o Google não deixa a pessoa entrar enquanto o app está “Em teste” (limite de 100 pessoas).</li>
            <li>Pronto: o convite enviado aqui já dá a ela acesso de leitura à planilha e à pasta. Na primeira entrada ela verá o aviso “o Google não verificou este app” e clica em <b>Avançado › Acessar</b>.</li>
            <li>Para tirar o acesso: no Drive, em <b>Compartilhar</b> da planilha e da pasta 20-Medicina, remova o e-mail; e tire-o dos usuários de teste.</li>
          </ol>
        </details>
      </div></section>
    ${papelAtual(m).papel === 'dona' ? `<section class="cartao"><header class="cartao-topo"><h2>${icone('nuvem')}<span>Caixa de envio das colaboradoras</span></h2>
      <span class="tag ${m.config.caixaUrl ? 'tag-ok' : 'tag-alerta'}">${m.config.caixaUrl ? 'ligada' : 'desligada'}</span></header>
      <div class="cartao-corpo">
        <p class="meta">Quem é colaboradora envia arquivos pelo Código M; um script na <b>sua</b> conta grava no <b>seu</b> Drive, na pasta do assunto, com a sigla dela no início do nome (ex.: <code>[L] [1M] [Resumo] [Anatomia] …</code>). Ela continua só com leitura. Limite de 35 MB por arquivo.</p>
        <form class="convite" data-caixa><input name="url" type="url" required class="filtro-texto" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(m.config.caixaUrl)}" aria-label="Endereço da caixa de envio"><button class="btn btn-principal" type="submit">Salvar endereço</button></form>
        <details class="passos"><summary>Como ligar a caixa de envio (uma vez só, uns 5 minutos)</summary>
          <ol>
            <li>Abra <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com › Novo projeto</a> com a <b>sua</b> conta pessoal.</li>
            <li>Apague o que estiver lá, clique em <button class="link-botao" data-copiar-script>copiar o código</button> e cole. Dê o nome “Código M - Caixa de envio” e salve.</li>
            <li>Clique em <b>Implantar › Nova implantação</b>, tipo <b>App da Web</b>. Em “Executar como” escolha <b>Eu</b>; em “Quem pode acessar”, <b>Qualquer pessoa</b> (o site precisa disso para falar com o script; quem entra é conferido pelo login do Google e pela aba Convites). Implantar.</li>
            <li>Autorize o acesso (é a sua conta acessando o seu Drive e a sua planilha). Se aparecer “app não verificado”, clique em <b>Avançado › Acessar</b>.</li>
            <li>Copie o <b>URL do app da Web</b> (termina em <code>/exec</code>), cole acima e salve.</li>
          </ol>
        </details>
      </div></section>` : ''}
    <section class="cartao"><header class="cartao-topo"><h2>${icone('ia')}<span>Atalhos de IA (aba Config)</span></h2></header>
      <div class="cartao-corpo"><ul class="lista-simples empilhada">${m.config.atalhosIA.map((a) => `<li><b>${esc(a.nome)}</b><span class="meta">${esc(a.prompt.slice(0, 160))}${a.prompt.length > 160 ? '…' : ''}</span></li>`).join('')}</ul></div></section>`;

  el.querySelector('[data-entrar]')?.addEventListener('click', () => document.getElementById('entrar')?.click());
  el.querySelector('[data-convite]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const botao = e.target.querySelector('button');
    const email = f.email.value.trim().toLowerCase();
    const papel = f.papel.value;
    const nome = f.nome.value.trim();
    const sigla = (f.sigla.value.trim() || nome.charAt(0)).toUpperCase();
    const r = el.querySelector('#convite-resultado');
    if (m.convites.some((c) => c.email.toLowerCase() === email)) {
      r.textContent = 'Este e-mail já foi convidado.';
      return;
    }
    botao.disabled = true;
    r.textContent = 'Enviando convite…';
    const site = location.origin + location.pathname;
    const msg = `Catarina convidou você para o Código M (estúdio de Medicina). Acesse ${site} e entre com este e-mail do Google. Você pode ver e baixar os materiais${papel === 'colaboradora' ? ' e enviar novos materiais pelo botão "+ Registrar › Material"' : ''}, sem editar nem excluir.`;
    try {
      await compartilhar(GOOGLE.planilhaId, email, msg);
      await compartilhar(GOOGLE.pastas.medicina, email, msg);
      await adicionar('Convites', { email, nome, sigla, convidado_em: m.hoje, papel, status: 'Convidado', obs: 'Falta adicionar nos usuários de teste do Google Cloud' });
      aviso(`Convite enviado para ${email}. Falta a etapa manual no Google Cloud.`);
    } catch (falha) {
      r.innerHTML = `<b class="alerta-texto">Não enviou:</b> ${esc(falha.message)}`;
      botao.disabled = false;
    }
  });
  el.querySelector('[data-caixa]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await adicionar('Config', { grupo: 'caixa', chave: 'url', valor: e.target.elements.url.value.trim(), obs: 'Caixa de envio das colaboradoras' });
      aviso('Endereço da caixa de envio salvo.');
    } catch (falha) {
      aviso(falha.message);
    }
  });
  el.querySelector('[data-copiar-script]')?.addEventListener('click', async () => {
    const codigo = await (await fetch('ferramentas/caixa-de-envio.gs', { cache: 'no-cache' })).text();
    await navigator.clipboard.writeText(codigo);
    aviso('Código copiado. Cole no editor do Apps Script.');
  });
  el.querySelector('[data-testar-drive]')?.addEventListener('click', async (e) => {
    const r = el.querySelector('#drive-resultado');
    e.target.disabled = true;
    r.textContent = 'Testando…';
    try {
      const nome = await testarDrive();
      r.innerHTML = `<b class="ok-texto">Drive funcionando:</b> acesso de escrita a “${esc(nome)}”.`;
    } catch (falha) {
      r.innerHTML = `<b class="alerta-texto">Não funcionou:</b> ${esc(falha.message)}`;
    }
    e.target.disabled = false;
  });
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
