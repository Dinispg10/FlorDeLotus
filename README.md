# Flor de Lotus — agenda do salão

Aplicação de secretária (Tauri + React + TypeScript) para gerir a agenda de um salão:
marcações por funcionária, fichas de clientes e catálogo de serviços. Os dados ficam no
Supabase, por isso vários computadores do salão veem a mesma agenda.

## O que a app faz

- **Barra de navegação no topo**: Agenda, Clientes, Lembretes, Estatísticas e Definições (com
  sub-abas Horário, Funcionárias e Serviços). A barra faz também de moldura da janela —
  arrasta-se por ela e tem os botões de minimizar, maximizar e fechar.
- **Agenda diária** com uma coluna por funcionária e grelha de horas. Os botões por cima
  filtram por funcionária: ao escolher uma, abre a **semana dela** (uma coluna por dia) a
  ocupar o ecrã todo. Clicar num espaço livre cria uma marcação já com o dia, a hora e a
  funcionária certos.
- **Lembretes sem custos** (página Lembretes): abre no dia seguinte e lista um cliente
  por linha. Quem tem vários serviços seguidos recebe uma só mensagem. O botão WhatsApp
  abre a conversa com o texto já escrito; no telemóvel há também SMS (vai pelo tarifário
  do telemóvel) e no computador um botão para copiar. Cada cliente fica "Avisado" (dá
  para anular). O texto edita-se na própria página, com campos como `{cliente}` e `{hora}`.
  Não há envio automático: isso exigiria um fornecedor de SMS pago (ver o fim deste ficheiro).
- **Estatísticas** por dia, semana ou mês, independentes da agenda: faturação, marcações,
  valor médio e clientes atendidos, cada um comparado com o período anterior; gráfico da
  faturação ao longo do período (com tabela dos valores); e, por funcionária e por serviço,
  marcações e faturação. A ocupação de cada funcionária desconta as folgas e férias.
- **Marcações**: criar, editar e cancelar. Uma marcação está confirmada ou pendente;
  cancelar tira-a da agenda (pede confirmação antes). O ✕ em cada bloco cancela sem
  abrir a marcação.
- **Visitas com vários serviços**: na mesma janela acrescentam-se serviços, cada um com
  a sua funcionária e duração. Por omissão vêm em cadeia (corte às 10:00, coloração às
  11:00); marcando "à mesma hora que o anterior" ficam em simultâneo, para casos como
  manicure enquanto a cor atua. Guarda tudo de uma vez e, se algum falhar, desfaz os
  que já tinham entrado.
- **Sem sobreposições**: a app avisa antes de guardar e a base de dados recusa
  marcações sobrepostas para a mesma funcionária (ver `supabase/migrations`).
- **Horário do salão dia a dia** (página Definições): cada dia da semana tem as suas horas
  ou fica fechado. Manda no que se pode marcar — fora dele, a app recusa. A grelha mostra
  pelo menos das 08:00 às 20:00 e estica se o horário ou alguma marcação for além disso;
  as horas fechadas aparecem às riscas.
- **Folgas e férias**: marcam-se na ficha de cada funcionária (dias inteiros ou algumas
  horas). Aparecem às riscas na agenda e a app recusa marcar em cima delas. Ao criar uma
  folga em cima de marcações existentes, avisa quantas são antes de deixar continuar.
- **Clientes**: pesquisa por nome ou telefone, reutiliza a ficha existente em vez de
  duplicar, e permite editar e apagar. Só se apaga quem já não tem marcações por
  acontecer; as antigas ficam nas estatísticas, sem o nome. A ficha mostra as visitas, o total em serviços, a
  última e a próxima visita, e o histórico de marcações — clicar numa abre-a na agenda.
- **Definições**: horário do salão dia a dia, funcionárias (nome, cor na agenda e folgas;
  apagam-se com a mesma regra dos clientes) e serviços (duração e preço), nas três
  sub-abas.
- **Tempo real entre aparelhos**: o que se marca num telemóvel aparece logo no computador
  e nos outros telemóveis (Supabase Realtime), e cada app recarrega também ao voltar a
  ser aberta, caso a ligação tenha caído entretanto.
- **Feedback das ações** ("Marcação guardada", erros) numa notificação que flutua em baixo,
  ao centro; os erros ficam até serem fechados.

## Pôr a trabalhar

1. `npm install`
2. Copia `.env.example` para `.env` e preenche com os dados do projeto Supabase
   (Project Settings → API).
3. No SQL Editor do Supabase:
   - `supabase/schema.sql` — cria tudo: tabelas, índices, RLS, proteção contra
     sobreposições e as configurações base. É o único ficheiro preciso numa base
     de dados nova.
   - `supabase/seed_teste.sql` — opcional, enche a semana atual com dados de teste
     (4 funcionárias, 11 serviços, 10 clientes, 33 marcações) para experimentares.
     Num salão a sério salta este passo e cria as funcionárias e serviços na app.
   - Para **recomeçar do zero** numa base de dados já usada: `supabase/reset.sql`
     (apaga todas as tabelas) e depois outra vez o `schema.sql`.
   - `supabase/migrations/` só interessa a quem criou a base de dados antes desta
     versão; num arranque novo não é preciso.
4. Cria a conta do salão em Authentication → Users → Add user (com email e palavra-passe).
5. `npm run tauri dev` para desenvolver, `npm run tauri build` para gerar o instalador
   (fica em `src-tauri/target/release/bundle/`).

## Atualizações automáticas

As apps instaladas procuram versões novas sozinhas ao abrir (e no botão ↻ da barra de
topo). As versões são publicadas pelo GitHub Actions (`.github/workflows/release.yml`)
no repositório **público** `Dinispg10/FlorDeLotus` — tem de ser público para as apps
conseguirem descarregar o `latest.json` sem login.

