import { AFFILIATE_MAX_PURCHASES, CATALOG, REFERRAL_DISCOUNT, VIDEOS_PER_LOT, type ProductId } from "./pricing";
import { supabaseAdmin } from "./supabase-admin";
import { asaasConfigured, getPayment, parseReference, removeSubscriptionSplit } from "./asaas";

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
    delta: item.credits * VIDEOS_PER_LOT, // o saldo conta vídeos: 1 lote = 25
    reason: item.recurring ? "assinatura" : "compra",
    payment_id: p.paymentId,
  });
  if (error && error.code !== "23505") throw error; // 23505 = já creditado antes

  // Assinatura com split: ao chegar na 3ª compra paga, tira a comissão das próximas mensalidades.
  if (p.subscription && !(await affiliateStillEarns(p.userId))) {
    await removeSubscriptionSplit(p.subscription).catch((err) =>
      console.warn("[afiliado] não deu para tirar o split da assinatura", p.subscription, (err as Error).message),
    );
  }
}

export async function refundPayment(paymentId: string) {
  const db = supabaseAdmin();
  const { data } = await db.from("payments").select("user_id, credits").eq("id", paymentId).maybeSingle();
  if (!data?.user_id) return;
  await db.from("payments").update({ status: "REFUNDED", updated_at: new Date().toISOString() }).eq("id", paymentId);
  const { error } = await db
    .from("credit_ledger")
    .insert({ user_id: data.user_id, delta: -data.credits * VIDEOS_PER_LOT, reason: "estorno", payment_id: paymentId });
  if (error && error.code !== "23505") throw error;
}

// Saldo da conta em vídeos (1 lote comprado = 25).
export async function balance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin().from("credit_balance").select("credits").eq("user_id", userId).maybeSingle();
  return data?.credits ?? 0;
}

// Gasta n vídeos do saldo. false = saldo insuficiente.
export async function consumeVideos(userId: string, jobId: string, n: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("consume_videos", { p_user: userId, p_job: jobId, p_n: n });
  if (error) throw error;
  return (data as number) >= 0;
}

// Reserva para quando o aviso (webhook) do Asaas atrasa ou falha: ao abrir a conta, consulta no
// Asaas as cobranças ainda pendentes desta pessoa e credita as que já foram pagas.
const PAID = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
export async function syncPendingPayments(userId: string) {
  if (!asaasConfigured()) return 0;
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data } = await supabaseAdmin()
    .from("payments")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "PENDING")
    .gte("created_at", since)
    .limit(5);
  let granted = 0;
  for (const row of data ?? []) {
    try {
      const p = await getPayment(row.id);
      const ref = parseReference(p.externalReference);
      if (!PAID.has(p.status) || !ref || ref.userId !== userId) continue;
      await grantForPayment({ paymentId: p.id, userId, product: ref.product, value: p.value, subscription: p.subscription });
      granted++;
    } catch (err) {
      console.warn("[creditos] não deu para consultar a cobrança", row.id, (err as Error).message);
    }
  }
  return granted;
}

// Desconto da indicação: quem chegou pelo link de um afiliado ganha REFERRAL_DISCOUNT% só na primeira compra paga.
export async function referralDiscount(userId: string, referredBy: string | null | undefined): Promise<number> {
  if (!referredBy) return 0;
  return (await paidPurchases(userId)) === 0 ? REFERRAL_DISCOUNT : 0;
}

// Quantas compras pagas a pessoa já fez (conta estornadas também, para não reabrir benefício).
export async function paidPurchases(userId: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["CONFIRMED", "RECEIVED", "REFUNDED"]);
  return count ?? 0;
}

// A comissão do afiliado vale nas AFFILIATE_MAX_PURCHASES primeiras compras pagas do indicado.
export async function affiliateStillEarns(userId: string) {
  return (await paidPurchases(userId)) < AFFILIATE_MAX_PURCHASES;
}
