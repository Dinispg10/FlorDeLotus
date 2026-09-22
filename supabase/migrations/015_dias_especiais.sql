-- Feriados e dias especiais, escolhidos à mão em Definições → Horário.
--
-- Cada dia tem o seu horário (fechado, ou aberto das X às Y) e, nesse dia, manda em
-- vez do horário normal da semana: não se marca fora dele, a agenda mostra-o e as
-- estatísticas descontam-no. Todas leem; só a gerente cria, muda ou apaga.
--
-- Precisa da migração 012 (papéis). Pode correr-se mais do que uma vez.

CREATE TABLE IF NOT EXISTS dias_especiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  aberto BOOLEAN NOT NULL DEFAULT FALSE,
  hora_inicio TIME,
  hora_fim TIME,
  criado_em TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT dias_especiais_horas CHECK (
    NOT aberto OR (hora_inicio IS NOT NULL AND hora_fim IS NOT NULL AND hora_fim > hora_inicio)
  )
);

ALTER TABLE dias_especiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "todos_leem_dias_especiais" ON dias_especiais;
DROP POLICY IF EXISTS "gerente_gere_dias_especiais" ON dias_especiais;
CREATE POLICY "todos_leem_dias_especiais"
ON dias_especiais FOR SELECT TO authenticated USING (true);
CREATE POLICY "gerente_gere_dias_especiais"
ON dias_especiais FOR ALL TO authenticated
USING ((SELECT public.e_gerente())) WITH CHECK ((SELECT public.e_gerente()));

-- Tempo real: um feriado criado no computador aparece logo nos telemóveis.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dias_especiais'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dias_especiais;
  END IF;
END;
$$;
