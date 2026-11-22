// Cupons do administrador: % de desconto, R$ de desconto ou vídeos de bônus.
// Regras: ativo, dentro da validade, abaixo do limite de usos e 1 uso por pessoa.
// Não soma com o desconto de indicação: vale o que deixar o preço menor. Cupom de vídeos soma com tudo.
import { CATALOG, brl, discounted, type ProductId } from "./pricing";
import { supabaseAdmin } from "./supabase-admin";

export const MIN_CHARGE = 5; // o Asaas não cobra menos de R$ 5,00

export type CouponKind = "percent" | "fixed" | "videos";
export interface Coupon {
  id: string;
  code: string;
  kind: CouponKind;
  amount: number;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  active: boolean;
  note: string | null;
  created_at: string;
}

export const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, "");

export function describe(c: Pick<Coupon, "kind" | "amount">) {
  if (c.kind === "percent") return `${Number(c.amount)}% de desconto`;
  if (c.kind === "fixed") return `${brl(Number(c.amount))} de desconto`;
  return `+${Number(c.amount)} vídeos de bônus`;
}

export type CouponCheck =
  | { ok: false; error: string }
  | { ok: true; coupon: Coupon; label: string; value: number; bonusVideos: number };

// Confere o cupom para esta pessoa e este produto. value = preço da 1ª cobrança só com o cupom.
export async function checkCoupon(rawCode: string, userId: string, product: ProductId): Promise<CouponCheck> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: "Digite o código do cupom." };
  const db = supabaseAdmin();
  const { data: c } = await db.from("coupons").select("*").eq("code", code).maybeSingle<Coupon>();
  if (!c || !c.active) return { ok: false, error: "Cupom não encontrado." };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { ok: false, error: "Esse cupom já venceu." };
  if (c.max_uses !== null && c.uses >= c.max_uses) return { ok: false, error: "Esse cupom já atingiu o limite de usos." };
  const { count } = await db
    .from("coupon_redemptions")
    .select("coupon_id", { count: "exact", head: true })
    .eq("coupon_id", c.id)
    .eq("user_id", userId);
  if ((count ?? 0) > 0) return { ok: false, error: "Você já usou esse cupom." };

  const base: number = CATALOG[product].value;
  let value: number = base;
  let bonusVideos = 0;
  if (c.kind === "percent") value = discounted(base, Math.min(Number(c.amount), 100));
  else if (c.kind === "fixed") value = Math.round((base - Number(c.amount)) * 100) / 100;
  else bonusVideos = Math.floor(Number(c.amount));
  if (value < MIN_CHARGE) value = Math.min(base, MIN_CHARGE);
  return { ok: true, coupon: c, label: describe(c), value, bonusVideos };
}
