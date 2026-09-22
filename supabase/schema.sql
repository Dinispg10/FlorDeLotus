-- Estrutura completa da base de dados do salão.
-- Correr uma vez, no SQL Editor do Supabase, numa base de dados vazia.
-- Para limpar uma base de dados já usada antes, corre primeiro o reset.sql.
--
-- Já inclui os índices e as proteções que antes estavam em migrations/. A pasta
-- migrations/ só interessa a quem criou a base de dados antes desta versão.

CREATE EXTENSION IF NOT EXISTS btree_gist;

/* ------------------------------------------------------------------ */
/* Tabelas                                                             */
/* ------------------------------------------------------------------ */

CREATE TABLE funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#8B5CF6',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 60,
  preco NUMERIC(10,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Os serviços marcados juntos (corte + madeixas...) partilham a visita.
  visita_id UUID NOT NULL DEFAULT gen_random_uuid(),
  -- Ao apagar um cliente ou uma funcionária, as marcações antigas ficam (para as
  -- estatísticas) sem essa ligação. A app só deixa apagar quem já não tem marcações
  -- por acontecer.
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  funcionario_id UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  servico_id UUID REFERENCES servicos(id),
  -- Preço e nome do serviço no momento da marcação, como numa fatura (ver os
  -- gatilhos mais abaixo): mudar o preço do serviço não mexe no que já passou.
  preco NUMERIC(10, 2),
  servico_nome TEXT,
  data_hora_inicio TIMESTAMPTZ NOT NULL,
  data_hora_fim TIMESTAMPTZ NOT NULL,
  duracao_minutos INTEGER DEFAULT NULL,
  -- Cancelar uma marcação é apagá-la; não há estados de cancelada nem concluída.
  status TEXT NOT NULL DEFAULT 'confirmado'
    CHECK (status IN ('confirmado', 'pendente')),
  telefone_cliente TEXT,
  observacoes TEXT,
  lembrete_enviado BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT agendamentos_fim_depois_inicio CHECK (data_hora_fim > data_hora_inicio),

  -- A app já valida sobreposições, mas a base de dados é a última linha de defesa:
  -- duas pessoas a marcar ao mesmo tempo, em computadores diferentes, não podem
  -- ficar com a mesma funcionária à mesma hora.
  CONSTRAINT agendamentos_sem_sobreposicao EXCLUDE USING gist (
    funcionario_id WITH =,
    tstzrange(data_hora_inicio, data_hora_fim) WITH &&
  ) DEFERRABLE INITIALLY IMMEDIATE
);

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

CREATE TABLE configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  valor TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE logs_sms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Apagar (cancelar) uma marcação não pode ser travado pelo registo de mensagens.
  agendamento_id UUID REFERENCES agendamentos(id) ON DELETE SET NULL,
  destinatario TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'confirmacao'
    CHECK (tipo IN ('confirmacao', 'lembrete', 'cancelamento', 'alteracao')),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'enviado', 'falhou')),
  mensagem TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

/* ------------------------------------------------------------------ */
/* Índices                                                             */
/* ------------------------------------------------------------------ */

CREATE INDEX idx_agendamentos_inicio ON agendamentos (data_hora_inicio);
CREATE INDEX idx_agendamentos_funcionario_inicio ON agendamentos (funcionario_id, data_hora_inicio);
CREATE INDEX idx_clientes_telefone ON clientes (telefone);
CREATE INDEX idx_ausencias_funcionario ON ausencias (funcionario_id, data_inicio);

/* ------------------------------------------------------------------ */
/* Segurança: só quem tem sessão iniciada vê ou mexe nos dados          */
/* ------------------------------------------------------------------ */

ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ausencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_sms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_users_manage_clientes"
ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_manage_agendamentos"
ON agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_manage_logs_sms"
ON logs_sms FOR ALL TO authenticated USING (true) WITH CHECK (true);


