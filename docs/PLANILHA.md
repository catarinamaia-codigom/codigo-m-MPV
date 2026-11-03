# Abas e colunas (planilha Google e `data/simulacao.json`)

A planilha real é **Código M - Dados** (Drive > Estudio-IA > 20-Medicina > Código M).
Pode editar à vontade direto no Google Planilhas: o site lê de novo a cada abertura.
Só não renomeie as abas nem a 1ª linha (cabeçalho) de cada uma. Se apagar uma aba,
o site a recria vazia, só com o cabeçalho.

O arquivo `data/simulacao.json` tem **exatamente** as mesmas abas e colunas da
futura planilha. Cada aba é uma lista de linhas; a 1ª linha da planilha é o
cabeçalho com os nomes das colunas abaixo.

Datas: `AAAA-MM-DD` ou `dd/mm/aaaa`. Horas: `hh:mm`.

## Config

| grupo | chave | valor | obs |
|---|---|---|---|

Cada item de lista é **uma linha**, para ser fácil incluir ou apagar.

| grupo | o que é | exemplo |
|---|---|---|
| `geral` | período, semestre, aluna, turma, `turmas_visiveis`, `data_simulada`, `ia_url` | `turmas_visiveis` = `TA, TA1, TA2` |
| `sugestoes` | `janela_avaliacao_dias`, `revisao_intervalos_dias`, `pre_leitura`, `max_sugestoes` | `revisao_intervalos_dias` = `1, 7, 30` |
| `cronograma` | perfil do cronograma (horas por dia, horário preferido) | `horas_estudo_dia_util` = `2.5` |
| `tipo_material` | chave = nome do tipo, valor = ícone | `Resumo` → `resumo` |
| `motivo_duvida` | chave = motivo | `Errei questão` |
| `tipo_avaliacao` | chave = opção do campo "Tipo" em + Avaliação | `Trabalho oral` |
| `atalho_ia` | chave = nome do botão, valor = prompt (`{assunto}`, `{cadeira}`, `{periodo}`) | `Gerar flashcards` |
| `formula_nota` | chave = módulo/cadeira, valor = fórmula | `(P1 + P2 + INTEGRADA) / 3` |

Ícones disponíveis para `tipo_material`: `slide`, `resumo`, `mapa`, `flashcard`,
`questoes`, `video`, `livro`, `anotacao`, `prova`, `arquivo`.

## Modulos
`id | periodo | nome | ordem`

## Cadeiras
`id | modulo_id | nome | ordem`

## Aulas
`id | data | inicio | fim | cadeira_id | assunto | tipo | turma | local | professor`

- `tipo`: Teórica, Prática, Tutoria, Campo…
- `turma`: `Todas` (turma inteira) ou `TA`, `TA1`, `TA2`, `TB`, `TB1`… — só aparecem `Todas` e as turmas de `turmas_visiveis`.

## Avaliacoes
`id | data | hora | cadeira_id | titulo | tipo | conteudo | turma`

`conteudo`: assuntos separados por `;`.

## Estudos (o que a Catarina marca para estudar)
`id | data | inicio | fim | cadeira_id | assunto | atividade | feito`

`feito`: `TRUE`/`FALSE` (ou sim/não).

## Pendencias
`id | descricao | cadeira_id | prazo | status | prioridade`

`status`: Aberta / Feita. `prioridade`: Alta / Média / Baixa.

## Feriados
`data | nome`
