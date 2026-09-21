-- A especialidade das funcionárias deixou de ser usada: não aparecia em lado nenhum
-- de útil e obrigava a preencher um campo a mais ao criar cada funcionária.
-- Correr no SQL Editor do Supabase.

ALTER TABLE funcionarios DROP COLUMN IF EXISTS especialidade;
