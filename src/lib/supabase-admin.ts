// Cliente do Supabase com a chave de serviço: só no servidor (cadastro, webhook, créditos).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let admin: SupabaseClient | null = null;

// Sem estas variáveis o site roda no modo de teste (sem login, sem créditos), como no PC do Andre.
export function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabaseAdmin() {
  if (!admin) {
    admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
