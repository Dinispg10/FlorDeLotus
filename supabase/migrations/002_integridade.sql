-- Integridade e desempenho da agenda.
-- Correr no SQL Editor do Supabase depois do schema.sql.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE INDEX IF NOT EXISTS idx_agendamentos_inicio
  ON agendamentos (data_hora_inicio);

CREATE INDEX IF NOT EXISTS idx_agendamentos_funcionario_inicio
  ON agendamentos (funcionario_id, data_hora_inicio);

CREATE INDEX IF NOT EXISTS idx_clientes_telefone
  ON clientes (telefone);

-- O fim tem de ser depois do início.
DO $$
BEGIN
  ALTER TABLE agendamentos
    ADD CONSTRAINT agendamentos_fim_depois_inicio
    CHECK (data_hora_fim > data_hora_inicio);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- A app já valida sobreposições, mas a base de dados é a última linha de defesa:
-- duas pessoas a marcar ao mesmo tempo, em computadores diferentes, não podem
-- ficar com a mesma funcionária à mesma hora. Marcações canceladas não contam.
DO $$
BEGIN
  ALTER TABLE agendamentos
    ADD CONSTRAINT agendamentos_sem_sobreposicao
    EXCLUDE USING gist (
      funcionario_id WITH =,
      tstzrange(data_hora_inicio, data_hora_fim) WITH &&
    ) WHERE (status <> 'cancelado');
EXCEPTION
  -- duplicate_table: a constraint EXCLUDE cria um índice com o mesmo nome, e é esse
  -- que o Postgres reclama quando a proteção já lá está.
  WHEN duplicate_object OR duplicate_table THEN NULL;
  WHEN unique_violation THEN
    RAISE NOTICE 'Existem marcações sobrepostas na base de dados. Corrige-as e volta a correr este ficheiro.';
END;
$$;
