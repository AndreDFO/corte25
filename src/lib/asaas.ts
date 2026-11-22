// Cliente mínimo da API do Asaas (cobrança Pix/cartão/boleto, assinatura e split para afiliado).
// Chaves só por variável de ambiente no servidor: ASAAS_API_KEY, ASAAS_API_URL, ASAAS_WEBHOOK_TOKEN.
// Sandbox: https://api-sandbox.asaas.com/v3 · Produção: https://api.asaas.com/v3
import { AFFILIATE_PERCENT, CATALOG, type ProductId } from "./pricing";

const API = process.env.ASAAS_API_URL || "https://api-sandbox.asaas.com/v3";

export function asaasConfigured() {
  return Boolean(process.env.ASAAS_API_KEY);
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: process.env.ASAAS_API_KEY || "",
      "User-Agent": "corte25",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { errors?: { description?: string }[] }).errors?.map((e) => e.description).join("; ");
    throw new Error(`Asaas ${res.status}: ${msg || res.statusText}`);
  }
  return data as T;
}

export async function createCustomer(c: { name: string; email: string; cpfCnpj: string; mobilePhone?: string }) {
  return call<{ id: string }>("POST", "/customers", { ...c, notificationDisabled: false });
}

function split(affiliateWallet?: string | null) {
  return affiliateWallet ? [{ walletId: affiliateWallet, percentualValue: AFFILIATE_PERCENT }] : undefined;
}

function today(days = 0) {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
}

// Cria a cobrança e devolve o link da página de pagamento do Asaas (a pessoa escolhe Pix, cartão ou boleto lá).
// externalReference = "<userId>:<produto>" para o webhook saber a quem creditar.
export async function createCheckout(opts: {
  customer: string;
  userId: string;
  product: ProductId;
  affiliateWallet?: string | null;
}): Promise<{ id: string; url: string; subscription?: string }> {
  const item = CATALOG[opts.product];
  const base = {
    customer: opts.customer,
    billingType: "UNDEFINED",
    value: item.value,
    description: `Corte25 · ${item.label}`,
    externalReference: `${opts.userId}:${opts.product}`,
    split: split(opts.affiliateWallet),
  };
  // Depois de pagar, o Asaas volta para a conta. Ele só aceita se o domínio do site estiver
  // cadastrado na conta do Asaas; se recusar, a cobrança é criada sem o retorno automático.
  const site = (process.env.SITE_URL || "").replace(/\s+/g, "").replace(/\/+$/, "");
  const callback = site ? { successUrl: `${site}/conta?pago=1`, autoRedirect: true } : undefined;
  const withCallback = async <T,>(path: string, body: Record<string, unknown>) => {
    if (!callback) return call<T>("POST", path, body);
    try {
      return await call<T>("POST", path, { ...body, callback });
    } catch (err) {
      console.warn("[asaas] retorno automático recusado, criando sem ele:", (err as Error).message);
      return call<T>("POST", path, body);
    }
  };
  if (item.recurring) {
    const sub = await withCallback<{ id: string }>("/subscriptions", { ...base, cycle: "MONTHLY", nextDueDate: today() });
    // A primeira mensalidade já nasce com a assinatura; pega o link dela.
    const list = await call<{ data: { id: string; invoiceUrl: string }[] }>("GET", `/subscriptions/${sub.id}/payments`);
    const first = list.data[0];
    return { id: first.id, url: first.invoiceUrl, subscription: sub.id };
  }
  const pay = await withCallback<{ id: string; invoiceUrl: string }>("/payments", { ...base, dueDate: today(1) });
  return { id: pay.id, url: pay.invoiceUrl };
}

export async function cancelSubscription(id: string) {
  return call("DELETE", `/subscriptions/${id}`);
}

// Webhook: o Asaas manda o token configurado no painel neste cabeçalho.
export function webhookAuthorized(req: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  return Boolean(expected) && req.headers.get("asaas-access-token") === expected;
}

export interface AsaasPaymentEvent {
  event: string;
  payment?: {
    id: string;
    status: string;
    value: number;
    externalReference?: string | null;
    subscription?: string | null;
    description?: string;
  };
}

// Lê "<userId>:<produto>" do externalReference.
export function parseReference(ref?: string | null): { userId: string; product: ProductId } | null {
  const [userId, product] = String(ref || "").split(":");
  if (!/^[0-9a-f-]{36}$/.test(userId) || !(product in CATALOG)) return null;
  return { userId, product: product as ProductId };
}
