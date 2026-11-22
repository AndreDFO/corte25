import { parseReference, webhookAuthorized, type AsaasPaymentEvent } from "@/lib/asaas";
import { grantForPayment, refundPayment } from "@/lib/credits";
import { supabaseConfigured } from "@/lib/supabase-admin";

// Avisos de pagamento do Asaas. Configure no painel do Asaas: URL /api/asaas/webhook + o token ASAAS_WEBHOOK_TOKEN.
export async function POST(req: Request) {
  if (!webhookAuthorized(req)) return new Response("não autorizado", { status: 401 });
  if (!supabaseConfigured()) return new Response("banco não configurado", { status: 503 });
  const ev = (await req.json().catch(() => null)) as AsaasPaymentEvent | null;
  const p = ev?.payment;
  if (!ev || !p) return Response.json({ ok: true });

  try {
    // RECEIVED_IN_CASH: quando o pagamento é confirmado à mão no painel do Asaas (usado também nos testes do sandbox).
    if (ev.event === "PAYMENT_CONFIRMED" || ev.event === "PAYMENT_RECEIVED" || ev.event === "PAYMENT_RECEIVED_IN_CASH") {
      const ref = parseReference(p.externalReference);
      if (ref) await grantForPayment({ paymentId: p.id, userId: ref.userId, product: ref.product, value: p.value, subscription: p.subscription });
      else console.warn("[asaas] pagamento sem referência do Corte25:", p.id);
    } else if (ev.event === "PAYMENT_REFUNDED" || ev.event === "PAYMENT_CHARGEBACK_REQUESTED") {
      await refundPayment(p.id);
    }
  } catch (err) {
    console.error("[asaas] falha ao processar aviso:", err);
    return new Response("erro", { status: 500 }); // o Asaas tenta de novo
  }
  return Response.json({ ok: true });
}
