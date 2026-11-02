# Código M

Painel de estudo de Medicina da Catarina — UPE, 1º período (1M), turma TA.

Site estático (HTML, CSS e JavaScript puros, sem build), publicado de graça no
**GitHub Pages**. Domínio futuro: `codigom.online`.

## Etapa atual: 1 — modo simulação

- Funcionando: **Início**, **Calendário** e **Cadeiras**. Os outros itens do menu mostram "em breve".
- Os dados vêm de `data/simulacao.json`. Aulas, avaliações e feriados são **reais** (PDF do Módulo
  Morfofuncional I, versão de 15/out); estudos e pendências são **exemplos**. Nada é gravado.
- Para importar uma nova versão do horário: `python3 ferramentas/importar_horario.py horario.pdf`
  (requer `pip install pdfplumber`).
- Ainda **não** há login Google, Drive nem planilha.

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
js/dados/adaptadores/      jsonAdapter (hoje) e sheetsAdapter (Etapa 2)
js/dados/normalizar.js     converte texto da planilha em dados (datas, turma TA…)
js/dados/consultas.js      consultas usadas pelas telas
js/regras/sugestoes.js     sugestão de estudo por regras, com motivo
js/telas/                  Início, Calendário, Cadeiras, Em breve
js/ui/                     ícones e componentes
docs/PLANILHA.md           abas e colunas da planilha / do JSON
```

## Princípios

- 100% gratuito: GitHub Pages + login Google no navegador + Drive e planilha da própria Catarina.
- O que muda com frequência (prompts, atalhos, fórmulas de nota, perfil do cronograma, tipos de material,
  motivos de dúvida, regras de sugestão) fica na aba **Config** da planilha, não no código.
- Nada importante guardado só no navegador.
- Nome de arquivo: `1M - Tipo - Cadeira - Assunto - dd-mm-aaaa - Catarina.ext`, sem acentos.
