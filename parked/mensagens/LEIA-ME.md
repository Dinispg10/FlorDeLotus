# Lembretes por WhatsApp — posto de lado

Esta pasta guarda a página de Mensagens, tirada da app a pedido. Não é compilada
(o `tsconfig.json` só inclui `src/`), por isso não pesa nada nem estorva.

## O que fazia

Abria no dia seguinte e listava as marcações desse dia. Por cada uma, um botão
abria o WhatsApp com o lembrete já escrito e marcava a pessoa como avisada. O texto
da mensagem era editável, com campos entre chavetas (`{cliente}`, `{hora}`, ...).

Escolheu-se WhatsApp em vez de SMS por causa do custo: a ~6 cêntimos por SMS, um
salão com 12 marcações por dia gastaria à volta de €18 por mês só em lembretes.

## Para voltar a ligar

1. `mensagens.ts` → `src/lib/mensagens.ts`
2. `MensagensView.tsx` → `src/components/MensagensView.tsx`
3. Colar o conteúdo de `mensagens.css` no `src/App.css` (antes da secção Definições)
4. Em `src/components/TopNav.tsx`: acrescentar `"mensagens"` ao tipo `Separador` e
   `{ chave: "mensagens", rotulo: "Mensagens" }` à lista, a seguir a Clientes
5. Em `src/App.tsx`: importar a página e acrescentar o ramo antes das Estatísticas:

   ```tsx
   ) : separador === "mensagens" ? (
     <MensagensView
       configuracoes={salao.configuracoes}
       funcionarios={salao.funcionarios}
       servicos={salao.servicos}
       onConfiguracoesAlteradas={salao.recarregarBase}
       onErro={salao.setErro}
       onAviso={setAviso}
     />
   ```

6. Em `src-tauri/capabilities/default.json`: acrescentar `"opener:allow-open-url"`,
   senão o WhatsApp não abre a partir da app
7. Correr `supabase/migrations/007_modelo_lembrete.sql`, se ainda não o tiveres feito

## O que ficou na app (e pode ficar)

Nada disto atrapalha, e é o que a página precisa quando voltar:

- `api.guardarModeloLembrete`, `api.registarLembrete` e `api.anularLembrete` em
  `src/lib/api.ts`
- O campo `lembreteEnviado` no tipo `Agendamento` e `modeloLembrete` em `Configuracoes`
- As tabelas `logs_sms` e a coluna `agendamentos.lembrete_enviado` na base de dados
- A linha `modelo_lembrete` na tabela `configuracoes`

## Se um dia quiseres o botão único, por SMS

Falta só a parte do envio: uma Edge Function no Supabase que guarde a chave do
fornecedor (Twilio, Vonage ou um português) e mande as mensagens. A chave **não pode**
ficar na app — é extraível do `.exe`, como a chave anon do Supabase.
