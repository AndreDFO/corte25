// Cliente do Supabase com a chave de serviço: só no servidor (cadastro, webhook, créditos).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Tira espaços e quebras de linha que entram ao colar a chave no painel (quebram o cabeçalho da requisição).
const clean = (v: string | undefined) => (v || "").replace(/[\s"'“”‘’]+/g, "");
export const SUPABASE_URL = clean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
// Chave pública (anon) do projeto corte25 no Supabase. Não é segredo: vai para qualquer navegador.
// Serve de reserva quando a variável do painel vem estragada (ex.: colada com "•••" da tela escondida).
const DEFAULT_URL = "https://fjewurgetkdnaitujfum.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZXd1cmdldGtkbmFpdHVqZnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzMDU2ODUsImV4cCI6MjExMDg4MTY4NX0.fznTg7QYpbHxWR9QAwpwlwtCAxyriTfkjSQFh7Vqoj8";
// Só caracteres que podem ir num cabeçalho HTTP.
export const looksValid = (v: string) => v.length > 20 && /^[\x21-\x7e]+$/.test(v);
const envAnon = clean(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const ANON_FROM_ENV = looksValid(envAnon);
export const SUPABASE_ANON_KEY =
  ANON_FROM_ENV ? envAnon : SUPABASE_URL === DEFAULT_URL ? DEFAULT_ANON_KEY : "";
const SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
export const SERVICE_KEY_OK = looksValid(SERVICE_KEY);

let admin: SupabaseClient | null = null;

// Sem estas variáveis o site roda no modo de teste (sem login, sem créditos), como no PC do Andre.
export function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_KEY);
}

export function supabaseAdmin() {
  if (!admin) {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
