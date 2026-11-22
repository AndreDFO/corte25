import { AFFILIATE_LATER_PERCENT, AFFILIATE_MAX_PURCHASES, AFFILIATE_PERCENT, CATALOG, REFERRAL_DISCOUNT, VIDEOS_PER_LOT, type ProductId } from "./pricing";
import { supabaseAdmin } from "./supabase-admin";
import { asaasConfigured, getPayment, parseReference, setSubscriptionSplit } from "./asaas";

// Credita os lotes de um pagamento confirmado. Repetir o mesmo pagamento não credita de novo
// (índice único em payment_id + reason).
export async function grantForPayment(p: { paymentId: string; userId: string; product: ProductId; value: number; subscription?: string | null }) {
  const db = supabaseAdmin();
  const item = CATALOG[p.product];
  // Mensalidade nova da assinatura: herda o afiliado da 1ª cobrança e grava a comissão desta parcela.
  let affiliate: { affiliate_code: string; affiliate_percent: number } | null = null;
  if (p.subscription) {
    const { data: first } = await db
      .from("payments")
      .select("affiliate_code")
      .eq("subscription_id", p.subscription)
      .not("affiliate_code", "is", null)
      .limit(1)
      .maybeSingle();
    if (first?.affiliate_code) affiliate = { affiliate_code: first.affiliate_code, affiliate_percent: await affiliatePercentFor(p.userId, p.paymentId) };
  }
  await db.from("payments").upsert({
    id: p.paymentId,
    user_id: p.userId,
    product: p.product,
    credits: item.credits,
    value: p.value,
    status: "CONFIRMED",
    subscription_id: p.subscription || null,
    updated_at: new Date().toISOString(),
    ...(affiliate ?? {}),
  });
  // VIP pago de novo: tira a marca de "cancelado".
  if (p.product === "vip") await db.from("profiles").update({ vip_canceled_at: null }).eq("id", p.userId);
  // VIP não dá vídeos (credits 0): só libera recursos; nada a lançar no saldo.
  if (item.credits > 0) {
    const { error } = await db.from("credit_ledger").insert({
      user_id: p.userId,
      delta: item.credits * VIDEOS_PER_LOT, // o saldo conta vídeos: 1 lote = 25
      reason: item.recurring ? "assinatura" : "compra",
      payment_id: p.paymentId,
    });
    if (error && error.code !== "23505") throw error; // 23505 = já creditado antes
  }

  // Cupom: registra o uso e credita os vídeos de bônus (uma vez só por pagamento).
  const { data: bonus } = await db.rpc("redeem_coupon", { p_payment: p.paymentId });
  if (Number(bonus) > 0) {
    const { error: e2 } = await db
      .from("credit_ledger")
      .insert({ user_id: p.userId, delta: Number(bonus), reason: "bonus", payment_id: p.paymentId });
    if (e2 && e2.code !== "23505") throw e2;
  }

  // Assinatura com afiliado: depois da 3ª compra paga, as próximas mensalidades passam a pagar 3% (não 15%).
  if (p.subscription && affiliate && (await paidPurchases(p.userId)) >= AFFILIATE_MAX_PURCHASES) {
    const { data: ref } = await db.from("profiles").select("affiliate_wallet_id").eq("ref_code", affiliate.affiliate_code).maybeSingle();
    if (ref?.affiliate_wallet_id)
      await setSubscriptionSplit(p.subscription, ref.affiliate_wallet_id, AFFILIATE_LATER_PERCENT).catch((err) =>
        console.warn("[afiliado] não deu para trocar o split da assinatura", p.subscription, (err as Error).message),
      );
  }
}

export async function refundPayment(paymentId: string) {
  const db = supabaseAdmin();
  const { data } = await db.from("payments").select("user_id, credits").eq("id", paymentId).maybeSingle();
  if (!data?.user_id) return;
  await db.from("payments").update({ status: "REFUNDED", updated_at: new Date().toISOString() }).eq("id", paymentId);
  if (!data.credits) return; // VIP: não há vídeos para tirar
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

// Comissão do afiliado nesta compra: 15% nas AFFILIATE_MAX_PURCHASES primeiras compras pagas do indicado,
// depois 3% para sempre. exceptId: não conta o próprio pagamento (quando ele já está gravado).
export async function affiliatePercentFor(userId: string, exceptId?: string) {
  let q = supabaseAdmin()
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["CONFIRMED", "RECEIVED", "REFUNDED"]);
  if (exceptId) q = q.neq("id", exceptId);
  const { count } = await q;
  return (count ?? 0) < AFFILIATE_MAX_PURCHASES ? AFFILIATE_PERCENT : AFFILIATE_LATER_PERCENT;
}
