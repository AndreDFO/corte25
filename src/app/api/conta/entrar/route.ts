import { supabaseServer } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  if (!supabaseConfigured()) return Response.json({ error: "Login ainda não está ativo." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  let error: unknown = null;
  try {
    const sb = await supabaseServer();
    ({ error } = await sb.auth.signInWithPassword({
      email: String(b.email || "").trim().toLowerCase(),
      password: String(b.password || ""),
    }));
  } catch (err) {
    console.error("[entrar] falha ao falar com o Supabase:", err);
    return Response.json({ error: "Não deu para entrar agora. Tente de novo em instantes." }, { status: 500 });
  }
  if (error) {
    console.warn("[entrar] login recusado:", (error as Error).message);
    // Falha de rede/configuração (a requisição nem chegou ao Supabase) não é senha errada.
    if ((error as Error).name === "AuthRetryableFetchError")
      return Response.json({ error: "Não deu para entrar agora. Tente de novo em instantes." }, { status: 503 });
    return Response.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }
  return Response.json({ ok: true });
}
