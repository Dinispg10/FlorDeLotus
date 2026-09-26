-- Perfis que não dependem do gatilho.
--
-- O perfil de cada conta era criado por um gatilho na tabela auth.users, que é do
-- Supabase e nem sempre nos deixa lá mexer. Quando isso falha, a conta fica sem
-- perfil e conta como funcionária, mas não aparece na tabela para se lhe mudar o papel.
--
-- A partir daqui há três redes: cada pessoa pode criar o seu próprio perfil (sempre
-- como funcionária) na primeira entrada, o gatilho continua a ser tentado, e as contas
-- que já existem são preenchidas aqui.
--
-- Pode correr-se mais do que uma vez.

-- 1. Cada pessoa cria o seu perfil, e só o seu, e só como funcionária ---------------

DROP POLICY IF EXISTS "cada_um_cria_o_seu_perfil" ON public.perfis;
CREATE POLICY "cada_um_cria_o_seu_perfil"
ON public.perfis FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()) AND papel = 'funcionaria');

-- 2. O gatilho continua a ser tentado; se não der, a app trata disso ---------------

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

DO $gatilho$
BEGIN
  DROP TRIGGER IF EXISTS ao_criar_conta ON auth.users;
  CREATE TRIGGER ao_criar_conta
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.criar_perfil_da_conta();
EXCEPTION
  WHEN insufficient_privilege OR undefined_table THEN
    RAISE NOTICE 'Sem permissão para o gatilho em auth.users. Não faz mal: os perfis são criados pela app na primeira entrada.';
END;
$gatilho$;

-- 3. Contas que já existem ficam com perfil --------------------------------------

INSERT INTO public.perfis (user_id, email)
SELECT id, email FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
