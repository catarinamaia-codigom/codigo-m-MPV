// Gravador de áudio de aula: grava pelo microfone do navegador (sem
// aplicativo, sem custo) e anexa como material "Gravação de aula" no Drive,
// na pasta do assunto. Fica numa pílula flutuante: dá para navegar pelo site
// enquanto grava. Enquanto grava, a tela não apaga e o navegador avisa antes
// de fechar a aba.

import { esc } from '../util/texto.js';
import { formatoCurto } from '../util/datas.js';
import { icone } from './icones.js';
import { aviso } from './componentes.js';
import { abrirFormulario } from './formulario.js';
import { adicionar, novoId } from '../dados/dataSource.js';
import { guardarArquivo, previaDestino } from '../dados/arquivos.js';
import { nomeCadeira } from '../dados/consultas.js';
import { assuntosDaCadeira } from '../regras/dominio.js';

let rec = null; // gravação atual
const TIPOS = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];
const extensao = (tipo) => (/mp4/.test(tipo) ? 'm4a' : /ogg/.test(tipo) ? 'ogg' : 'webm');
const relogio = (ms) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
const decorrido = () => rec.acumulado + (rec.pausado ? 0 : Date.now() - rec.inicioTrecho);
const avisarSaida = (e) => {
  e.preventDefault();
  e.returnValue = '';
};

/** Começa a gravar. contexto = {cadeiraId, assunto} da tela aberta. */
export async function gravarAudio(m, { cadeiraId = '', assunto = '' } = {}) {
  if (rec) return aviso(rec.blob ? 'Há uma gravação esperando: salve ou descarte antes de começar outra.' : 'Já há uma gravação em andamento.');
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return aviso('Este navegador não grava áudio. Use o Chrome, o Edge ou o Safari atualizados.');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    return aviso('Não consegui usar o microfone. Permita o acesso ao microfone para o Código M e tente de novo.');
  }
  const tipo = TIPOS.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
  const mr = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: 48000 });
  rec = { m, contexto: { cadeiraId, assunto }, mr, stream, partes: [], acumulado: 0, inicioTrecho: Date.now(), pausado: false, blob: null, inicio: m.hoje };
  mr.ondataavailable = (e) => e.data.size && rec?.partes.push(e.data);
  mr.onstop = () => {
    if (!rec) return;
    rec.blob = new Blob(rec.partes, { type: mr.mimeType || tipo || 'audio/webm' });
    rec.stream.getTracks().forEach((t) => t.stop());
    soltarTela();
    window.removeEventListener('beforeunload', avisarSaida);
    desenhar();
    salvar();
  };
  mr.start(10_000); // entrega um pedaço a cada 10 s
  window.addEventListener('beforeunload', avisarSaida);
  manterTelaAcesa();
  desenhar();
  rec.timer = setInterval(() => {
    const t = document.querySelector('.gravador-tempo');
    if (t && rec && !rec.blob) t.textContent = relogio(decorrido());
  }, 500);
}

async function manterTelaAcesa() {
  try {
    rec.trava = await navigator.wakeLock?.request('screen');
  } catch {
    /* sem suporte: tudo bem */
  }
}
function soltarTela() {
  rec?.trava?.release?.().catch(() => {});
}

function desenhar() {
  let el = document.querySelector('.gravador');
  if (!rec) return el?.remove();
  if (!el) {
    el = document.createElement('div');
    el.className = 'gravador';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Gravação de áudio');
    document.body.appendChild(el);
  }
  const onde = [nomeCadeira(rec.m, rec.contexto.cadeiraId), rec.contexto.assunto].filter(Boolean).join(' · ');
  el.classList.toggle('pausado', rec.pausado);
  el.classList.toggle('pronto', Boolean(rec.blob));
  el.innerHTML = rec.blob
    ? `<span class="gravador-icone">${icone('gravacao', 'ic-mini')}</span>
       <span class="gravador-info"><b>Gravação pronta · ${relogio(rec.acumulado)}</b><small>${esc(onde || 'sem assunto')}</small></span>
       <button class="btn btn-principal" data-grav="salvar">Salvar</button>
       <button class="btn" data-grav="descartar">Descartar</button>`
    : `<span class="gravador-ponto" aria-hidden="true"></span>
       <span class="gravador-info"><b class="gravador-tempo">${relogio(decorrido())}</b><small>${rec.pausado ? 'pausado' : 'gravando'}${onde ? ` · ${esc(onde)}` : ''}</small></span>
       <button class="btn" data-grav="pausar">${rec.pausado ? 'Continuar' : 'Pausar'}</button>
       <button class="btn btn-principal" data-grav="parar">Parar</button>`;
  el.querySelectorAll('[data-grav]').forEach((b) => b.addEventListener('click', () => acoes[b.dataset.grav]()));
}

