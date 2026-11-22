// Resgate de cupom SEM compra, em Minha conta ("Tenho um cupom"):
// - "gratis": vídeos grátis direto no saldo;
// - "vip": recursos VIP por X dias.
// Tudo acontece numa função do banco (claim_coupon) que trava o cupom: confere ativo, validade,
// limite de usos e 1 uso por pessoa de uma vez só. Cupons de desconto (% e R$) e bônus continuam só na compra.
import { normalizeCode } from "./coupons";
import { supabaseAdmin } from "./supabase-admin";

export type RedeemResult =
  | { ok: true; kind: "gratis"; videos: number }
  | { ok: true; kind: "vip"; days: number; features: string[]; until: string }
  | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  nao_encontrado: "Cupom não encontrado. Confira as letras e números.",
  compra: "Esse cupom é de desconto ou bônus na compra: use na hora de comprar, no campo de cupom.",
  vencido: "Esse cupom já venceu.",
  esgotado: "Esse cupom já atingiu o limite de usos.",
  ja_usou: "Você já usou esse cupom.",
};

export async function redeemCoupon(userId: string, rawCode: string): Promise<RedeemResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: "Digite o código do cupom." };
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { ok: false, error: ERRORS.nao_encontrado };
  const { data, error } = await supabaseAdmin().rpc("claim_coupon", { p_user: userId, p_code: code });
  if (error || !data) {
    console.error("[cupom] resgate", error?.message);
    return { ok: false, error: "Não deu para resgatar agora. Tente de novo em instantes." };
  }
  const r = data as { ok: boolean; error?: string; kind?: string; amount?: number; features?: string[]; until?: string };
  if (!r.ok) return { ok: false, error: ERRORS[r.error || ""] || "Não deu para resgatar esse cupom." };
  if (r.kind === "gratis") return { ok: true, kind: "gratis", videos: Number(r.amount) };
  return { ok: true, kind: "vip", days: Number(r.amount), features: r.features || ["todos"], until: String(r.until) };
}
