import { supabaseServer } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  if (!supabaseConfigured()) return Response.json({ error: "Login ainda não está ativo." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({
    email: String(b.email || "").trim().toLowerCase(),
    password: String(b.password || ""),
  });
  if (error) return Response.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  return Response.json({ ok: true });
}
