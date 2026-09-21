-- ⚠ APAGA TUDO. Não tem volta atrás.
--
-- Deita abaixo as sete tabelas do salão com tudo o que têm lá dentro: marcações,
-- clientes, funcionárias, serviços, folgas, configurações e registos de SMS.
-- Só deve ser corrido quando se quer mesmo recomeçar do zero.
--
-- O que NÃO é apagado: as contas de acesso (Authentication → Users) e os papéis
-- (tabela perfis). Continuas a entrar com a mesma palavra-passe e a ser gerente.
--
-- A seguir a este ficheiro, corre o schema.sql.

DROP TABLE IF EXISTS logs_sms CASCADE;
DROP TABLE IF EXISTS agendamentos CASCADE;
DROP TABLE IF EXISTS ausencias CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS funcionarios CASCADE;
DROP TABLE IF EXISTS servicos CASCADE;
DROP TABLE IF EXISTS configuracoes CASCADE;
