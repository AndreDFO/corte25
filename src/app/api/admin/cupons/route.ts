import { connection } from "next/server";
import { isOwnerAdmin } from "@/lib/admin";
import { normalizeCode } from "@/lib/coupons";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Cupons: só a conta do dono (ADMIN_EMAILS) com a senha ADMIN_KEY confirmada neste navegador.
async function guard() {
  await connection();
  return (await isOwnerAdmin()) ? null : Response.json({ error: "Acesso negado." }, { status: 403 });
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const { data, error } = await supabaseAdmin().from("coupons").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ coupons: data });
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const code = normalizeCode(String(b.code || ""));
  if (!/^[A-Z0-9_-]{3,30}$/.test(code))
    return Response.json({ error: "Código com 3 a 30 letras, números, - ou _ (sem espaço nem acento)." }, { status: 400 });
  const kind = String(b.kind);
  if (!["percent", "fixed", "videos"].includes(kind)) return Response.json({ error: "Tipo inválido." }, { status: 400 });
  const amount = Number(String(b.amount ?? "").replace(",", "."));
  if (!(amount > 0)) return Response.json({ error: "Informe um valor maior que zero." }, { status: 400 });
  if (kind === "percent" && amount > 90) return Response.json({ error: "Percentual máximo: 90%." }, { status: 400 });
  if (kind === "videos" && (!Number.isInteger(amount) || amount > 1000))
    return Response.json({ error: "Vídeos de bônus: número inteiro até 1.000." }, { status: 400 });
  const maxUses = b.max_uses ? Math.floor(Number(b.max_uses)) : null;
  if (maxUses !== null && !(maxUses > 0)) return Response.json({ error: "Limite de usos inválido." }, { status: 400 });
  // Data no formato AAAA-MM-DD: vale até o fim do dia (horário de Brasília).
  const expires = /^\d{4}-\d{2}-\d{2}$/.test(String(b.expires || "")) ? `${b.expires}T23:59:59-03:00` : null;
  const note = String(b.note || "").trim().slice(0, 200) || null;
  const { data, error } = await supabaseAdmin()
    .from("coupons")
    .insert({ code, kind, amount, max_uses: maxUses, expires_at: expires, note })
    .select()
    .single();
  if (error)
    return Response.json(
      { error: error.code === "23505" ? "Esse código já existe ou já foi usado num cupom excluído. Escolha outro." : error.message },
      { status: 400 },
    );
  return Response.json({ coupon: data });
}

// Ativa ou desativa um cupom.
export async function PATCH(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const { error } = await supabaseAdmin().from("coupons").update({ active: Boolean(b.active) }).eq("id", String(b.id));
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

// Exclui um cupom. Se nunca foi usado em nenhuma cobrança, apaga de vez. Se já foi usado,
// some da lista e para de valer, mas fica guardado para o histórico de vendas e relatório.
export async function DELETE(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id") || "";
  const db = supabaseAdmin();
  const { data: c } = await db.from("coupons").select("id, code, uses").eq("id", id).maybeSingle();
  if (!c) return Response.json({ ok: true });
  const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("coupon_code", c.code);
  if (c.uses === 0 && (count ?? 0) === 0) {
    const { error } = await db.from("coupons").delete().eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, mode: "apagado" });
  }
  const { error } = await db.from("coupons").update({ active: false, deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, mode: "arquivado" });
}
