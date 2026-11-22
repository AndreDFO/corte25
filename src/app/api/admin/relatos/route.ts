import { connection } from "next/server";
import { isOwnerAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Relatos de problema no /admin: só a conta do dono com a senha ADMIN_KEY confirmada.
const STATUS = ["novo", "em_correcao", "corrigido", "descartado"];

async function guard() {
  await connection();
  return (await isOwnerAdmin()) ? null : Response.json({ error: "Acesso negado." }, { status: 403 });
}

// GET ?id=...: o print de um relato (vem à parte para a lista carregar rápido).
export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Falta o id." }, { status: 400 });
  const { data, error } = await supabaseAdmin().from("bug_reports").select("screenshot").eq("id", id).single();
  if (error) return Response.json({ error: error.message }, { status: 404 });
  return Response.json({ print: data.screenshot });
}

export async function PATCH(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  if (!b.id || !STATUS.includes(b.status)) return Response.json({ error: "Status inválido." }, { status: 400 });
  const { error } = await supabaseAdmin()
    .from("bug_reports")
    .update({ status: b.status, updated_at: new Date().toISOString() })
    .eq("id", b.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
