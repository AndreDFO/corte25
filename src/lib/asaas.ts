// Cliente mínimo da API do Asaas (cobrança Pix/cartão/boleto, assinatura e split para afiliado).
// Chaves só por variável de ambiente no servidor: ASAAS_API_KEY, ASAAS_API_URL, ASAAS_WEBHOOK_TOKEN.
// Sandbox: https://api-sandbox.asaas.com/v3 · Produção: https://api.asaas.com/v3
import { AFFILIATE_PERCENT, CATALOG, discounted, type ProductId } from "./pricing";

const API = (process.env.ASAAS_API_URL || "https://api-sandbox.asaas.com/v3").replace(/\s+/g, "").replace(/\/+$/, "");
// Tira espaços e quebras de linha coladas junto com a chave.
const KEY = (process.env.ASAAS_API_KEY || "").replace(/\s+/g, "");

export function asaasConfigured() {
  return Boolean(KEY);
}

// Diagnóstico sem segredos (para /api/saude): modo e se a chave é aceita pelo Asaas.
export async function asaasStatus() {
  const modo = API.includes("sandbox") ? "sandbox (teste)" : "produção (dinheiro real)";
  if (!KEY) return { modo, chave: "não configurada" };
  const tipoChave = KEY.startsWith("$aact_prod_") ? "produção" : KEY.startsWith("$aact_hmlg_") ? "sandbox" : "desconhecido";
  try {
    const r = await fetch(`${API}/customers?limit=1`, { headers: { access_token: KEY, "User-Agent": "corte25" }, cache: "no-store" });
    return { modo, tipo_da_chave: tipoChave, chave: r.ok ? "ok" : `recusada (erro ${r.status})`, webhook_token: Boolean(process.env.ASAAS_WEBHOOK_TOKEN) };
  } catch (err) {
    return { modo, tipo_da_chave: tipoChave, chave: `falhou: ${(err as Error).message}`.slice(0, 120) };
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: KEY,
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
  discountPercent?: number; // desconto da indicação (só na primeira compra)
}): Promise<{ id: string; url: string; subscription?: string; value: number }> {
  const item = CATALOG[opts.product];
  const value = opts.discountPercent ? discounted(item.value, opts.discountPercent) : item.value;
  const base = {
    customer: opts.customer,
    billingType: "UNDEFINED",
    value: item.recurring ? item.value : value,
    description: `Corte25 · ${item.label}${opts.discountPercent ? ` · ${opts.discountPercent}% de desconto pela indicação` : ""}`,
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
    // Desconto só na primeira mensalidade: ajusta o valor dessa cobrança; as próximas vêm cheias.
    let firstValue: number = item.value;
    if (value !== item.value) {
      try {
        await call("PUT", `/payments/${first.id}`, { value });
        firstValue = value;
      } catch (err) {
        console.warn("[asaas] não deu para aplicar o desconto na 1ª mensalidade:", (err as Error).message);
      }
    }
    return { id: first.id, url: first.invoiceUrl, subscription: sub.id, value: firstValue };
  }
  const pay = await withCallback<{ id: string; invoiceUrl: string }>("/payments", { ...base, dueDate: today(1) });
  return { id: pay.id, url: pay.invoiceUrl, value };
}

export async function getPayment(id: string) {
  return call<{ id: string; status: string; value: number; externalReference?: string | null; subscription?: string | null }>(
    "GET",
    `/payments/${encodeURIComponent(id)}`,
  );
}

// Para de repassar comissão nas próximas mensalidades (o afiliado já recebeu nas 3 primeiras compras).
export async function removeSubscriptionSplit(id: string) {
  return call("PUT", `/subscriptions/${encodeURIComponent(id)}`, { split: [] });
}

export async function cancelSubscription(id: string) {
  return call("DELETE", `/subscriptions/${id}`);
}

// Webhook: o Asaas manda o token configurado no painel neste cabeçalho.
export function webhookAuthorized(req: Request) {
  const expected = (process.env.ASAAS_WEBHOOK_TOKEN || "").trim();
  return Boolean(expected) && (req.headers.get("asaas-access-token") || "").trim() === expected;
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
