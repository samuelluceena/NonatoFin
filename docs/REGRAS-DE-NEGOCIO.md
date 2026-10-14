# Regras de negócio

Todas as regras ficam em funções puras em `src/lib/domain/` (testadas em `tests/unit/`) e, quando envolvem o banco, em funções SQL (testadas em `tests/integracao/`).

## Datas
- **Vencimento é uma DATA, não um instante.** É gravado como `date` e tratado no app como texto `AAAA-MM-DD`. Nunca é convertido com `new Date()` local, então o dia 15 continua dia 15 em qualquer fuso ou horário.
- **"Hoje"** é calculado no fuso `America/Sao_Paulo` (`APP.fusoHorario` em `lib/config.ts`): às 23h30 de 15/08 ainda é dia 15, mesmo com o servidor em UTC.
- **`pago_em`** é um instante (`timestamptz`); a data de pagamento exibida e usada nos filtros é a data desse instante em São Paulo.
- Formato de exibição: **DD/MM/AAAA**; meses como "Outubro/2026".
- **Semana** = segunda a domingo.

## Dinheiro
- Valores em **centavos inteiros** (`bigint`). R$ 2.995,00 = `299500`. Somas e multiplicações são exatas.
- Exibição `R$ 1.234,56` (pt-BR). Entrada com máscara de banco: os dígitos preenchem da direita.
- Limite por boleto: até R$ 999.999.999,99 na digitação (o banco aceita até R$ 1 bilhão).

## Status
| Status | Regra |
|---|---|
| **Pendente** | status gravado `pendente` e vencimento **≥ hoje** |
| **Atrasado** | status gravado `pendente` e vencimento **< hoje** (derivado, nunca gravado) |
| **Pago** | status gravado `pago` |

- Novo boleto nasce **pendente**. Um boleto que vence **hoje** ainda não está atrasado.
- **Pagar:** `status = pago` e `pago_em = agora`. Marcar pago de novo não altera o `pago_em` original.
- **Desfazer pagamento:** `status = pendente`, `pago_em = null`; volta a ser pendente ou atrasado conforme o vencimento.
- Status é sempre exibido com **ícone + texto**, nunca só cor.

## Fornecedor
- Tabela própria. O nome é comparado **sem maiúsculas, acentos e espaços extras**: "Via da Moda", "via da moda", "VIA DA MODA" e "Vía  da  Moda" são o mesmo fornecedor. A grafia do primeiro cadastro é mantida.
- Ao cadastrar um boleto, o fornecedor digitado é reaproveitado se já existir, ou criado automaticamente.
- Fornecedor com boletos **não pode ser excluído** (exclua/mova os boletos antes). Renomear é permitido (sem colidir com outro nome).

## Empresas (CNPJ)
- Todo lançamento pertence a uma **empresa** (ex.: Cristina de Lucena Ferreira e J F Lima Confecções). Cadastro em Configurações → Empresas: **apelido** (nome curto nas telas), razão social (opcional) e **CNPJ** (obrigatório no formulário).
- CNPJ validado pelos dígitos verificadores no navegador, no servidor **e** no banco (`cnpj_valido`). Aceita o CNPJ numérico e o **alfanumérico** (válido a partir de 2026: letras nas 12 primeiras posições, valor do caractere = código ASCII − 48). Gravado sem pontuação, em maiúsculas; exibido como `12.ABC.345/01DE-35`.
- Apelido e CNPJ não se repetem na mesma conta. Empresa com lançamentos ou cartões **não pode ser excluída**.
- **Seletor no topo** (aparece com 2+ empresas): "Todas as empresas" ou uma empresa. A escolha fica num cookie (1 ano) e filtra Hoje, Boletos, Meses, Histórico, Fornecedores, Dashboard, Cartões e Exportação. O novo boleto já vem com a empresa escolhida.
- Com uma única empresa não há filtro nem seletor.

