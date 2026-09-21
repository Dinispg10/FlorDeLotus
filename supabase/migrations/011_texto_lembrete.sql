-- Texto do lembrete com acentos (o antigo não os tinha, a pensar em SMS pagas).
-- Só muda se ainda estiver o texto de origem: um texto escrito pelo salão fica como está.
UPDATE configuracoes
SET valor = 'Olá {cliente}! Lembramos a sua marcação no Flor de Lotus: {dia} às {hora}, {servico} com {funcionaria}. Até já!',
    atualizado_em = now()
WHERE nome = 'modelo_lembrete'
  AND valor = 'Ola {cliente}! Lembrete da sua marcacao no Flor de Lotus: {dia} as {hora}, {servico} com {funcionaria}. Ate ja!';
