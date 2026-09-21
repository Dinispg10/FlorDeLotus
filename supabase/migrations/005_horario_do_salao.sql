-- Alarga o dia do salão para as 08:00-20:00.
-- Estas duas linhas mandam na grelha da agenda E no que a app deixa marcar:
-- marcações fora deste intervalo são recusadas.
-- Muda os valores aqui se o salão tiver outro horário.

UPDATE configuracoes SET valor = '08:00', atualizado_em = NOW()
WHERE nome = 'horario_inicio_dia';

UPDATE configuracoes SET valor = '20:00', atualizado_em = NOW()
WHERE nome = 'horario_fim_dia';

-- Se por alguma razão as linhas não existirem, cria-as.
INSERT INTO configuracoes (nome, valor)
SELECT d.nome, d.valor
FROM (VALUES ('horario_inicio_dia', '08:00'), ('horario_fim_dia', '20:00')) AS d(nome, valor)
WHERE NOT EXISTS (SELECT 1 FROM configuracoes c WHERE c.nome = d.nome);
