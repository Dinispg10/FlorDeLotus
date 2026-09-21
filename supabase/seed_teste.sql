BEGIN;

-- Sem isto, uma base de dados vazia responderia apenas
-- 'relation "agendamentos" does not exist', que não diz o que fazer.
DO $verificacao$
BEGIN
  IF to_regclass('public.agendamentos') IS NULL THEN
    RAISE EXCEPTION 'As tabelas ainda não existem. Corre primeiro o schema.sql e só depois este ficheiro.';
  END IF;
END;
$verificacao$;

DELETE FROM agendamentos WHERE observacoes = 'Dados de teste';
DELETE FROM clientes WHERE observacoes = 'Dados de teste';

-- Funcionárias e serviços só entram se ainda não existirem com esse nome.
INSERT INTO funcionarios (nome, cor, ativo)
SELECT d.nome, d.cor, true
FROM (VALUES
  ('Maria', '#7C3AED'),
  ('Sofia', '#10B981'),
  ('Ana',   '#EC4899'),
  ('Carla', '#F59E0B')
) AS d(nome, cor)
WHERE NOT EXISTS (SELECT 1 FROM funcionarios f WHERE f.nome = d.nome);

INSERT INTO servicos (nome, duracao_minutos, preco, ativo)
SELECT d.nome, d.duracao, d.preco, true
FROM (VALUES
  ('Corte feminino',      60, 35.00),
  ('Corte + brushing',    75, 45.00),
  ('Coloração',           90, 80.00),
  ('Madeixas',           120, 95.00),
  ('Tratamento facial',   45, 55.00),
  ('Limpeza de pele',     60, 50.00),
  ('Manicure',            40, 22.00),
  ('Pedicure',            50, 28.00),
  ('Unhas de gel',        75, 40.00),
  ('Massagem relaxante',  60, 65.00),
  ('Massagem de costas',  30, 35.00)
) AS d(nome, duracao, preco)
WHERE NOT EXISTS (SELECT 1 FROM servicos s WHERE s.nome = d.nome);

INSERT INTO clientes (nome, telefone, observacoes, ativo)
VALUES
  ('Rita Costa',      '+351 912 345 678', 'Dados de teste', true),
  ('Marta Silva',     '+351 913 222 333', 'Dados de teste', true),
  ('Joana Pereira',   '+351 918 444 555', 'Dados de teste', true),
  ('Clara Mendes',    '+351 916 676 787', 'Dados de teste', true),
  ('Inês Rocha',      '+351 911 202 303', 'Dados de teste', true),
  ('Sónia Martins',   '+351 914 505 606', 'Dados de teste', true),
  ('Beatriz Nunes',   '+351 915 707 808', 'Dados de teste', true),
  ('Helena Dias',     '+351 917 909 101', 'Dados de teste', true),
  ('Patrícia Gomes',  '+351 919 111 222', 'Dados de teste', true),
  ('Carolina Faria',  '+351 910 333 444', 'Dados de teste', true);

