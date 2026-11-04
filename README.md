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
- **Modo simulação** (sem login): dá para testar tudo; o que for criado some ao recarregar.
- Com **Entrar com Google**, tudo grava na planilha "Código M - Dados". As abas novas são criadas
  sozinhas no próximo login (veja `docs/PLANILHA.md`).

Ainda **não** ligado (depende de permissão do Google ou decisão): envio de arquivos ao Drive,
Google Agenda nos dois sentidos, transcrição/OCR/IA por API (pagos — fora até você decidir).

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
js/ui/                     ícones e componentes
docs/PLANILHA.md           abas e colunas da planilha / do JSON
```

## Princípios

- 100% gratuito: GitHub Pages + login Google no navegador + Drive e planilha da própria Catarina.
- O que muda com frequência (prompts, atalhos, fórmulas de nota, perfil do cronograma, tipos de material,
  motivos de dúvida, regras de sugestão) fica na aba **Config** da planilha, não no código.
- Nada importante guardado só no navegador.
- Nome de arquivo (regra dos colchetes, DC-26-004): `[1M] [Tipo] [Cadeira] [Assunto] [dd-mm-aaaa] [Catarina].ext`, sem acentos.