const acoes = {
  pausar() {
    if (rec.pausado) {
      rec.mr.resume();
      rec.inicioTrecho = Date.now();
    } else {
      rec.mr.pause();
      rec.acumulado += Date.now() - rec.inicioTrecho;
    }
    rec.pausado = !rec.pausado;
    desenhar();
  },
  parar() {
    if (!rec.pausado) rec.acumulado += Date.now() - rec.inicioTrecho;
    rec.pausado = true;
    clearInterval(rec.timer);
    rec.mr.stop(); // onstop monta o arquivo e abre "Salvar"
  },
  salvar: () => salvar(),
  descartar() {
    if (!confirm('Descartar esta gravação? Ela não foi salva.')) return;
    rec = null;
    desenhar();
  },
};

/** Formulário para guardar a gravação como material do assunto. */
function salvar() {
  const { m, contexto, blob } = rec;
  const url = URL.createObjectURL(blob);
  const titulo = `Gravação ${contexto.assunto || nomeCadeira(m, contexto.cadeiraId) || 'de aula'} ${formatoCurto(rec.inicio)}`;
  abrirFormulario({
    titulo: 'Salvar gravação',
    intro: `${relogio(rec.acumulado)} de áudio. Ouça antes, se quiser. Fechar esta janela não apaga: a gravação continua no canto da tela até você salvar ou descartar.`,
    campos: [
      { nome: 'titulo', rotulo: 'Título', valor: titulo, obrigatorio: true, largo: true },
      { nome: 'cadeira_id', rotulo: 'Cadeira', tipo: 'select', obrigatorio: true, valor: contexto.cadeiraId,
        opcoes: [{ valor: '', texto: '— escolha —' }, ...m.cadeiras.map((c) => ({ valor: c.id, texto: nomeCadeira(m, c.id) }))] },
      { nome: 'assunto', rotulo: 'Assunto', valor: contexto.assunto, largo: true, dependeDe: 'cadeira_id', sugestoes: (cad) => (cad ? assuntosDaCadeira(m, cad) : []) },
      { nome: 'obs', rotulo: 'Observação', tipo: 'textarea', largo: true },
    ],
    previa: (v) => (v.cadeira_id ? previaDestino(m, { cadeiraId: v.cadeira_id, assunto: v.assunto }) : ''),
    textoBotao: 'Salvar no Drive',
    aoSalvar: async (v, progresso) => {
      const arquivo = new File([blob], `gravacao.${extensao(blob.type)}`, { type: blob.type });
      const r = await guardarArquivo(m, arquivo, { cadeiraId: v.cadeira_id, assunto: v.assunto, tipo: 'Gravacao de aula', progresso });
      await adicionar('Materiais', {
        id: novoId('M'), criado: m.hoje, cadeira_id: v.cadeira_id, assunto: v.assunto, tipo: 'Gravação de aula', titulo: v.titulo,
        link: r.simulado ? r.id : r.link, origem: 'Minha', obs: v.obs, drive_id: r.simulado ? '' : r.id, hash: r.hash ?? '', nome_original: arquivo.name,
      });
      rec = null;
      desenhar();
      aviso(r.simulado ? 'Gravação salva só nesta sessão (simulação).' : `Gravação enviada ao Drive: ${r.destino}`);
    },
  });
  // Player para ouvir antes (inserido uma vez: a prévia do formulário se redesenha a cada tecla)
  const player = Object.assign(document.createElement('audio'), { controls: true, src: url, className: 'gravador-previa' });
  document.querySelector('.modal .formulario')?.prepend(player);
}
