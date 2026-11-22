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
  if (!supabaseConfigured()) return null;
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
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