## Categorias
- Lista editável (Configurações → Categorias, ou **Transações → Categorias**). Cada categoria mostra quantos lançamentos, compras no cartão e cartões a usam, com o selo "Em uso". As padrão são criadas no primeiro uso: **Boleto de fornecedor, Empréstimo, Despesa fixa, Despesa variada, Cartão de crédito**.
- Nome único sem maiúsculas/acentos. Categoria em uso (lançamentos, compras ou cartões) **não pode ser excluída** — a tela avisa antes ("Esta categoria está sendo utilizada em transações e não pode ser excluída") e o banco bloqueia de qualquer forma (FK `on delete restrict`). Edite o nome se preferir.
- Não há categoria inativa/arquivada (exigiria migration — veja DECISOES.md, D21).
- Cada lançamento tem uma categoria; há filtro por categoria em Boletos e totais por categoria no Dashboard.
- Empréstimos e despesas fixas mensais usam o cadastro **Vários meses** (mesmo valor por mês, dia preservado). Nenhuma regra fiscal ou de juros é calculada pelo sistema.

## Cartões de crédito
- Cartão: empresa, nome, final (4 dígitos, opcional), **banco/emissor** (é o credor da fatura, cadastrado como fornecedor), **dia de fechamento**, **dia de vencimento** (dias diferentes, 1–31), categoria das faturas (padrão "Cartão de crédito") e ativo/inativo. Inativos não aparecem ao lançar compras.
- **Fatura do mês AAAA-MM** vence no dia de vencimento daquele mês (ou no último dia, se o mês for mais curto).
- **Fechamento:** no mesmo mês do vencimento quando o dia de fechamento é menor que o de vencimento; senão, no mês anterior. Ex.: fecha 3 / vence 10 → a fatura de outubro fecha em 03/10; fecha 25 / vence 5 → a de outubro fecha em 25/09.
- **Em qual fatura entra a compra:** compra feita **antes** do dia de fechamento entra naquela fatura; compra **no dia do fechamento ou depois** vai para a seguinte. O sistema sugere a fatura e o usuário pode escolher outra (para corrigir casos especiais do banco).
- **Parcelas:** informe o **valor total** e a quantidade (à vista a 48x). O total é dividido em centavos inteiros e a **sobra vai para a 1ª parcela** (R$ 100,00 em 3x = 33,34 + 33,33 + 33,33). A parcela *n* cai na fatura seguinte à da parcela *n−1*. A mesma conta é feita no banco (`gerar_parcelas_compra`) e no TypeScript (`lib/domain/cartoes.ts`) — o teste de integração confere que são iguais.
- **Fatura = lançamento a pagar** comum (aparece em Hoje, Boletos, Meses, Dashboard, Exportação), com a empresa, o emissor e a categoria do cartão e descrição "Fatura Nubank PJ — Outubro/2026". **Valor = soma das parcelas do mês + ajuste**. É criada, atualizada e removida automaticamente quando compras são lançadas, editadas ou excluídas (removida quando fica sem compras, sem ajuste, pendente, sem código e sem observação).
- **Ajuste da fatura:** acréscimo (juros, anuidade, IOF) ou desconto (estorno, crédito). O total precisa continuar maior que zero.
- **Fatura paga trava** as compras dela: não é possível lançar, editar ou excluir compra com parcela numa fatura paga, nem ajustar a fatura. Desfaça o pagamento para alterar. A fatura não é editada pela tela comum de edição e **não pode ser excluída enquanto tiver compras**.
- Alterar o cartão (nome, empresa, emissor, categoria, vencimento) atualiza **somente as faturas em aberto**; faturas pagas ficam como foram pagas.
- Excluir a conta do usuário apaga tudo, inclusive faturas pagas (a trava não impede a exclusão da conta).

