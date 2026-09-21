-- Papéis: gerente e funcionária.
--
-- Só a gerente cria, muda ou apaga serviços, funcionárias, folgas/férias e o horário.
-- Toda a equipa continua a ler tudo isso (para marcar) e a gerir marcações, clientes
-- e lembretes, incluindo o texto do lembrete. As regras ficam na base de dados: não
-- chega esconder botões na app.
--
-- Quem não tiver papel conta como funcionária. Os papéis mudam-se no Supabase, em
-- Table Editor → perfis → coluna "papel". Pode correr-se mais do que uma vez.
--
-- ⚠ Depois de correr isto, torna a tua conta gerente (ver o fim do ficheiro), senão
--    deixas de conseguir mudar serviços, funcionárias e horário.

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

-- 4. A tua conta como gerente ----------------------------------------------------
--
-- Troca o email pelo teu e corre só esta linha (o email não fica guardado no código,
-- que é público):
--
--   UPDATE public.perfis SET papel = 'gerente' WHERE email = 'o-teu-email@exemplo.pt';
--
-- Para as outras contas: Table Editor → perfis → muda a coluna "papel".