### Publicar uma versão nova

```
npm run versao 0.2.0          # muda a versão no tauri.conf.json, package.json e Cargo.toml
git commit -am "Versão 0.2.0"
git tag v0.2.0
git push && git push --tags   # a tag é que dispara a compilação no GitHub
```

O workflow recusa-se a publicar se a tag não bater com a versão do `tauri.conf.json` —
sem isso, a release saía com o número errado por dentro e nenhuma app se atualizava.

### Segredos no GitHub (Settings → Secrets and variables → Actions)

| Segredo | De onde vem |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | conteúdo de `~/.tauri/flordelotus.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | conteúdo de `~/.tauri/flordelotus.key.password.txt` |
| `VITE_SUPABASE_URL` | o mesmo do `.env` |
| `VITE_SUPABASE_ANON_KEY` | o mesmo do `.env` |

### ⚠ Não percas a chave de assinatura

As apps só aceitam atualizações assinadas com `~/.tauri/flordelotus.key`. **Se a chave ou
a palavra-passe se perderem, não há volta**: as apps já instaladas nunca mais se
atualizam, e é preciso reinstalar à mão em todos os computadores. Guarda os dois
ficheiros num sítio seguro fora deste computador (gestor de palavras-passe, por exemplo).
A chave **nunca** vai para o repositório — está fora da pasta do projeto de propósito.

## Contas e papéis

Não há registo público: as contas criam-se no Supabase, em **Authentication → Users →
Add user → Create new user**, com uma palavra-passe provisória e **Auto Confirm User**
marcado. A pessoa entra e muda-a em **Definições → Conta**. Quem se esquecer da
palavra-passe: apaga-se a conta e cria-se outra com o mesmo email (os dados do salão não
estão ligados às contas).

Cada conta tem um papel, na tabela **perfis** (Table Editor → perfis → coluna `papel`):

| | Gerente | Funcionária |
|---|---|---|
| Agenda, marcações, clientes, lembretes | ✓ | ✓ |
| Estatísticas | ✓ | — |
| Serviços, funcionárias, folgas/férias, horário | ✓ | só vê |

As contas novas nascem funcionária. As regras estão na base de dados
(`migrations/012_papeis.sql`), não só na app: mesmo por fora da app, uma funcionária
não consegue mudar o que é da gerente, nem promover-se.

## Cópias de segurança

Todas as noites o GitHub (workflow **Cópia de segurança**) copia a base de dados inteira,
tranca o ficheiro com uma palavra-passe e guarda-o 7 dias nos artefactos da execução.
A app do salão não tem nada disto: as cópias são só para quem gere o projeto.

**Segredos no GitHub** (Settings → Secrets and variables → Actions):

| Segredo | O quê |
|---|---|
| `SUPABASE_DB_URL` | Supabase → **Connect** → **Session pooler** → URI, com `[YOUR-PASSWORD]` trocado pela palavra-passe da base de dados |
| `COPIA_PASSWORD` | Uma palavra-passe inventada, só para trancar as cópias |

⚠️ Guarda a `COPIA_PASSWORD` num gestor de palavras-passe. Sem ela, as cópias não se abrem.

**Abrir uma cópia:** GitHub → Actions → Cópia de segurança → a execução do dia →
*Artifacts* → descarregar e descompactar o `.zip`. Depois, no Git Bash:

```bash
gpg --decrypt flordelotus-AAAA-MM-DD.sql.gz.gpg | gunzip > copia.sql
```

O `copia.sql` tem a estrutura e os dados de todas as tabelas, e dá para repor numa base
de dados vazia. Tem dados de clientes em claro: apaga-o quando já não for preciso.

O GitHub desliga os workflows agendados ao fim de 60 dias sem nenhum commit no
repositório. Se isso acontecer, avisa por email; basta voltar a ligá-lo em Actions.

## Segurança — ler antes de usar com clientes reais

A chave `anon` vai dentro da aplicação instalada, por isso as políticas RLS são a única
barreira. As políticas atuais dão acesso total a **qualquer utilizador autenticado**:

- **Desliga o registo público** no Supabase: Authentication → Providers → Email →
  desativar "Enable sign ups". Sem isto, qualquer pessoa pode criar conta e ler os dados
  dos clientes.
- Cria as contas da equipa manualmente no painel do Supabase.
- Os dados dos clientes (nome, telefone, observações) são dados pessoais: mantém o
  acesso limitado a quem trabalha no salão.

## Estrutura

```
src/
  lib/        supabase.ts, types.ts, datas.ts (datas em hora local), agenda.ts (regras), api.ts (consultas)
  hooks/      useSalao.ts — carrega funcionárias, serviços, clientes e a semana da agenda
  components/ Login, TopNav, AgendaView, EstatisticasView (contas em lib/estatisticas.ts), ClientesView,
              DefinicoesView (Horario/Funcionarias/ServicosView) e os modais (Modal,
              AgendamentoModal, ClienteModal, FuncionariaModal, ServicoModal)
supabase/     schema.sql (tudo), reset.sql (apaga tudo), seed_teste.sql, migrations/
src-tauri/    aplicação de secretária
scripts/      nova-versao.mjs (npm run versao)
.github/      workflow que publica as versões
```

## Ainda por fazer

- Envio automático de lembretes por SMS, sem ninguém carregar em enviar. Falta uma
  Edge Function no Supabase que guarde a chave do fornecedor (Twilio, Vonage ou um
  português) e mande as mensagens; a chave **não pode** ficar na app, porque se extrai do
  `.exe`. A ~6 cêntimos por SMS, 12 marcações por dia dão à volta de €18 por mês.