## Contas bancárias e saldo
- Cada **empresa** tem suas contas bancárias (menu **Contas**): apelido, banco, 4 últimos dígitos (opcional), conta padrão, ativa/inativa. Não se guarda número completo, agência, senha nem chave.
- **Uma conta padrão por empresa.** Marcar outra como padrão desmarca a anterior. A 1ª conta de uma empresa já nasce padrão. Conta inativa não pode ser padrão.
- **Conta de débito** (opcional) em cada lançamento e em cada cartão. Vem preenchida com a padrão da empresa; trocar a empresa troca a conta. Só é possível escolher conta **da mesma empresa** (garantido pelo banco). As faturas herdam a conta do cartão; mudar a conta do cartão muda só as faturas em aberto. Em séries, a conta segue o mesmo escopo da edição.
- **Saldo** nunca é digitado: saldo de hoje = entradas confirmadas + transferências + conferências − lançamentos **pagos** pela conta. Lançamento pendente não mexe no saldo; desfazer o pagamento devolve o valor.
- **Cadastro da conta:** informa-se o saldo de hoje; ele vira a primeira conferência ("Saldo inicial" no extrato).
- **Entrada:** com data até hoje entra no saldo; com data futura fica **prevista** (entra só na previsão). Entrada prevista que passou da data aparece em "Entradas previstas para confirmar": **Entrou** (passa a contar, com a data de hoje) ou excluir.
- **Transferência** entre duas contas (mesma empresa ou não): sai de uma e entra na outra com a mesma data (hoje ou passada). Excluir desfaz os dois lados.
- **Conferência com o extrato:** digita-se o saldo que o banco mostra; o sistema grava o ajuste (saldo do banco − saldo calculado) com a data de hoje. Pode ser negativo (cheque especial). Excluir a conferência desfaz o ajuste.
- **Pagar:** com conta prevista, paga em um toque e o aviso oferece **Trocar conta**; sem conta prevista (e com contas na empresa), pergunta **por qual conta foi pago** (ou "Não informar"). No detalhe de um lançamento pago, **Trocar** corrige a conta.
- **Previsão (60 dias):** parte do saldo de hoje, subtrai as contas pendentes da conta (as vencidas contam como hoje) e soma as entradas previstas a partir de hoje. Dentro do mesmo dia as entradas vêm antes das saídas. **Alerta** no primeiro dia que termina negativo. "Previsto em" mostra o saldo no fim do mês.
- **Cobre / Faltam:** na tela Contas (até o fim do mês) e em Hoje (o que vence até hoje), compara o saldo com as saídas previstas da conta.
- **Conferência diária (obrigatória):** no primeiro acesso de cada dia (fuso de São Paulo), antes de qualquer tela, o app pede o saldo de cada conta **ativa** que ainda não foi conferida hoje. Cada campo já vem com o saldo do sistema; diferença vira ajuste. Só libera o app depois de confirmar todas. Conta cadastrada hoje já conta como conferida. Sem contas cadastradas, não pede nada. Vale para todos os dias em que o app for aberto.
- **Antes de conferir, "já foi paga?":** a mesma tela lista as contas vencidas até hoje e ainda pendentes, para marcar como pago o que já saiu do banco. Sem isso, o banco já mostraria o valor descontado, a conferência ajustaria e, ao marcar pago depois, o valor seria descontado de novo.
- **Tela de saldos (Contas):** total de todas as empresas, subtotal por empresa (CNPJ) e por conta; com uma empresa escolhida no topo, só as contas dela.
- **Sem conta definida:** lançamentos sem conta não entram no saldo de nenhuma conta; a tela Contas mostra quantos são e oferece aplicar a conta padrão a todos os lançamentos em aberto da empresa.

## Lançamento único
Cria um boleto com os dados informados, pendente, na data escolhida.

## Vários meses (série)
- Campos: quantidade (2 a 120), primeiro vencimento, **valor de cada lançamento**, frequência (mensal).
- **O valor NÃO é dividido.** 5 × R$ 2.995,00 = R$ 14.975,00. Antes de salvar aparece: *"Serão criados 5 lançamentos de R$ 2.995,00, totalizando R$ 14.975,00."* e a prévia das datas.
- Todos recebem o mesmo `serie_id`, `parcela` (1..N) e `total_parcelas` (N). Criados em um único INSERT (todos ou nenhum).
- **Código de barras:** por padrão só o 1º lançamento recebe o código (o código costuma mudar a cada mês). A opção *"Usar o mesmo código em todos os lançamentos"* (desmarcada por padrão) copia para todos.

### Dia 31 e fim de mês
Os vencimentos são calculados **sempre a partir do primeiro vencimento** (data-âncora), somando *i* meses. Se o dia não existir no mês, usa o último dia desse mês — mas o dia original **não se perde** nos meses seguintes:

```
31/01/2027 → 28/02/2027 → 31/03/2027 → 30/04/2027 → 31/05/2027
29/01/2028 → 29/02/2028 (bissexto) → 29/03/2028
```
Função: `adicionarMeses()` em `lib/domain/datas.ts` (TS) — idêntica à soma de meses do Postgres (verificado em centenas de casos no teste de integração).

