# Código M

Painel de estudo de Medicina da Catarina — UPE, 1º período (1M), turma TA.

Site estático (HTML, CSS e JavaScript puros, sem build), publicado de graça no
**GitHub Pages**. Domínio futuro: `codigom.online`.

## Etapa atual: 3 — MVP de estudo ativo (04/11/2026)

- **Todas as telas funcionam**: Início, Calendário, Pendências, Cadeiras (com página de cada
  **assunto**), Método Catarina, Dúvidas, Questões, Materiais, Avaliações e notas, Configurações e Busca.
- **Barra do topo** em todas as telas: **Voltar** (volta ao ponto anterior), trilha, busca e
  **+ Registrar** (dúvida, questão, estudo, cartão, material, avaliação, pendência), que já vem
  preenchido com a cadeira e o assunto da tela aberta.
- **Início compacto**: números clicáveis, semana com a agenda do dia escolhido (aulas, estudos com
  check e avaliações), próximas avaliações, pendências, sugestões com motivo e "+ marcar", atalhos de IA.
- **Método Catarina**: revisão espaçada FSRS (cartões validados primeiro, depois automáticos),
  teclas espaço e 1–4, importação de texto do Anki, gráficos de revisões e previsão.
- **Questões**: acertou/errou/chutou com confiança 1–5 e motivos; registro rápido para corrigir um
  caderno inteiro; acerto por cadeira e assunto; **domínio por assunto** calculado sozinho, com motivo.
- **Dúvidas**: aba única; tentativa própria ao lado da resposta conferida com fonte; botão Tutor
  (copia um prompt que pede sua tentativa antes de dar pistas); dúvida sanada vira cartão.
- **Avaliações e notas**: calculadora por cadeira/módulo com notas reais, peso, bônus, "quanto preciso",
  final (média 7 / final 5, configurável) e **simulação** que não grava.
- **Materiais**: links por cadeira e assunto, ícone por tipo, material da turma com check "copiado".
- **Configurações**: situação de cada integração e importação do backup do Código M antigo (ChatGPT).
- **Capa com login**: o site abre numa capa que pede **Entrar com Google**; sem login não mostra dados.
- **Sessão**: fica conectada enquanto houver uso (o acesso do Google é renovado sozinho); 3 horas sem mexer ou queda do acesso = volta à capa com aviso no meio da tela.
- **Ideias**: caixinha fixa no canto inferior direito; cada ideia vira pendência em Pendências › Ideias.
- **Convites** (Configurações): compartilha a planilha e a pasta 20-Medicina só para leitura e registra na aba `Convites`; falta adicionar o e-mail nos usuários de teste do Google Cloud.
- **Demonstração**: acrescente `?demo` ao endereço para abrir com dados de exemplo (nada é salvo).
- Com **Entrar com Google**, tudo grava na planilha "Código M - Dados". As abas novas são criadas
  sozinhas no próximo login (veja `docs/PLANILHA.md`).

**Ideias de 25/11 (lista da caixinha):**
- **Materiais**: material anexado numa avaliação também aparece no material geral da cadeira e pode ser ligado a aulas/assuntos;
  um material ou dúvida pode aparecer em **mais de um assunto** (atalho); links colados em observações, conteúdos e respostas ficam
  **clicáveis**; tipos novos **Goodnotes | Pessoal / Colaborativo** (atalhos no topo do assunto), **Gravação de aula**, **Link de site**,
  **Trabalho da disciplina** e **Trabalho extra**.
- **Visualizador lateral**: gravações e arquivos do Drive e vídeos do YouTube tocam/abrem **dentro do site**, num painel à direita
  (embaixo no celular), com as dúvidas visíveis ao lado e botões **+ Dúvida**, **Baixar** (sem abrir a pasta do Drive) e **Excluir**.
- **Excluir em duas etapas**: o material vai para **Pendências › A excluir**; lá você restaura ou confirma (o arquivo vai para a lixeira do Drive).
- **Dúvidas**: mais novas em cima; filtro por tipo; resposta **recolhida**; clicar no **quadro verde** (ou em "colar resposta") cola o que
  você copiou como resposta conferida; dúvida ligada a um material; motivos novos **Errei questão**, **Não conhecia**, **Curiosidade**.
- **Avaliação como assunto**: clicar numa avaliação abre um painel com conteúdo, observação, **materiais** e **atividades** dela.
- **Atividades de execução** (Escrevendo trabalho, Atividade extra, Atividade estratégica, Foco residência) com observação; aparecem
  na cadeira (cartão "Atividades e trabalhos") e na avaliação ligada. Também no "+ Registrar".
- **Assuntos**: **+ Assunto** dentro da cadeira; **Renomear / mover** (muda o nome ou a cadeira em todas as abas e, no Drive, a pasta e
  os nomes dos arquivos); **cadeira secundária** (o assunto aparece como atalho em outra cadeira); trocar o assunto de **uma aula só**.
- **Cadeiras e zonas de interesse**: **+ Cadeira** e **+ Zona de interesse** (bloco próprio de estudo e pesquisa, com linhas e assuntos).
- **Pergunta de estudo ativo** (Materiais): sorteia de cartões, dúvidas sanadas e modelos sobre assuntos já vistos.
- **Celular**: página do assunto em uma coluna; dúvidas, questões, cartões e estudos começam recolhidos.

