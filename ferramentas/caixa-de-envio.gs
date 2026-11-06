/**
 * Código M — Caixa de envio para colaboradoras.
 *
 * Roda na conta da Catarina (Implantar › App da Web › Executar como: eu;
 * Quem pode acessar: Qualquer pessoa — o login é conferido aqui dentro).
 * A colaboradora envia o arquivo pelo site; este script confere quem ela é,
 * grava o arquivo NO DRIVE DA CATARINA (dona do arquivo) na pasta certa,
 * com a sigla dela no início do nome, e registra na aba Materiais.
 * A colaboradora continua só com acesso de leitura.
 *
 * Gratuito: usa só serviços do Google (Drive, Planilhas, UrlFetch).
 */

// ── Ajuste só se mudar de planilha, de pasta ou de login ─────────────
var PLANILHA_ID = '1GvvNTCEW-EBs0ViZJPJxZrvWPVik08xB4xARQN3JgAg';   // Código M - Dados
var PASTA_CONHECIMENTO_ID = '1TvtWESRwK3WOz2CjzZYpp22pm5MFKDrF';    // 20-Medicina/Conhecimento
var CLIENT_ID = '942435104265-868tju9qfakp1fbhdb4j9ljd61beejvd.apps.googleusercontent.com';  // ID do cliente OAuth do Código M (o mesmo do js/config.js do site)
var LIMITE_MB = 35;

function doGet() {
  return json_({ ok: true, servico: 'Código M · caixa de envio' });
}

function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);
    var email = conferirLogin_(dados.token);
    var pessoa = colaboradora_(email);

    if (!dados.arquivo || !dados.nomeArquivo) throw new Error('Arquivo não recebido.');
    var bytes = Utilities.base64Decode(dados.arquivo);
    if (bytes.length > LIMITE_MB * 1024 * 1024) throw new Error('Arquivo maior que ' + LIMITE_MB + ' MB.');

    var aba = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName('Materiais');
    var cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
    var colHash = cab.indexOf('hash');

    // Mesmo arquivo de novo? Não duplica.
    var hash = String(dados.hash || '');
    if (hash && colHash >= 0 && aba.getLastRow() > 1) {
      var hashes = aba.getRange(2, colHash + 1, aba.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < hashes.length; i++) {
        if (String(hashes[i][0]) === hash) return json_({ ok: true, jaExistia: true });
      }
    }

    // Pasta: Conhecimento/[Cadeira]/[Assunto]/  (sem assunto: [_A-classificar])
    var pasta = garantirPasta_(DriveApp.getFolderById(PASTA_CONHECIMENTO_ID), bloco_(dados.cadeira || 'Sem cadeira'));
    pasta = garantirPasta_(pasta, dados.assunto ? bloco_(dados.assunto) : '[_A-classificar]');

    var nome = '[' + pessoa.sigla + '] ' + String(dados.nomeArquivo).replace(/[\\/:*?"<>|]/g, ' ');
    var blob = Utilities.newBlob(bytes, dados.tipoMime || 'application/octet-stream', nome);
    var arquivo = pasta.createFile(blob);
    arquivo.setDescription('Código M · enviado por ' + pessoa.nome + ' (' + email + ')');

    var linha = {
      id: 'M-' + new Date().getTime().toString(36),
      criado: Utilities.formatDate(new Date(), 'America/Recife', 'yyyy-MM-dd'),
      cadeira_id: dados.cadeiraId || '', assunto: dados.assunto || '', tipo: dados.tipo || 'Arquivo',
      titulo: '[' + pessoa.sigla + '] ' + (dados.titulo || dados.nomeOriginal || nome),
      link: arquivo.getUrl(), origem: 'Colaboradora', copiado: '', obs: dados.obs || '',
      drive_id: arquivo.getId(), hash: hash, nome_original: dados.nomeOriginal || '', autor: pessoa.sigla,
    };
    aba.appendRow(cab.map(function (c) { return linha[c] !== undefined ? linha[c] : ''; }));
    return json_({ ok: true, id: arquivo.getId(), link: arquivo.getUrl(), nome: nome });
  } catch (erro) {
    return json_({ ok: false, erro: String(erro.message || erro) });
  }
}

/** Confere o login do Google enviado pelo site e devolve o e-mail. */
function conferirLogin_(token) {
  if (!token) throw new Error('Entre com Google no Código M.');
  var r = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Login expirado. Entre de novo no Código M.');
  var info = JSON.parse(r.getContentText());
  if (CLIENT_ID && info.aud !== CLIENT_ID && info.azp !== CLIENT_ID) throw new Error('Login de outro aplicativo.');
  if (!info.email || String(info.email_verified) !== 'true') throw new Error('Não consegui confirmar o e-mail do login.');
  return String(info.email).toLowerCase();
}

/** A pessoa precisa estar na aba Convites como colaboradora. */
function colaboradora_(email) {
  var aba = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName('Convites');
  if (!aba) throw new Error('Nenhum convite registrado.');
  var valores = aba.getDataRange().getValues();
  var cab = valores[0];
  var col = function (n) { return cab.indexOf(n); };
  for (var i = 1; i < valores.length; i++) {
    var l = valores[i];
    if (String(l[col('email')]).toLowerCase().trim() === email && String(l[col('papel')]).toLowerCase() === 'colaboradora') {
      return { sigla: String(l[col('sigla')] || 'C').trim(), nome: String(l[col('nome')] || email) };
    }
  }
  throw new Error('Este e-mail não está convidado como colaboradora.');
}

function garantirPasta_(pai, nome) {
  var it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function bloco_(t) {
  var s = String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\\/:*?"<>|\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return '[' + s + ']';
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
