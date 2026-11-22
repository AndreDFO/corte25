import { currentUser, supabaseServer } from "@/lib/auth";

// Grava a senha nova de quem entrou pelo link do e-mail.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "O link venceu. Peça outro em “Esqueci minha senha”." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const password = String(b.password || "");
  if (password.length < 8) return Response.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  const { error } = await (await supabaseServer()).auth.updateUser({ password });
  if (error) return Response.json({ error: /different|same/i.test(error.message) ? "Use uma senha diferente da anterior." : "Não deu para trocar a senha agora." }, { status: 400 });
  return Response.json({ ok: true });
}
