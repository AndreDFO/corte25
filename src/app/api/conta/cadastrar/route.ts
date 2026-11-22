import { cookies } from "next/headers";
import { REF_COOKIE, supabaseServer, updateProfile } from "@/lib/auth";
import { normalizeWhatsapp } from "@/lib/leads";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

// Cria a conta já confirmada (sem depender de e-mail de confirmação) e entra.
export async function POST(req: Request) {
  if (!supabaseConfigured()) return Response.json({ error: "Login ainda não está ativo." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  const name = String(b.name || "").trim().slice(0, 80);
  const whatsapp = b.whatsapp ? normalizeWhatsapp(String(b.whatsapp)) : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "E-mail inválido." }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });

  const { data, error } = await supabaseAdmin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return Response.json(
      { error: exists ? "Já existe uma conta com esse e-mail. Use Entrar." : "Não deu para criar a conta agora." },
      { status: exists ? 409 : 500 },
    );
  }

  const store = await cookies();
  const ref = store.get(REF_COOKIE)?.value || null;
  let referredBy: string | null = null;
  if (ref) {
    const { data: owner } = await supabaseAdmin().from("profiles").select("id").eq("ref_code", ref).maybeSingle();
    if (owner && owner.id !== data.user.id) referredBy = ref;
  }
  await updateProfile(data.user.id, { name: name || null, whatsapp, referred_by: referredBy }).catch(() => {});

  const sb = await supabaseServer();
  await sb.auth.signInWithPassword({ email, password });
  return Response.json({ ok: true });
}