-- dia: 0 = segunda desta semana, 1 = terça, ... 5 = sábado.
-- As horas são hora local do salão e nenhuma funcionária fica com marcações sobrepostas.
WITH base AS (
  SELECT date_trunc('week', CURRENT_DATE)::date AS segunda
),
marcacoes(cliente, funcionaria, servico, dia, hora, duracao, estado) AS (
  VALUES
    -- Maria (cabeleireira)
    ('Rita Costa',     'Maria', 'Corte feminino',     0, '09:30',  60, 'confirmado'),
    ('Marta Silva',    'Maria', 'Coloração',          0, '11:00',  90, 'confirmado'),
    ('Inês Rocha',     'Maria', 'Madeixas',           0, '14:00', 120, 'confirmado'),
    ('Joana Pereira',  'Maria', 'Corte + brushing',   1, '10:00',  75, 'confirmado'),
    ('Helena Dias',    'Maria', 'Coloração',          1, '15:00',  90, 'pendente'),
    ('Sónia Martins',  'Maria', 'Madeixas',           2, '09:30', 120, 'confirmado'),
    ('Beatriz Nunes',  'Maria', 'Corte feminino',     2, '14:30',  60, 'confirmado'),
    ('Clara Mendes',   'Maria', 'Coloração',          3, '10:00',  90, 'confirmado'),
    ('Patrícia Gomes', 'Maria', 'Corte + brushing',   4, '09:30',  75, 'confirmado'),
    ('Carolina Faria', 'Maria', 'Madeixas',           4, '14:00', 120, 'pendente'),
    ('Rita Costa',     'Maria', 'Corte feminino',     5, '09:30',  60, 'confirmado'),
    ('Joana Pereira',  'Maria', 'Coloração',          5, '11:00',  90, 'confirmado'),

    -- Sofia (estética)
    ('Clara Mendes',   'Sofia', 'Tratamento facial',  0, '10:00',  45, 'confirmado'),
    ('Beatriz Nunes',  'Sofia', 'Limpeza de pele',    0, '11:30',  60, 'confirmado'),
    ('Rita Costa',     'Sofia', 'Limpeza de pele',    1, '09:30',  60, 'confirmado'),
    ('Marta Silva',    'Sofia', 'Tratamento facial',  1, '14:00',  45, 'confirmado'),
    ('Helena Dias',    'Sofia', 'Tratamento facial',  2, '16:00',  45, 'confirmado'),
    ('Patrícia Gomes', 'Sofia', 'Limpeza de pele',    3, '11:00',  60, 'pendente'),
    ('Carolina Faria', 'Sofia', 'Limpeza de pele',    5, '10:00',  60, 'confirmado'),

    -- Ana (manicure)
    ('Sónia Martins',  'Ana',   'Manicure',           0, '09:30',  40, 'confirmado'),
    ('Patrícia Gomes', 'Ana',   'Unhas de gel',       0, '10:30',  75, 'confirmado'),
    ('Helena Dias',    'Ana',   'Pedicure',           0, '14:00',  50, 'confirmado'),
    ('Carolina Faria', 'Ana',   'Manicure',           1, '11:00',  40, 'confirmado'),
    ('Rita Costa',     'Ana',   'Unhas de gel',       2, '10:00',  75, 'confirmado'),
    ('Marta Silva',    'Ana',   'Manicure',           3, '14:30',  40, 'confirmado'),
    ('Joana Pereira',  'Ana',   'Pedicure',           4, '10:00',  50, 'pendente'),
    ('Clara Mendes',   'Ana',   'Unhas de gel',       5, '11:30',  75, 'confirmado'),

    -- Carla (massagem)
    ('Beatriz Nunes',  'Carla', 'Massagem relaxante', 0, '15:30',  60, 'confirmado'),
    ('Inês Rocha',     'Carla', 'Massagem de costas', 1, '10:30',  30, 'confirmado'),
    ('Clara Mendes',   'Carla', 'Massagem relaxante', 2, '15:00',  60, 'confirmado'),
    ('Rita Costa',     'Carla', 'Massagem de costas', 3, '09:30',  30, 'confirmado'),
    ('Helena Dias',    'Carla', 'Massagem relaxante', 4, '16:00',  60, 'confirmado'),
    ('Marta Silva',    'Carla', 'Massagem de costas', 5, '10:00',  30, 'confirmado')
)
INSERT INTO agendamentos (
  cliente_id, funcionario_id, servico_id,
  data_hora_inicio, data_hora_fim, duracao_minutos,
  status, telefone_cliente, observacoes, lembrete_enviado
)
SELECT
  c.id,
  f.id,
  s.id,
  ((b.segunda + m.dia) + m.hora::time) AT TIME ZONE 'Europe/Lisbon',
  (((b.segunda + m.dia) + m.hora::time) AT TIME ZONE 'Europe/Lisbon')
    + (m.duracao * INTERVAL '1 minute'),
  m.duracao,
  m.estado,
  c.telefone,
  'Dados de teste',
  false
FROM marcacoes m
CROSS JOIN base b
-- LATERAL + LIMIT 1: mesmo que exista mais do que uma funcionária com o mesmo
-- nome, cada linha gera uma única marcação.
JOIN LATERAL (
  SELECT id, telefone FROM clientes
  WHERE nome = m.cliente AND observacoes = 'Dados de teste' LIMIT 1
) c ON TRUE
JOIN LATERAL (
  SELECT id FROM funcionarios WHERE nome = m.funcionaria ORDER BY criado_em LIMIT 1
) f ON TRUE
JOIN LATERAL (
  SELECT id FROM servicos WHERE nome = m.servico ORDER BY criado_em LIMIT 1
) s ON TRUE;

COMMIT;
