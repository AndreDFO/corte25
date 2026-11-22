import { connection } from "next/server";
import { currentUser, getProfile } from "@/lib/auth";
import { checkCoupon } from "@/lib/coupons";
import { referralDiscount } from "@/lib/credits";
import { CATALOG, brl, discounted, type ProductId } from "@/lib/pricing";

// Confere um cupom antes de pagar e mostra o preço final (mesma regra do /api/checkout).
export async function POST(req: Request) {
  await connection();
  const user = await currentUser();
  if (!user) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const product = String(b.product || "") as ProductId;
  if (!(product in CATALOG)) return Response.json({ error: "Escolha um pacote primeiro." }, { status: 400 });
  const c = await checkCoupon(String(b.code || ""), user.id, product);
  if (!c.ok) return Response.json({ error: c.error }, { status: 400 });
  const profile = await getProfile(user.id);
  const full: number = CATALOG[product].value;
  const ref = await referralDiscount(user.id, profile?.referred_by);
  const refValue = ref ? discounted(full, ref) : full;
  const value = Math.min(refValue, c.value);
  let msg = `Cupom ${c.coupon.code}: ${c.label}.`;
  if (c.value >= refValue && c.value < full) msg += ` O desconto da indicação (${ref}%) é maior e foi mantido.`;
  return Response.json({
    code: c.coupon.code,
    label: c.label,
    bonusVideos: c.bonusVideos,
    price: brl(value),
    full: value < full ? brl(full) : null,
    recurring: Boolean((CATALOG[product] as { recurring?: boolean }).recurring),
    msg,
  });
}
