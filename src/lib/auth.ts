// Sessão do usuário (cookies), sempre no servidor. O navegador não fala direto com o Supabase.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseAdmin, supabaseConfigured } from "./supabase-admin";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Em página (sem resposta própria) não dá para gravar cookie; o proxy renova a sessão.
        }
      },
    },
  });
}

export async function currentUser() {
  // Lê os cookies ANTES de tudo: isso obriga o Next a montar a parte de login a cada visita.
  // Sem isso, como o Railway faz o build sem as chaves do Supabase, o topo era "congelado"
  // no build como deslogado ("Entrar") e a pessoa parecia deslogada ao atualizar a página.
  await cookies();
  if (!supabaseConfigured()) return null;
  const sb = await supabaseServer();
  // Falha de rede passageira com o Supabase não pode parecer "deslogado": tenta de novo e,
  // se ainda falhar, usa a sessão guardada no cookie (a conta continua logada até clicar em Sair).
  for (let i = 0; i < 2; i++) {
    const { data, error } = await sb.auth.getUser();
    if (data.user) return data.user;
    if (!error || error.name !== "AuthRetryableFetchError") return null;
  }
  const { data: s } = await sb.auth.getSession();
  return s.session?.user ?? null;
}

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  whatsapp: string | null;
  cpf_cnpj: string | null;
  ref_code: string | null;
  referred_by: string | null;
  asaas_customer_id: string | null;
  affiliate_wallet_id: string | null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabaseAdmin().from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile) ?? null;
}

export async function updateProfile(userId: string, patch: Partial<Profile>) {
  const { error } = await supabaseAdmin().from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

export const REF_COOKIE = "corte25_ref";
