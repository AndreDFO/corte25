import { connection } from "next/server";
import { asaasConfigured } from "@/lib/asaas";
import { ANON_FROM_ENV, SERVICE_KEY_OK, SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase-admin";

// Diagnóstico sem segredos: qual versão está no ar e quais configurações o site enxerga.
export async function GET() {
  await connection(); // sempre na hora, nunca a versão gerada no build
  const anonRef = (() => {
    try {
      return JSON.parse(Buffer.from(SUPABASE_ANON_KEY.split(".")[1] || "", "base64url").toString()).ref ?? null;
    } catch {
      return null;
    }
  })();
  let supabaseAuth = "não testado";
  if (supabaseConfigured()) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY }, cache: "no-store" });
      supabaseAuth = r.ok ? "ok" : `erro ${r.status}`;
    } catch (err) {
      supabaseAuth = `falhou: ${(err as Error).message}`.slice(0, 120);
    }
  }
  return Response.json(
    {
      versao: (process.env.RAILWAY_GIT_COMMIT_SHA || "local").slice(0, 7),
      supabase: {
        configurado: supabaseConfigured(),
        url: SUPABASE_URL || null,
        chave_anon_do_projeto: anonRef,
        chave_anon_da_variavel: ANON_FROM_ENV ? "ok" : "inválida (usando a chave pública padrão)",
        chave_service_role: SERVICE_KEY_OK ? "ok" : "inválida",
        login: supabaseAuth,
      },
      asaas: asaasConfigured(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
