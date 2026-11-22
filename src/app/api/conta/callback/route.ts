import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/auth";

// Volta do link do e-mail (nova senha). Aceita os dois formatos do Supabase:
// ?code=... (mesmo navegador que pediu) e ?token_hash=...&type=recovery (funciona em qualquer aparelho).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const next = (q.get("next") || "/nova-senha").startsWith("/") ? q.get("next") || "/nova-senha" : "/nova-senha";
  const sb = await supabaseServer();
  let ok = false;
  const code = q.get("code");
  const tokenHash = q.get("token_hash");
  if (code) ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash) ok = !(await sb.auth.verifyOtp({ type: (q.get("type") || "recovery") as EmailOtpType, token_hash: tokenHash })).error;
  // Caminho relativo: atrás do Railway, req.url pode trazer o endereço interno.
  return new Response(null, { status: 303, headers: { Location: ok ? next : "/entrar?erro=link" } });
}
