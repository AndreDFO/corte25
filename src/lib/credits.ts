import { CATALOG, type ProductId } from "./pricing";
import { supabaseAdmin } from "./supabase-admin";

// Credita os lotes de um pagamento confirmado. Repetir o mesmo pagamento não credita de novo
// (índice único em payment_id + reason).
export async function grantForPayment(p: { paymentId: string; userId: string; product: ProductId; value: number; subscription?: string | null }) {
  const db = supabaseAdmin();
  const item = CATALOG[p.product];
  await db.from("payments").upsert({
    id: p.paymentId,
    user_id: p.userId,
    product: p.product,
    credits: item.credits,
    value: p.value,
    status: "CONFIRMED",
    subscription_id: p.subscription || null,
    updated_at: new Date().toISOString(),
  });
  const { error } = await db.from("credit_ledger").insert({
    user_id: p.userId,
    delta: item.credits,
    reason: item.recurring ? "assinatura" : "compra",
    payment_id: p.paymentId,
  });
  if (error && error.code !== "23505") throw error; // 23505 = já creditado antes
}

export async function refundPayment(paymentId: string) {
  const db = supabaseAdmin();
  const { data } = await db.from("payments").select("user_id, credits").eq("id", paymentId).maybeSingle();
  if (!data?.user_id) return;
  await db.from("payments").update({ status: "REFUNDED", updated_at: new Date().toISOString() }).eq("id", paymentId);
  const { error } = await db
    .from("credit_ledger")
    .insert({ user_id: data.user_id, delta: -data.credits, reason: "estorno", payment_id: paymentId });
  if (error && error.code !== "23505") throw error;
}

export async function balance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin().from("credit_balance").select("credits").eq("user_id", userId).maybeSingle();
  return data?.credits ?? 0;
}

// Gasta 1 crédito para um lote. false = sem saldo.
export async function consumeCredit(userId: string, jobId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("consume_credit", { p_user: userId, p_job: jobId });
  if (error) throw error;
  return (data as number) >= 0;
}
