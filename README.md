# Flor de Lotus — agenda do salão

Aplicação de secretária (Tauri + React + TypeScript) para gerir a agenda de um salão:
marcações por funcionária, fichas de clientes e catálogo de serviços. Os dados ficam no
Supabase, por isso vários computadores do salão veem a mesma agenda.

## O que a app faz

- **Barra de navegação no topo**: Agenda, Clientes, Estatísticas e Definições (com
  sub-abas Horário, Funcionárias e Serviços). A barra faz também de moldura da janela —
  arrasta-se por ela e tem os botões de minimizar, maximizar e fechar.
- **Agenda diária** com uma coluna por funcionária e grelha de horas. Os botões por cima
  filtram por funcionária: ao escolher uma, abre a **semana dela** (uma coluna por dia) a
  ocupar o ecrã todo. Clicar num espaço livre cria uma marcação já com o dia, a hora e a
  funcionária certos.
- **Estatísticas** (dia ou semana): marcações, faturação prevista e já realizada (o que
  já passou da hora), ocupação por funcionária e serviços mais pedidos.
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
  duplicar, e permite editar/desativar. A ficha mostra visitas, quanto já gastou, última
  e próxima vinda, e o histórico completo de marcações — clicar numa abre-a na agenda.
- **Definições**: horário do salão dia a dia, funcionárias (nome, cor na agenda e folgas)
  e serviços (duração e preço), nas três sub-abas.

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
  components/ Login, TopNav, AgendaView, EstatisticasView, ClientesView,
              DefinicoesView (Horario/Funcionarias/ServicosView) e os modais (Modal,
              AgendamentoModal, ClienteModal, FuncionariaModal, ServicoModal)
supabase/     schema.sql (tudo), reset.sql (apaga tudo), seed_teste.sql, migrations/
src-tauri/    aplicação de secretária
scripts/      nova-versao.mjs (npm run versao)
.github/      workflow que publica as versões
```

## Ainda por fazer

- Lembretes aos clientes. A página está escrita e posta de lado em
  `parked/mensagens/` — o LEIA-ME de lá explica como a voltar a ligar (WhatsApp, sem
  custos) e o que falta para o envio automático por SMS.
- Atualização automática entre computadores (Supabase Realtime).
