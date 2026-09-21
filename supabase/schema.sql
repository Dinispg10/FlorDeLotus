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
  -- Ao apagar um cliente ou uma funcionária, as marcações antigas ficam (para as
  -- estatísticas) sem essa ligação. A app só deixa apagar quem já não tem marcações
  -- por acontecer.
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  funcionario_id UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  servico_id UUID REFERENCES servicos(id),
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
  )
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

CREATE POLICY "authenticated_users_manage_funcionarios"
ON funcionarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_manage_clientes"
ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_manage_servicos"
ON servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_manage_agendamentos"
ON agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_manage_ausencias"
ON ausencias FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_manage_configuracoes"
ON configuracoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_users_manage_logs_sms"
ON logs_sms FOR ALL TO authenticated USING (true) WITH CHECK (true);

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
  ('modelo_lembrete', 'Ola {cliente}! Lembrete da sua marcacao no Flor de Lotus: {dia} as {hora}, {servico} com {funcionaria}. Ate ja!');
