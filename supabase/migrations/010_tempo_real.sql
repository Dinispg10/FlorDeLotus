-- Atualização em tempo real entre aparelhos.
-- Quando alguém marca no telemóvel, os outros aparelhos com a app aberta são avisados
-- pelo Supabase e recarregam sozinhos. O Supabase só avisa das tabelas que estão na
-- publicação supabase_realtime; este ficheiro põe lá as da app.
--
-- Os avisos respeitam as mesmas regras de acesso (RLS): só chegam a quem tem sessão.
-- Pode ser corrido mais do que uma vez.

DO $tempo_real$
DECLARE
  tabela TEXT;
BEGIN
  -- No Supabase esta publicação já existe; num Postgres simples cria-se.
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH tabela IN ARRAY ARRAY[
    'agendamentos', 'ausencias', 'clientes', 'funcionarios', 'servicos', 'configuracoes'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tabela
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabela);
    END IF;
  END LOOP;
END;
$tempo_real$;
