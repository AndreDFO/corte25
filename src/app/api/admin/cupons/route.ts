import { connection } from "next/server";
import { isOwnerAdmin } from "@/lib/admin";
import { normalizeCode } from "@/lib/coupons";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ALL_VIP_FEATURES } from "@/lib/pricing";

// Cupons: só a conta do dono (ADMIN_EMAILS) com a senha ADMIN_KEY confirmada neste navegador.
async function guard() {
  await connection();
  return (await isOwnerAdmin()) ? null : Response.json({ error: "Acesso negado." }, { status: 403 });
}

// Campos que podem ser criados e editados (o código não muda depois de criado).
type Fields = { kind: string; amount: number; max_uses: number | null; expires_at: string | null; note: string | null; features: string[] | null };
function parseFields(b: Record<string, unknown>): { fields: Fields } | { error: string } {
  const kind = String(b.kind);
  if (!["percent", "fixed", "videos", "vip", "gratis"].includes(kind)) return { error: "Tipo inválido." };
  const amount = Number(String(b.amount ?? "").replace(",", "."));
  if (!(amount > 0)) return { error: "Informe um valor maior que zero." };
  if (kind === "percent" && amount > 90) return { error: "Percentual máximo: 90%." };
  if (kind === "videos" && (!Number.isInteger(amount) || amount > 1000))
    return { error: "Vídeos de bônus: número inteiro até 1.000." };
  if (kind === "gratis" && (!Number.isInteger(amount) || amount > 1000))
    return { error: "Vídeos grátis: número inteiro até 1.000." };
  if (kind === "vip" && (!Number.isInteger(amount) || amount > 365)) return { error: "Recursos VIP: número de dias inteiro, até 365." };
  let features: string[] | null = null;
  if (kind === "vip") {
    const asked = Array.isArray(b.features) ? b.features.map(String) : [];
    features = asked.includes("todos") ? ["todos"] : ALL_VIP_FEATURES.filter((f) => asked.includes(f));
    if (!features.length) return { error: "Escolha pelo menos um recurso VIP." };
  }
  const maxUses = b.max_uses ? Math.floor(Number(b.max_uses)) : null;
  if (maxUses !== null && !(maxUses > 0)) return { error: "Limite de usos inválido." };
  // Data no formato AAAA-MM-DD: vale até o fim do dia (horário de Brasília).
  const expires = /^\d{4}-\d{2}-\d{2}$/.test(String(b.expires || "")) ? `${b.expires}T23:59:59-03:00` : null;
  const note = String(b.note || "").trim().slice(0, 200) || null;
  return { fields: { kind, amount, max_uses: maxUses, expires_at: expires, note, features } };
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
  const f = parseFields(b);
  if ("error" in f) return Response.json({ error: f.error }, { status: 400 });
  const { data, error } = await supabaseAdmin()
    .from("coupons")
    .insert({ code, ...f.fields })
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

// Edita um cupom (tipo, valor, limite, validade, anotação). Vendas antigas não mudam:
// cada cobrança guarda o próprio valor e o bônus do momento da compra.
export async function PUT(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const f = parseFields(b);
  if ("error" in f) return Response.json({ error: f.error }, { status: 400 });
  const db = supabaseAdmin();
  const { data: c } = await db.from("coupons").select("uses").eq("id", String(b.id)).maybeSingle();
  if (!c) return Response.json({ error: "Cupom não encontrado." }, { status: 404 });
  if (f.fields.max_uses !== null && f.fields.max_uses < c.uses)
    return Response.json({ error: `Esse cupom já foi usado ${c.uses} vez(es). O limite não pode ser menor que isso.` }, { status: 400 });
  const { data, error } = await db.from("coupons").update(f.fields).eq("id", String(b.id)).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ coupon: data });
}
