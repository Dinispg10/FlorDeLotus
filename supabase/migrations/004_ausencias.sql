-- Folgas e férias das funcionárias.
-- Só é preciso em bases de dados criadas antes desta versão: o schema.sql já a inclui.

CREATE TABLE ausencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'folga' CHECK (tipo IN ('folga', 'ferias')),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  -- Horas a NULL = ausente o dia inteiro. Meio dia só se aplica a um dia isolado.
  hora_inicio TIME,
  hora_fim TIME,
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ausencias_fim_depois_inicio CHECK (data_fim >= data_inicio),
  CONSTRAINT ausencias_horas_coerentes CHECK (
    (hora_inicio IS NULL AND hora_fim IS NULL)
    OR (
      hora_inicio IS NOT NULL
      AND hora_fim IS NOT NULL
      AND hora_fim > hora_inicio
      AND data_inicio = data_fim
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_ausencias_funcionario ON ausencias (funcionario_id, data_inicio);

ALTER TABLE ausencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_users_manage_ausencias"
ON ausencias FOR ALL TO authenticated USING (true) WITH CHECK (true);