## Edição em série
Ao salvar um boleto que pertence a uma série, o app pergunta **"Aplicar em"**:
- **somente este** — só a parcela editada;
- **este e os próximos** — parcelas com número ≥ a editada;
- **todos** — todas as parcelas existentes da série.

Campos aplicados ao escopo: fornecedor, descrição, valor, observação e vencimento.
- Se o **vencimento mudar**, cada parcela do escopo recebe `novo_vencimento + (parcela − parcela_editada) meses` (mesma regra do dia 31).
- Se o vencimento **não mudar**, as datas das parcelas ficam como estão.
- **Código de barras e status são sempre alterados somente no boleto editado** (códigos mudam por mês; pagamento é individual).
- Tudo em uma única transação (função `atualizar_lancamento`).

## Exclusão em série
Mesmas opções (somente este / este e os próximos / todos), **sempre com confirmação**. As parcelas restantes mantêm a numeração original (ex.: excluir a 2/5 deixa 1/5, 3/5, 4/5, 5/5).

## Filtros (lista de Boletos)
Os filtros **se combinam**: período **e** status **e** fornecedor **e** categoria **e** conta **e** pesquisa (e a empresa do topo). Todos ficam na URL — dá para atualizar a página, voltar e salvar nos favoritos. Código: `lib/domain/filtros.ts`.

**Período** (pela data de vencimento):

| Período | Vencimento |
|---|---|
| Hoje / Amanhã | igual à data |
| Esta semana | segunda a domingo da semana atual |
| Este mês / Próximo mês | dentro do mês |
| Escolher o mês | dentro do mês escolhido (setas ‹ › mudam o mês) |
| Um dia | igual ao dia escolhido (setas ‹ › mudam o dia) |
| Intervalo de datas | de… até… (um dos dois pode ficar vazio; datas trocadas são desinvertidas) |
| Todo o período | sem restrição |

**Status** (combinado com o período — vale a interseção):

| Status | Critério |
|---|---|
| Todos | qualquer status |
| Em aberto | pendente (vencido ou não) |
| A vencer | pendente e vencimento ≥ hoje |
| Atrasados | pendente e vencimento < hoje |
| Pagos | pago (mais recentes primeiro) |

Ex.: "Próximo mês × Atrasados" não traz nada (nada do mês que vem está atrasado ainda).

**Mais filtros:** categoria, fornecedor e conta (uma conta ou **"Sem conta definida"**). Os ativos aparecem como etiquetas removíveis; "Limpar filtros" volta ao padrão.

- **Padrão:** Este mês, todos os status.
- **Pesquisa** (fornecedor, nome/descrição, observação): se o período não foi escolhido, busca em **todo o período** (inclusive contas futuras); ao limpar a pesquisa, volta ao mês. O nome do fornecedor é comparado sem acentos/maiúsculas.
- **Total e quantidade** no topo seguem os filtros.
- **Exportar esta lista** (fim da lista): CSV/Excel com **exatamente** o que os filtros trazem — sem o limite de itens da tela. Arquivo `nonatofin-boletos-filtrados-AAAA-MM-DD`.
- Links antigos (`/boletos?filtro=atrasados` etc.) continuam funcionando.
- Parâmetros inválidos na URL são ignorados (nunca dão erro).

## Fechar o dia
Botão **"Fechar o dia"** (tela Hoje e menu) → gera um texto pronto para o WhatsApp. **Não grava nada**, não envia sozinho e não guarda histórico: é só abrir de novo se algo mudar. Segue a empresa selecionada no topo. Código: `lib/domain/fechamento.ts`.

Conteúdo, nesta ordem:
1. **Saldo disponível** de cada conta ativa (e o total, com 2+ contas).
2. **Pagas hoje**: pagamentos com data de pagamento = hoje (e a conta que pagou).
3. **Pendentes**: vencimento até hoje e ainda não pagas (com a data do vencimento). A tela avisa para marcar como pago o que já foi pago antes de enviar.
4. **Próximo dia útil**: contas em aberto que vencem depois de hoje **até** o próximo dia útil — inclui as que vencem no fim de semana/feriado no meio (mostradas com "(venc. DD/MM)").
5. **Saldo após pagar** pendentes + próximo dia útil, por conta (saldo − saídas previstas pela conta de débito), com aviso "saldo insuficiente"; contas sem conta de débito aparecem como "Sem conta definida". Entradas previstas não entram nessa conta.

