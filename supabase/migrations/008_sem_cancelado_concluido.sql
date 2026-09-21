-- Os estados "cancelado" e "concluido" deixam de existir.
-- Uma marcação passa a estar só confirmada ou pendente; cancelar é apagar.
--
-- ATENÇÃO: este ficheiro APAGA as marcações que estavam canceladas.
-- As concluídas passam a confirmadas (continuam na agenda e no histórico).

BEGIN;

-- 1. O registo de mensagens não pode impedir que se apague uma marcação.
ALTER TABLE logs_sms DROP CONSTRAINT IF EXISTS logs_sms_agendamento_id_fkey;
ALTER TABLE logs_sms
  ADD CONSTRAINT logs_sms_agendamento_id_fkey
  FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE SET NULL;

-- 2. Canceladas saem; concluídas passam a confirmadas.
DELETE FROM agendamentos WHERE status = 'cancelado';
UPDATE agendamentos SET status = 'confirmado' WHERE status = 'concluido';

-- 3. A base de dados passa a recusar os estados antigos.
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;
ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_status_check CHECK (status IN ('confirmado', 'pendente'));

COMMIT;
