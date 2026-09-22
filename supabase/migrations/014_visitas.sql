-- Visitas: os serviços marcados juntos (corte + madeixas...) ficam ligados, e uma
-- visita guarda-se de uma só vez.
--
-- 1. Cada marcação passa a ter visita_id. As marcações que já existem ficam
--    agrupadas por cliente e dia.
-- 2. A proteção contra sobreposições passa a poder esperar pelo fim da gravação:
--    ao esticar o primeiro serviço, o seguinte anda para a frente, e por um instante
--    os dois estariam sobrepostos. Continua a ser verificada, só que no fim.
-- 3. guardar_visita(): apaga, muda e cria os serviços de uma visita numa só
--    transação. Ou fica tudo, ou não fica nada.
--
-- Pode correr-se mais do que uma vez.

-- 1. Ligar os serviços da mesma visita -------------------------------------------

ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS visita_id UUID;

-- A visita fica com o id do primeiro serviço desse cliente nesse dia.
UPDATE agendamentos AS a
SET visita_id = (
  SELECT b.id FROM agendamentos AS b
  WHERE b.cliente_id = a.cliente_id
    AND (b.data_hora_inicio AT TIME ZONE 'Europe/Lisbon')::date
        = (a.data_hora_inicio AT TIME ZONE 'Europe/Lisbon')::date
  ORDER BY b.data_hora_inicio, b.id
  LIMIT 1
)
WHERE a.visita_id IS NULL AND a.cliente_id IS NOT NULL;

-- Sem cliente (ficha apagada): cada marcação é a sua própria visita.
UPDATE agendamentos SET visita_id = id WHERE visita_id IS NULL;

-- Versões antigas da app não mandam visita_id: cada serviço fica na sua visita.
ALTER TABLE agendamentos ALTER COLUMN visita_id SET DEFAULT gen_random_uuid();
ALTER TABLE agendamentos ALTER COLUMN visita_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agendamentos_visita ON agendamentos(visita_id);

-- 2. Sobreposições verificadas no fim da gravação --------------------------------

ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_sem_sobreposicao;
ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_sem_sobreposicao EXCLUDE USING gist (
  funcionario_id WITH =,
  tstzrange(data_hora_inicio, data_hora_fim) WITH &&
) DEFERRABLE INITIALLY IMMEDIATE;

-- 3. Guardar uma visita inteira --------------------------------------------------
--
-- p_marcacoes: lista de serviços. Os que trazem "id" são mudados; os outros são
-- criados. p_apagar: ids de serviços da visita que saem. Corre com as permissões de
-- quem chama (as regras de acesso aplicam-se).

CREATE OR REPLACE FUNCTION public.guardar_visita(
  p_visita_id UUID,
  p_marcacoes JSONB,
  p_apagar UUID[] DEFAULT '{}'
)
RETURNS SETOF public.agendamentos
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  m JSONB;
  mudadas INTEGER;
BEGIN
  SET CONSTRAINTS public.agendamentos_sem_sobreposicao DEFERRED;

  DELETE FROM public.agendamentos
  WHERE id = ANY (p_apagar) AND visita_id = p_visita_id;

  FOR m IN SELECT * FROM jsonb_array_elements(p_marcacoes) LOOP
    IF m ? 'id' AND m->>'id' IS NOT NULL THEN
      UPDATE public.agendamentos SET
        visita_id = p_visita_id,
        cliente_id = (m->>'cliente_id')::uuid,
        funcionario_id = (m->>'funcionario_id')::uuid,
        servico_id = (m->>'servico_id')::uuid,
        data_hora_inicio = (m->>'data_hora_inicio')::timestamptz,
        data_hora_fim = (m->>'data_hora_fim')::timestamptz,
        duracao_minutos = (m->>'duracao_minutos')::integer,
        status = m->>'status',
        telefone_cliente = m->>'telefone_cliente',
        observacoes = m->>'observacoes'
      WHERE id = (m->>'id')::uuid;

      GET DIAGNOSTICS mudadas = ROW_COUNT;
      IF mudadas = 0 THEN
        RAISE EXCEPTION 'Um dos serviços desta visita já não existe (foi apagado noutro aparelho).'
          USING ERRCODE = 'P0002';
      END IF;
    ELSE
      INSERT INTO public.agendamentos (
        visita_id, cliente_id, funcionario_id, servico_id, data_hora_inicio,
        data_hora_fim, duracao_minutos, status, telefone_cliente, observacoes
      ) VALUES (
        p_visita_id,
        (m->>'cliente_id')::uuid,
        (m->>'funcionario_id')::uuid,
        (m->>'servico_id')::uuid,
        (m->>'data_hora_inicio')::timestamptz,
        (m->>'data_hora_fim')::timestamptz,
        (m->>'duracao_minutos')::integer,
        m->>'status',
        m->>'telefone_cliente',
        m->>'observacoes'
      );
    END IF;
  END LOOP;

  -- Verificar as sobreposições já aqui, para o erro vir com a mensagem certa.
  SET CONSTRAINTS public.agendamentos_sem_sobreposicao IMMEDIATE;

  RETURN QUERY SELECT * FROM public.agendamentos WHERE visita_id = p_visita_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guardar_visita(UUID, JSONB, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_visita(UUID, JSONB, UUID[]) TO authenticated;
