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
| `formula_nota` | chave = módulo/cadeira, valor = fórmula (só referência na tela) | `(P1 + P2 + INTEGRADA) / 3` |
| `notas` | `media_aprovacao` (padrão 7), `media_final` (padrão 5) | `media_final` = `5` |
| `motivo_questao` | chave = motivo de erro de questão (vários por questão) | `Li errado / desatenção` |
| `metodo` | `retencao_desejada` (0,7 a 0,97; padrão 0,9), `novos_por_dia` (padrão 20) | `novos_por_dia` = `15` |

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

## Abas da etapa 3 (estudo ativo)

O site cria estas abas sozinho no próximo login, só com o cabeçalho. Se uma aba
antiga não tiver alguma coluna nova, ela é acrescentada **no fim** do cabeçalho.

### Duvidas
`id | criada | cadeira_id | assunto | pergunta | motivo | tentativa | resposta | fonte | link | status | sanada_em`

`status`: Aberta / Sanada. `tentativa` = o que você respondeu sem consultar; `resposta` = conferida com fonte.

### Questoes
`id | data | cadeira_id | assunto | fonte | resultado | confianca | motivos | obs`

`resultado`: Acertou / Errou / Chutou. `confianca`: 1 a 5. `motivos`: separados por `;`.
Chute com confiança 1–2 conta como erro; com 4–5 conta acerto, mas pede aprofundamento.

### Notas (calculadora)
`id | cadeira_id | avaliacao_id | nome | vale | peso | nota | bonus | obs`

`vale` = pontos máximos. `peso` em branco = igual a `vale` (soma de pontos). `nota` em branco = ainda não saiu.
`bonus` = `sim` para nota extra (soma direto na média). `cadeira_id` pode ser o id de um módulo (PIs).

### Materiais
`id | criado | cadeira_id | assunto | tipo | titulo | link | origem | copiado | obs`

`tipo`: um dos `tipo_material` da Config. `origem`: Minha / Turma / Professor / Livro / IA. `copiado`: TRUE/FALSE (material da turma já copiado para a sua pasta).

### Cartoes (Método Catarina)
`id | criado | cadeira_id | assunto | frente | verso | fonte | origem | vence | estabilidade | dificuldade | revisoes | lapsos | ultima`

`origem`: Validado (escritos por você, têm prioridade) / Anki / IA. As colunas `vence` a `ultima` são do agendamento FSRS: o site preenche.

### Revisoes (histórico, só acrescenta)
`data | cartao_id | nota | intervalo`

`nota`: 1 Errei, 2 Difícil, 3 Bom, 4 Fácil. Base das estatísticas do Método Catarina.