/* ------------------------------------------------------------------ */
/* Visitas: vários serviços guardados de uma só vez                    */
/* ------------------------------------------------------------------ */

CREATE INDEX IF NOT EXISTS idx_agendamentos_visita ON agendamentos(visita_id);

-- Guardar uma visita inteira (ver migrations/014_visitas.sql).
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

/* ------------------------------------------------------------------ */
/* Preço guardado em cada marcação (ver migrations/013)                */
/* ------------------------------------------------------------------ */

-- Ao marcar, ou ao trocar o serviço de uma marcação, copia-se o preço e o nome.
-- Editar outra coisa (hora, observações...) não toca no preço guardado.
CREATE OR REPLACE FUNCTION public.copiar_preco_do_servico()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.servico_id IS DISTINCT FROM OLD.servico_id THEN
    SELECT s.preco, s.nome INTO NEW.preco, NEW.servico_nome
    FROM public.servicos AS s
    WHERE s.id = NEW.servico_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS copiar_preco_ao_marcar ON agendamentos;
CREATE TRIGGER copiar_preco_ao_marcar
BEFORE INSERT OR UPDATE OF servico_id ON agendamentos
FOR EACH ROW EXECUTE FUNCTION public.copiar_preco_do_servico();

-- Quando a gerente muda o preço ou o nome de um serviço, as marcações de hoje em
-- diante acompanham; as que já passaram ficam como estavam.
CREATE OR REPLACE FUNCTION public.atualizar_marcacoes_futuras()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.preco IS DISTINCT FROM OLD.preco OR NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE public.agendamentos
    SET preco = NEW.preco, servico_nome = NEW.nome
    WHERE servico_id = NEW.id
      AND data_hora_inicio >= date_trunc('day', now() AT TIME ZONE 'Europe/Lisbon')
                              AT TIME ZONE 'Europe/Lisbon';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS acompanhar_preco_novo ON servicos;
CREATE TRIGGER acompanhar_preco_novo
AFTER UPDATE OF preco, nome ON servicos
FOR EACH ROW EXECUTE FUNCTION public.atualizar_marcacoes_futuras();

/* ------------------------------------------------------------------ */
/* Papéis: gerente e funcionária (ver migrations/012_papeis.sql)       */
/* ------------------------------------------------------------------ */
-- A tabela perfis não é apagada pelo reset.sql: os papéis sobrevivem a um recomeço.
-- Numa base nova, torna a tua conta gerente:
--   UPDATE public.perfis SET papel = 'gerente' WHERE email = 'o-teu-email@exemplo.pt';

-- 1. Um perfil por conta de acesso ----------------------------------------------

