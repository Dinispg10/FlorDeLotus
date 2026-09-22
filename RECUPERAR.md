# Se correr mal

Guia para os dias maus. Do mais provável para o menos provável.

**Antes de mexer em seja o que for:** vai ao GitHub → **Actions** → **Cópia de segurança**
→ **Run workflow**. Fica com uma cópia do estado atual, mesmo que esteja estragado. Se a
reposição correr mal, ainda se volta atrás.

---

## 1. Apagaram uma marcação ou um cliente por engano

**Se foi há pouco e é pouca coisa:** volta a criar à mão. É mais rápido e não mexe no
resto.

**Se foi muita coisa (uma semana de marcações, por exemplo):** repõe a cópia da noite
passada. Perde-se o que foi feito desde as 04:00 de hoje, por isso apontem primeiro num
papel o que foi marcado hoje.

Ver **"Como repor a cópia"**, mais abaixo.

---

## 2. A base de dados está estragada ou a app dá erros por todo o lado

1. Confirma que não é só a internet: abre outro site no mesmo PC.
2. Vê se o Supabase está em baixo: <https://status.supabase.com>.
3. Vê se o projeto não está **pausado** (acontece ao fim de 7 dias sem uso): entra em
   <https://supabase.com/dashboard>, abre o projeto e, se aparecer "Paused", carrega em
   **Restore**. Demora uns minutos e não se perde nada.
4. Se não for nada disto, repõe a cópia.

---

## Como repor a cópia

No GitHub → **Actions** → **Repor a cópia de segurança** → **Run workflow**. Na caixa,
escreve **REPOR** e confirma. Demora 2 a 3 minutos.

O que faz: apaga os dados do salão e põe-nos como estavam na **última cópia** (feita às
04:00). Repõe também as proteções de acesso, os papéis (gerente/funcionária) e a
atualização em tempo real.

O que **não** toca: as contas de acesso (Authentication → Users). Continuam todas, com as
mesmas palavras-passe.

No fim, a página mostra uma tabela "Na cópia / Reposto". Se alguma linha disser
`DIFERENTE`, não ignores: guarda o texto e pede ajuda.

**Repor uma cópia mais antiga do que a da noite passada:** as cópias ficam 7 dias em
Actions → Cópia de segurança, uma execução por dia. Para usar uma delas é preciso mudar
uma linha no workflow (ele pega sempre na mais recente); guarda o dia que queres e pede
ajuda.

---

## 3. O programa do computador não abre ou não atualiza

1. Descarrega o instalador mais recente de
   <https://github.com/Dinispg10/FlorDeLotus/releases/latest> (o ficheiro `-setup.exe`) e
   instala por cima. Não se perde nada: os dados estão todos no Supabase.
2. Entretanto, o salão pode trabalhar pelo telemóvel, em
   <https://flor-de-lotus-7rb.pages.dev>. É a mesma agenda.

---

## 4. Alguém não consegue entrar

- **Palavra-passe esquecida:** no Supabase → **Authentication → Users**, apaga a conta
  dela e cria outra com o mesmo email e uma palavra-passe provisória (marca **Auto Confirm
  User**). Ela muda-a depois em Definições → Conta. Não se perde nada: os dados do salão
  não estão ligados às contas.
- **Saiu da equipa:** apaga a conta. Deixa de conseguir entrar em qualquer aparelho.
- **Não vê as Estatísticas nem as Definições:** é uma conta de funcionária. Muda o papel
  em **Table Editor → perfis → papel**.

---

## 5. O projeto Supabase foi apagado

O pior caso. A cópia tem os dados todos, mas o endereço e as chaves mudam, por isso a app
tem de ser lançada outra vez.

1. Cria um projeto novo no Supabase (região Irlanda, `eu-west-1`), com uma palavra-passe
   de base de dados só com letras e números.
2. Corre o `supabase/schema.sql` no SQL Editor, para as tabelas existirem.
3. Atualiza os segredos no GitHub (**Settings → Secrets and variables → Actions**):
   `SUPABASE_DB_URL` (ligação **Session pooler** do projeto novo), `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` (Supabase → **Project Settings → API**).
4. Corre o workflow **Repor a cópia de segurança** para trazer os dados de volta.
5. Cria de novo as contas da equipa (**Authentication → Users**) e põe o teu papel a
   `gerente` em **Table Editor → perfis**.
6. Atualiza o `.env` no computador de desenvolvimento e lança uma versão nova
   (`npm run versao x.y.z`, `git tag`, `git push --tags`), para o programa e os telemóveis
   passarem a falar com o projeto novo.

---

## 6. Perdeste a palavra-passe das cópias (`COPIA_PASSWORD`)

As cópias antigas deixam de se poder abrir; não há volta a dar. Escolhe uma nova em
**Settings → Secrets and variables → Actions** e corre uma cópia à mão nesse dia. A partir
daí, as novas abrem com essa.

---

## O que nunca se perde

- **Os dados do salão** estão no Supabase e há uma cópia por dia, dos últimos 7 dias.
- **O programa** está no GitHub, versão a versão, e reinstala-se a qualquer momento.
- **A chave que assina as atualizações** está em `~/.tauri/flordelotus.key` no computador
  de desenvolvimento. Essa **não tem cópia em lado nenhum**: se se perder, as apps
  instaladas deixam de aceitar atualizações e é preciso reinstalar à mão em cada PC.
  Guarda-a num sítio seguro (por exemplo, num gestor de palavras-passe).
