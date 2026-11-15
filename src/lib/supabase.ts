import { createClient } from "@supabase/supabase-js";
import { lerMarcaDoLink, SEM_MARCA } from "./link-email";

/**
 * Isto é lido aqui, e não dentro de um ecrã, porque tem de acontecer antes de o
 * cliente do Supabase ser criado: mal ele arranca, trata do link do email e limpa
 * o endereço. Depois disso já ninguém sabe que se veio de lá.
 */
const marcaDoLink =
  typeof window === "undefined"
    ? SEM_MARCA
    : lerMarcaDoLink(window.location.hash, window.location.search);

/** Veio-se do link do email para escolher uma palavra-passe nova. */
export const VEIO_DE_RECUPERACAO = marcaDoLink.recuperacao;

/** O link do email não serviu; o que dizer no ecrã de entrada. */
export const PROBLEMA_DO_LINK = marcaDoLink.problema;

// Um link gasto não tem nada a fazer no endereço: tira-se, para um F5 não repetir o aviso.
if (PROBLEMA_DO_LINK) {
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch {
    // navegador antigo: fica como está, sem mal nenhum
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
