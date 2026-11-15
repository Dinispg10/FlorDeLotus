-- O cliente faltou.
--
-- Uma marcação passa a poder estar "faltou": ficou na agenda e no histórico do
-- cliente, mas não entra nas contas. Sem isto, quem não aparece conta como
-- dinheiro ganho e a faturação do mês fica inflacionada.
--
-- Não é o mesmo que cancelar (migração 008): cancelar é apagar, porque a marcação
-- não vai acontecer; faltar é um facto que aconteceu e que vale a pena guardar.
--
-- Pode correr-se mais do que uma vez.

BEGIN;

ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;
ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_status_check
  CHECK (status IN ('confirmado', 'pendente', 'faltou'));

COMMIT;
