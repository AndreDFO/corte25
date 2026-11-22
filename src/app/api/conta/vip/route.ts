import { connection } from "next/server";
import { cancelSubscription } from "@/lib/asaas";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { redeemVipCoupon, vipStatus } from "@/lib/vip";

// Status do VIP da conta logada.
export async function GET() {
  await connection();
  const user = await currentUser().catch(() => null);
  return Response.json(await vipStatus(user), { headers: { "Cache-Control": "no-store" } });
}

// Cancelar o VIP: para as próximas cobranças no Asaas. O VIP continua até o fim do mês já pago.
export async function DELETE() {
  await connection();
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const st = await vipStatus(user);
  if (!st.subscriptionId || st.canceled) return Response.json({ error: "Não há assinatura VIP ativa para cancelar." }, { status: 400 });
  try {
    await cancelSubscription(st.subscriptionId);
  } catch (err) {
    console.error("[vip] cancelar", err);
    return Response.json({ error: "Não deu para cancelar agora. Tente de novo em instantes." }, { status: 502 });
  }
  await supabaseAdmin().from("profiles").update({ vip_canceled_at: new Date().toISOString() }).eq("id", user.id);
  return Response.json({ ok: true, until: st.until });
}

// Resgatar cupom de recursos VIP (criado pelo admin, tipo "Recursos VIP").
export async function POST(req: Request) {
  await connection();
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const r = await redeemVipCoupon(user.id, String(b.code || ""));
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  return Response.json(r);
}