**Ideias de 27/11:**
- **Aulas**: **+ Aula** na página do assunto (com data e horário) e o lápis de cada aula edita data, horário, tipo,
  local, cadeira e assunto daquela aula; **Atalho em outra cadeira** no topo do assunto.
- **Dúvidas da cadeira**: card com todas as dúvidas (sem resposta / respondidas / todas) e o número **Dúvidas respondidas**;
  clicar leva à tela Dúvidas já filtrada pela cadeira (`#/duvidas/<cadeira>`).
- **Negrito, itálico, riscado e emojis** nas respostas, tentativas e observações (barra acima do campo, ⌘/Ctrl+B e +I).
  A planilha guarda `**negrito**`, `*itálico*`, `~~riscado~~`.
- **Método Catarina**: botão **+ Dúvida** durante a revisão (o cartão continua; as teclas 1–4 não respondem enquanto digita).
- **Cartões do assunto**: número de cartões, quantas vezes foram estudados e a última vez; **Revisar** (vencidos e novos) ou **Estudar todos**.
- **Menu lateral recolhível** (só ícones), lembrado neste navegador.
- **Gravar áudio** da aula (microfone no card Materiais ou "+ Registrar"): pílula flutuante com tempo, pausar e parar,
  continua enquanto você navega; salva no Drive como material "Gravação de aula".
- **Modo aula**: painel fixo para várias dúvidas seguidas (dúvida e tentativa lado a lado, Ctrl/⌘+Enter), junto com o vídeo aberto.

**Importar do Anki (26/11):** Método Catarina › **Importar do Anki** aceita o baralho **.apkg** (e o backup
**.colpkg**) dos formatos novo e antigo do Anki. Pergunta simples, básico com inverso, digitar a resposta,
**omissão de palavras** (um cartão por lacuna, com dica) e **oclusão de imagem** (nativa e do complemento antigo)
viram cartões com imagem: o site desenha as máscaras e guarda a imagem no Drive, na pasta [Cartoes] do assunto.
Cada baralho vai para a cadeira/assunto que você escolher (sugeridos pelo nome), o progresso dos cartões já
estudados vem junto (FSRS do Anki ou estimado pelo intervalo) e reimportar não duplica. Tudo no navegador,
sem servidor e sem IA: bibliotecas abertas (MIT) em `js/vendor/` (sql.js, fflate, fzstd), carregadas só na
hora de importar. Testes com baralhos gerados pelo próprio Anki (`ferramentas/criar_apkg_teste.py`).

**Drive (04/11):** o site envia arquivos (PDF, imagens, prints colados com ⌘V, gravações) para o lugar
certo de `20-Medicina`, criando as pastas que faltam, e move o arquivo quando o assunto muda. Mostra
"Enviado ao Drive" só depois que o Drive devolve o ID real. Precisa da Google Drive API ativada e do
escopo `.../auth/drive` no projeto do Google Cloud (passo a passo em Configurações).

Ainda **não** ligado: Google Agenda nos dois sentidos; transcrição/OCR/IA por API (pagos — fora até você decidir).

## Como ver no ar

1. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Cada push na branch `main` publica o site automaticamente (aba **Actions** mostra o andamento).
3. Endereço: `https://catarinamaia-codigom.github.io/codigo-m-MPV/`

Para testar outra data como se fosse "hoje", acrescente `?hoje=2026-11-03` ao endereço.

## Como rodar no computador

```bash
python3 -m http.server 8080
```

Depois abra <http://localhost:8080>. Testes: `npm test` (Node 20+, sem dependências).

## Organização

```
index.html                 página única
css/estilo.css             identidade visual (cores em variáveis no topo)
data/simulacao.json        dados de exemplo, no formato das abas da planilha
js/app.js                  menu e navegação
js/dados/dataSource.js     ÚNICO ponto de acesso aos dados (troca JSON → planilha)
js/config.js               Client ID do Google e ID da planilha
js/dados/google.js         login Google no navegador (token de ~1 h, só nesta aba)
js/dados/adaptadores/      jsonAdapter (simulação) e sheetsAdapter (planilha)
js/dados/normalizar.js     converte texto da planilha em dados (datas, turma TA…)
js/dados/consultas.js      consultas usadas pelas telas
js/regras/sugestoes.js     sugestão de estudo por regras, com motivo
js/telas/                  uma tela por arquivo + formularios.js (todos os "+ Registrar")
js/regras/                 sugestões, FSRS (fsrs.js), notas, domínio, importação do backup antigo
js/ui/                     ícones, componentes, formulários e visualizador lateral
js/regras/anki.js          leitura de baralhos do Anki (modelos, cloze, oclusão, progresso)
js/dados/apkg.js           abre .apkg/.colpkg no navegador e desenha as imagens dos cartões
js/vendor/                 sql.js, fflate e fzstd (MIT), só para importar do Anki
docs/PLANILHA.md           abas e colunas da planilha / do JSON
```

## Princípios

- 100% gratuito: GitHub Pages + login Google no navegador + Drive e planilha da própria Catarina.
- O que muda com frequência (prompts, atalhos, fórmulas de nota, perfil do cronograma, tipos de material,
  motivos de dúvida, regras de sugestão) fica na aba **Config** da planilha, não no código.
- Nada importante guardado só no navegador.
- Nome de arquivo (regra dos colchetes, DC-26-004): `[1M] [Tipo] [Cadeira] [Assunto] [dd-mm-aaaa] [Catarina].ext`, sem acentos.
