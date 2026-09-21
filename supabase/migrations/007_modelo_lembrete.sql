-- Texto dos lembretes enviados aos clientes.
-- Editável na app, na página Mensagens. Os campos entre chavetas são substituídos
-- por cliente, dia, hora, servico e funcionaria.

INSERT INTO configuracoes (nome, valor)
SELECT 'modelo_lembrete', 'Ola {cliente}! Lembrete da sua marcacao no Flor de Lotus: {dia} as {hora}, {servico} com {funcionaria}. Ate ja!'
WHERE NOT EXISTS (SELECT 1 FROM configuracoes WHERE nome = 'modelo_lembrete');
