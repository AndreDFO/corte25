import { connection } from "next/server";
import { currentUser } from "@/lib/auth";
import { redeemCoupon } from "@/lib/redeem";
import { supabaseConfigured } from "@/lib/supabase-admin";
import { ipKey, rateLimited } from "@/lib/support";

// "Tenho um cupom" em Minha conta: resgata cupom de vídeos grátis ou de recursos VIP, sem compra.
// Contra abuso: precisa estar logado, 1 uso por conta (no banco) e no máximo 10 tentativas por hora
// por conta e 20 por IP (para ninguém ficar chutando códigos).
export async function POST(req: Request) {
  await connection();
  if (!supabaseConfigured()) return Response.json({ error: "Cupons só funcionam no site oficial." }, { status: 400 });
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ error: "Entre na sua conta para resgatar o cupom." }, { status: 401 });
  if (rateLimited(`cupom:${user.id}`, 10, 3600_000) || rateLimited(`cupom-ip:${ipKey(req)}`, 20, 3600_000))
    return Response.json({ error: "Muitas tentativas. Espere um pouco e tente de novo." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const r = await redeemCoupon(user.id, String(b.code || ""));
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  return Response.json(r);
}
