-- Cada marcação guarda o preço (e o nome) do serviço, como numa fatura.
--
-- Mudar o preço de um serviço já não mexe no que passou: as estatísticas e o total
-- da ficha do cliente usam o preço guardado em cada marcação. As marcações de hoje
-- em diante acompanham o preço novo. Tudo isto é feito pela base de dados, venha a
-- marcação do computador, de um telemóvel ou de uma versão antiga da app.
--
-- Pode correr-se mais do que uma vez.

ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS preco NUMERIC(10, 2);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS servico_nome TEXT;

-- Marcações que já existem: ficam com o preço e o nome atuais do serviço.
UPDATE agendamentos AS a
SET preco = s.preco, servico_nome = s.nome
FROM servicos AS s
WHERE a.servico_id = s.id AND a.preco IS NULL;

-- Ao marcar, ou ao trocar o serviço de uma marcação, copia-se o preço e o nome.
-- Editar outra coisa (hora, observações...) não toca no preço guardado.
CREATE OR REPLACE FUNCTION public.copiar_preco_do_servico()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.servico_id IS DISTINCT FROM OLD.servico_id THEN
    SELECT s.preco, s.nome INTO NEW.preco, NEW.servico_nome
    FROM public.servicos AS s
    WHERE s.id = NEW.servico_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS copiar_preco_ao_marcar ON agendamentos;
CREATE TRIGGER copiar_preco_ao_marcar
BEFORE INSERT OR UPDATE OF servico_id ON agendamentos
FOR EACH ROW EXECUTE FUNCTION public.copiar_preco_do_servico();

-- Quando a gerente muda o preço ou o nome de um serviço, as marcações de hoje em
-- diante acompanham; as que já passaram ficam como estavam.
CREATE OR REPLACE FUNCTION public.atualizar_marcacoes_futuras()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.preco IS DISTINCT FROM OLD.preco OR NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE public.agendamentos
    SET preco = NEW.preco, servico_nome = NEW.nome
    WHERE servico_id = NEW.id
      AND data_hora_inicio >= date_trunc('day', now() AT TIME ZONE 'Europe/Lisbon')
                              AT TIME ZONE 'Europe/Lisbon';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS acompanhar_preco_novo ON servicos;
CREATE TRIGGER acompanhar_preco_novo
AFTER UPDATE OF preco, nome ON servicos
FOR EACH ROW EXECUTE FUNCTION public.atualizar_marcacoes_futuras();
