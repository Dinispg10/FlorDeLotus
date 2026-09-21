-- O horário do salão passa a ser definido dia a dia, para dar para fechar ao domingo
-- ou fazer horário mais curto ao sábado. Substitui o par horario_inicio_dia/horario_fim_dia.
--
-- "horario_1" é segunda e "horario_7" domingo; o valor é "09:00-19:00" ou "fechado".
-- A partir daqui edita-se na app, na página Definições.
--
-- As linhas novas herdam o horário único que existia antes; o domingo fica fechado.

INSERT INTO configuracoes (nome, valor)
SELECT
  d.nome,
  CASE
    WHEN d.nome = 'horario_7' THEN 'fechado'
    ELSE COALESCE((SELECT valor FROM configuracoes WHERE nome = 'horario_inicio_dia'), '09:00')
         || '-' ||
         COALESCE((SELECT valor FROM configuracoes WHERE nome = 'horario_fim_dia'), '19:00')
  END
FROM (VALUES
  ('horario_1'), ('horario_2'), ('horario_3'), ('horario_4'),
  ('horario_5'), ('horario_6'), ('horario_7')
) AS d(nome)
WHERE NOT EXISTS (SELECT 1 FROM configuracoes c WHERE c.nome = d.nome);

DELETE FROM configuracoes WHERE nome IN ('horario_inicio_dia', 'horario_fim_dia');