CREATE TABLE IF NOT EXISTS public.perfis (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Só para se saber de quem é a linha no Table Editor.
  email TEXT,
  papel TEXT NOT NULL DEFAULT 'funcionaria' CHECK (papel IN ('gerente', 'funcionaria')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Cada pessoa lê só o seu perfil. Ninguém o muda a partir da app: só no Supabase.
DROP POLICY IF EXISTS "cada_um_le_o_seu_perfil" ON public.perfis;
CREATE POLICY "cada_um_le_o_seu_perfil"
ON public.perfis FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- Contas criadas daqui em diante ganham logo um perfil de funcionária.
CREATE OR REPLACE FUNCTION public.criar_perfil_da_conta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.perfis (user_id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ao_criar_conta ON auth.users;
CREATE TRIGGER ao_criar_conta
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.criar_perfil_da_conta();

-- Contas que já existem: também funcionária, até alguém dizer o contrário.
INSERT INTO public.perfis (user_id, email)
SELECT id, email FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 2. "Quem está a pedir é gerente?" --------------------------------------------

CREATE OR REPLACE FUNCTION public.e_gerente()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE user_id = (SELECT auth.uid()) AND papel = 'gerente'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.e_gerente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.e_gerente() TO authenticated;

-- 3. Serviços, funcionárias, folgas/férias e horário ----------------------------

DROP POLICY IF EXISTS "authenticated_users_manage_funcionarios" ON funcionarios;
DROP POLICY IF EXISTS "todos_leem_funcionarios" ON funcionarios;
DROP POLICY IF EXISTS "gerente_gere_funcionarios" ON funcionarios;
CREATE POLICY "todos_leem_funcionarios"
ON funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "gerente_gere_funcionarios"
ON funcionarios FOR ALL TO authenticated
USING ((SELECT public.e_gerente())) WITH CHECK ((SELECT public.e_gerente()));

DROP POLICY IF EXISTS "authenticated_users_manage_servicos" ON servicos;
DROP POLICY IF EXISTS "todos_leem_servicos" ON servicos;
DROP POLICY IF EXISTS "gerente_gere_servicos" ON servicos;
CREATE POLICY "todos_leem_servicos"
ON servicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "gerente_gere_servicos"
ON servicos FOR ALL TO authenticated
USING ((SELECT public.e_gerente())) WITH CHECK ((SELECT public.e_gerente()));

DROP POLICY IF EXISTS "authenticated_users_manage_ausencias" ON ausencias;
DROP POLICY IF EXISTS "todos_leem_ausencias" ON ausencias;
DROP POLICY IF EXISTS "gerente_gere_ausencias" ON ausencias;
CREATE POLICY "todos_leem_ausencias"
ON ausencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "gerente_gere_ausencias"
ON ausencias FOR ALL TO authenticated
USING ((SELECT public.e_gerente())) WITH CHECK ((SELECT public.e_gerente()));

-- Configurações: o horário é da gerente; o texto do lembrete é de todas.
DROP POLICY IF EXISTS "authenticated_users_manage_configuracoes" ON configuracoes;
DROP POLICY IF EXISTS "todos_leem_configuracoes" ON configuracoes;
DROP POLICY IF EXISTS "gerente_gere_configuracoes" ON configuracoes;
DROP POLICY IF EXISTS "todos_criam_texto_lembrete" ON configuracoes;
DROP POLICY IF EXISTS "todos_mudam_texto_lembrete" ON configuracoes;
CREATE POLICY "todos_leem_configuracoes"
ON configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "gerente_gere_configuracoes"
ON configuracoes FOR ALL TO authenticated
USING ((SELECT public.e_gerente())) WITH CHECK ((SELECT public.e_gerente()));
CREATE POLICY "todos_criam_texto_lembrete"
ON configuracoes FOR INSERT TO authenticated WITH CHECK (nome = 'modelo_lembrete');
CREATE POLICY "todos_mudam_texto_lembrete"
ON configuracoes FOR UPDATE TO authenticated
USING (nome = 'modelo_lembrete') WITH CHECK (nome = 'modelo_lembrete');

/* ------------------------------------------------------------------ */
/* Tempo real: avisar os outros aparelhos quando algo muda             */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Configurações base do salão                                         */
/* ------------------------------------------------------------------ */

-- Horário do salão, um dia por linha: "horario_1" é segunda e "horario_7" domingo.
-- O valor é "09:00-19:00" ou "fechado". Edita-se na app, na página Definições.
INSERT INTO configuracoes (nome, valor) VALUES
  ('horario_1', '09:00-19:00'),
  ('horario_2', '09:00-19:00'),
  ('horario_3', '09:00-19:00'),
  ('horario_4', '09:00-19:00'),
  ('horario_5', '09:00-19:00'),
  ('horario_6', '09:00-18:00'),
  ('horario_7', 'fechado'),
  ('lembrete_horas_antes', '8'),
  ('sms_ativo', 'false'),
  ('modelo_lembrete', 'Olá {cliente}! Lembramos a sua marcação no Flor de Lotus: {dia} às {hora}, {servico} com {funcionaria}. Até já!');
