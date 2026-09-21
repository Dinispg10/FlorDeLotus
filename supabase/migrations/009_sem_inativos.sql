-- Clientes e funcionárias deixam de poder ficar "inativos": ou existem, ou apagam-se.
--
-- Quem estava inativo passa a aparecer outra vez nas listas; se não for para ficar,
-- apaga-se a partir da app.
--
-- Ao apagar alguém, as marcações antigas ficam (as estatísticas e a faturação
-- continuam certas), sem a ligação a essa pessoa. A app só deixa apagar quem já não
-- tem marcações por acontecer.

BEGIN;

ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_cliente_id_fkey;
ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;

ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_funcionario_id_fkey;
ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_funcionario_id_fkey
  FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE SET NULL;

ALTER TABLE clientes DROP COLUMN IF EXISTS ativo;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS ativo;

COMMIT;