Nunca inclui código de barras. Negrito com `*…*` (formato do WhatsApp).

Botões: **Copiar texto** e **Enviar no WhatsApp** (abre `wa.me` com o texto; você escolhe o contato).

**Dia útil** = segunda a sexta, exceto feriados com agência fechada: nacionais fixos (01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12), Carnaval (segunda e terça), Sexta-feira Santa e Corpus Christi — os móveis calculados pela Páscoa (`lib/domain/dias-uteis.ts`). **Feriados da sua cidade/estado** não são conhecidos pelo app: cadastre em `FERIADOS_LOCAIS` (`lib/config.ts`), no formato `'MM-DD'` (todo ano) ou `'AAAA-MM-DD'` (um ano só).

## Dashboard
Apresentação em níveis (só leitura; nenhum cálculo novo):
1. **Situação atual:** saldo disponível (soma dos saldos das contas ativas, `saldos_contas()` + `agruparSaldos`), **a pagar até o fim do mês** (= "A pagar este mês" + "Atrasados", o mesmo conjunto que a tela Contas compara) com "Saldo cobre / Faltam R$ …" (`cobertura`, a mesma regra da tela Contas) e **atrasados**.
2. **Próximos compromissos:** hoje, amanhã, semana, este mês, próximo mês (sem os atrasados).
3. **Resumo:** pago no mês, total futuro, quantidades.
4. **Tendência** (valores por mês) e **composição** (pago × pendente × atrasado, em barra empilhada).
5. **Distribuição:** fornecedor, categoria e empresa (barras ranqueadas por métrica).

Indicadores (dados reais do banco):
| Indicador | Regra |
|---|---|
| A pagar hoje | pendentes com vencimento = hoje |
| A pagar amanhã | pendentes com vencimento = amanhã |
| A pagar esta semana | pendentes de **hoje até domingo** |
| A pagar este mês | pendentes de **hoje até o fim do mês** |
| A pagar no próximo mês | pendentes com vencimento no próximo mês |
| Atrasados | pendentes com vencimento < hoje |
| Total futuro a pagar | todos os pendentes com vencimento ≥ hoje |
| Total pago no mês | pagos cuja **data de pagamento** está no mês atual |
| Boletos pendentes / atrasados | quantidades correspondentes |

Os "a pagar" **não incluem atrasados** (que têm indicador próprio) — assim nada é contado duas vezes: *futuro + atrasados = tudo que está em aberto*.

## Totais por fornecedor e por mês
Para cada fornecedor (ou mês de vencimento): quantidade total, pendentes, pagos, atrasados e os valores correspondentes. **pendente + pago + atrasado = total**. "Próximo vencimento" = menor vencimento pendente a partir de hoje. A visão comparativa ordena por total, a pagar, pago ou atrasado.

## Totais por empresa e por categoria
Dashboard: "Por categoria" sempre; "Por empresa" quando o seletor está em "Todas as empresas" e há 2+ empresas. Mesma soma por status dos fornecedores; grupos sem lançamentos não aparecem.

## Transações
Visão cronológica e centralizada da movimentação (menu **Transações**). **Não existe tabela de transações**: a lista é composta do que já existe, e nenhuma regra financeira é copiada. Código: `lib/domain/transacoes.ts` e `features/transacoes/`.

| Origem | Tipo na tela | Data | Status | Valor |
|---|---|---|---|---|
| Lançamento pendente | **Conta a pagar** (obrigação: o dinheiro ainda não saiu) | vencimento | Pendente / Atrasado (derivado, como em Boletos) | − (cor neutra) |
| Lançamento pago | **Pagamento** (saída de caixa) | data do pagamento (fuso de São Paulo) | Pago | − vermelho |
| Entrada (movimento) | **Entrada** | data | Confirmado / Previsto | + verde (prevista: neutra) |
| Transferência (par de movimentos) | **Transferência** — um item "origem → destino" | data | Confirmado | sem sinal, neutra |
| Conferência com diferença | **Ajuste** ("Conferência com o extrato" ou "Saldo inicial") | data | Confirmado | + ou −, neutra |
| Compra no cartão | **Compra no cartão** (informativa: sai pela fatura) | data da compra | Na fatura | sem sinal, neutra |

