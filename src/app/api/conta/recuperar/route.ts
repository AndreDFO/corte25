import { supabaseServer } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase-admin";

// "Esqueci minha senha": o Supabase manda um e-mail com o link para criar uma senha nova.
// Responde sempre igual (sem dizer se o e-mail tem conta), para ninguém descobrir quem é cliente.
export async function POST(req: Request) {
  if (!supabaseConfigured()) return Response.json({ error: "Login ainda não está ativo." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Digite um e-mail válido." }, { status: 400 });
  const site = (process.env.SITE_URL || new URL(req.url).origin).replace(/\s+/g, "").replace(/\/+$/, "");
  const sb = await supabaseServer();
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${site}/api/conta/callback?next=/nova-senha` });
  if (error) {
    console.warn("[recuperar] falhou:", error.message);
    if (/rate limit|too many/i.test(error.message))
      return Response.json({ error: "Muitos pedidos seguidos. Espere alguns minutos e tente de novo." }, { status: 429 });
  }
  return Response.json({ ok: true });
}