- Cor é só reforço: todo item tem ícone, rótulo do tipo, status em texto e valor com sinal.
- Faturas de cartão são lançamentos: aparecem como Conta a pagar/Pagamento (uma vez só). Conferências **sem diferença** (a conferência diária) não aparecem.
- **Totais**: Entradas (confirmadas), Pagamentos, A pagar (em aberto, com quantas atrasadas) e A receber (entradas previstas). Transferências, ajustes e compras no cartão **não** entram (a compra seria contada duas vezes com a fatura).
- **Filtros** (na URL, combináveis): período (o mesmo de Boletos; padrão "Este mês"; com pesquisa e sem período, todo o período), tipo, status, empresa (só com o seletor do topo em "Todas"), categoria, conta (ou "Sem conta definida") e fornecedor, além da pesquisa (descrição, observação e fornecedor sem acento). Um filtro que não existe numa origem a exclui: fornecedor só existe em lançamentos; categoria, em lançamentos e compras; conta, em lançamentos e movimentos.
- Status por tipo: Em aberto / A vencer / Atrasados (contas a pagar), Pagos (pagamentos), Previstos (entradas previstas), Confirmados (entradas, transferências e ajustes).
- Ordem: data mais recente primeiro. Cada origem traz no máximo 500 itens; se alguma passar disso, a lista é cortada numa data segura e a tela pede um período menor. A tela mostra 50 itens por vez ("Mostrar mais").
- Tocar num item abre a tela que já existe: lançamento → detalhe do boleto; entrada, ajuste e transferência → extrato da conta; compra → edição da compra.

## Gerenciamento de dados (Configurações → Dados)
- **Limpar dados financeiros** (frase `LIMPAR DADOS FINANCEIROS`): apaga todos os lançamentos (boletos, séries, faturas, pagos ou não), compras no cartão, parcelas e movimentações (entradas, transferências, conferências e saldos iniciais). Mantém empresas, contas, cartões, fornecedores, categorias, login e autorização. Como o saldo é calculado, todas as contas ficam com saldo 0 e o app pede a **conferência** de cada conta ativa: o saldo informado vira o novo ponto de partida.
- **Restaurar NonatoFin do zero** (frase `REINICIAR NONATOFIN`): apaga também empresas, contas, cartões, fornecedores e categorias. Só o login e a autorização continuam. O app volta ao primeiro acesso ("Cadastre suas empresas primeiro"); as 5 categorias padrão são recriadas automaticamente na primeira vez que forem usadas.
- As duas opções pedem a **senha** e a frase exata, mostram o que será apagado e mantido (com quantidades) e criam um **backup automático** antes de apagar. Sem backup, nada é apagado.
- **Backups automáticos:** guardam todos os dados (as 9 tabelas), ficam disponíveis por **30 dias** (no máximo 10) e podem ser baixados em `.json`. **Restaurar** (frase `RESTAURAR BACKUP` + senha) substitui os dados atuais do escopo do backup pelos dados dele, com os mesmos ids, status, pagamentos e datas. Antes, o estado atual vira um novo backup, então a restauração também pode ser desfeita. Um backup financeiro só restaura as tabelas financeiras; se algum cadastro que ele usa tiver sido apagado, a restauração é recusada sem alterar nada.
- **Backup completo (.json)** a qualquer momento, com todos os dados atuais.

## Histórico
Lista boletos pagos, do pagamento mais recente para o mais antigo; filtros por fornecedor, período (data do pagamento) e pesquisa.

## Exportação
CSV (`;`, decimal `,`, datas DD/MM/AAAA, UTF-8 com BOM — abre certo no Excel) e Excel `.xlsx` (valores numéricos em R$, datas reais, código como texto). Campos: **empresa, CNPJ, categoria**, fornecedor, nome, valor, vencimento, código, status, parcela, total de parcelas, observação, pagamento. Exporta a empresa selecionada no topo (ou todas). Em Configurações exporta tudo; na lista de Boletos, "Exportar esta lista" exporta só o que está filtrado.
