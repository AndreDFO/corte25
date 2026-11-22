import { supabaseAdmin, supabaseConfigured } from "./supabase-admin";
import { VIP_PRODUCTS, ALL_VIP_FEATURES, SUBSCRIBER_VIP_VIDEOS, SUBSCRIPTIONS, VIP_DAYS, type VipFeature } from "./pricing";
import { normalizeCode } from "./coupons";
import { redeemCoupon } from "./redeem";

// Plano VIP (22/11/2026): assinatura extra de R$ 14,99/mês. Só VIP (e o admin) usa:
// textos no vídeo, cortar partes sem som, música (biblioteca e envio), narração, legenda automática e transição suave.
// Use isVip() no SERVIDOR antes de aplicar qualquer um desses recursos (não confie só na tela).
export const VIP_FEATURES = ["textos no vídeo", "cortar partes sem som", "música", "narração", "legenda automática", "transição suave"] as const;

type U = { id: string; email?: string | null } | null | undefined;

function adminEmail(email?: string | null) {
  const list = (process.env.ADMIN_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
  return Boolean(email && list.includes(email.toLowerCase()));
}

export interface VipStatus {
  active: boolean;
  until: string | null; // até quando vale o mês já pago
  canceled: boolean; // pediu para cancelar (vale até "until")
  subscriptionId: string | null;
  admin: boolean;
  coupon?: boolean; // VIP completo vindo de cupom (sem assinatura)
  combo?: boolean; // VIP junto com a assinatura de vídeos (cancelar cancela os dois)
}

export interface VipGrant {
  features: string[];
  until: string;
}

// Recursos liberados por cupom que ainda estão valendo.
export async function activeGrants(userId: string): Promise<VipGrant[]> {
  if (!supabaseConfigured()) return [];
  const { data } = await supabaseAdmin()
    .from("vip_grants")
    .select("features, until")
    .eq("user_id", userId)
    .gt("until", new Date().toISOString())
    .order("until", { ascending: false });
  return (data ?? []) as VipGrant[];
}

export async function vipStatus(user: U): Promise<VipStatus> {
  const none: VipStatus = { active: false, until: null, canceled: false, subscriptionId: null, admin: false };
  if (!user) return none;
  if (adminEmail(user.email)) return { ...none, active: true, admin: true };
  if (!supabaseConfigured()) return none;
  const db = supabaseAdmin();
  const { data: pay } = await db
    .from("payments")
    .select("product, subscription_id, updated_at, created_at")
    .eq("user_id", user.id)
    .in("product", VIP_PRODUCTS)
    .in("status", ["CONFIRMED", "RECEIVED"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pay) {
    const full = (await activeGrants(user.id)).find((g) => g.features.includes("todos"));
    return full ? { ...none, active: true, until: full.until, coupon: true } : none;
  }
  const paidAt = new Date(pay.updated_at || pay.created_at).getTime();
  const until = new Date(paidAt + VIP_DAYS * 24 * 3600_000);
  const { data: prof } = await db.from("profiles").select("vip_canceled_at").eq("id", user.id).maybeSingle();
  if (until.getTime() <= Date.now()) {
    const full = (await activeGrants(user.id)).find((g) => g.features.includes("todos"));
    if (full) return { ...none, active: true, until: full.until, coupon: true };
  }
  return {
    active: until.getTime() > Date.now(),
    until: until.toISOString(),
    canceled: Boolean(prof?.vip_canceled_at),
    subscriptionId: pay.subscription_id ?? null,
    admin: false,
    combo: pay.product !== "vip",
  };
}

// true = pode usar os recursos VIP. Sem Supabase (PC de teste do Andre) tudo fica liberado.
export async function isVip(user: U): Promise<boolean> {
  if (!supabaseConfigured()) return true;
  return (await vipStatus(user)).active;
}

// Início do mês atual no horário de Brasília (a cota de 3 vídeos VIP renova todo dia 1º).
function monthStart() {
  const now = new Date(Date.now() - 3 * 3600_000); // UTC-3
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 3)).toISOString();
}

// O que a pessoa pode usar de recurso VIP agora.
// vip = tudo liberado; features = recursos liberados um a um por cupom (valem em todos os vídeos);
// quota = quantos vídeos VIP ainda restam no mês (assinante mensal sem VIP).
export interface VipAllowance {
  vip: boolean;
  features: VipFeature[];
  quota: number;
  subscriber: boolean;
}
export async function vipAllowance(user: U): Promise<VipAllowance> {
  if (await isVip(user)) return { vip: true, features: [...ALL_VIP_FEATURES], quota: Infinity, subscriber: false };
  if (!user || !supabaseConfigured()) return { vip: false, features: [], quota: 0, subscriber: false };
  const db = supabaseAdmin();
  const grants = await activeGrants(user.id);
  const features = ALL_VIP_FEATURES.filter((f) => grants.some((g) => g.features.includes(f)));
  const since = new Date(Date.now() - VIP_DAYS * 24 * 3600_000).toISOString();
  const { count } = await db
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("product", SUBSCRIPTIONS.map((s) => s.id))
    .in("status", ["CONFIRMED", "RECEIVED"])
    .gte("updated_at", since);
  if (!count) return { vip: false, features, quota: 0, subscriber: false };
  const { data } = await db.from("vip_usage").select("videos").eq("user_id", user.id).gte("created_at", monthStart());
  const used = (data ?? []).reduce((a, r) => a + Number(r.videos), 0);
  return { vip: false, features, quota: Math.max(0, SUBSCRIBER_VIP_VIDEOS - used), subscriber: true };
}

// true = pode usar este recurso VIP em todos os vídeos (VIP, admin ou cupom do recurso).
export async function hasVipFeature(user: U, f: VipFeature): Promise<boolean> {
  const a = await vipAllowance(user);
  return a.vip || a.features.includes(f);
}

// Resgata um cupom de recursos VIP (tipo "vip": amount = dias, features = recursos ou ["todos"]).
// Mesmo resgate do campo "Tenho um cupom" (src/lib/redeem.ts), só que aceita apenas cupom VIP.
export async function redeemVipCoupon(userId: string, rawCode: string): Promise<{ ok: true; until: string; features: string[] } | { ok: false; error: string }> {
  const { data: c } = await supabaseAdmin().from("coupons").select("kind").eq("code", normalizeCode(rawCode)).maybeSingle();
  if (c?.kind === "gratis") return { ok: false, error: "Esse cupom dá vídeos grátis: resgate em Minha conta, no link \"Tenho um cupom\" embaixo do saldo." };
  const r = await redeemCoupon(userId, rawCode);
  if (!r.ok) return r;
  if (r.kind !== "vip") return { ok: false, error: "Esse cupom não é VIP." };
  return { ok: true, until: r.until, features: r.features };
}

// Registra os vídeos VIP gastos da cota do mês.
export async function spendVipQuota(userId: string, jobId: string, videos: number) {
  if (videos > 0) await supabaseAdmin().from("vip_usage").insert({ user_id: userId, job_id: jobId, videos });
}

// Devolve vídeos da cota VIP do mês gastos num lote que falhou (ou saiu sem a legenda prometida).
export async function refundVipQuota(userId: string, jobId: string, videos: number) {
  if (videos < 1) return;
  const db = supabaseAdmin();
  const { data } = await db.from("vip_usage").select("id, videos").eq("user_id", userId).eq("job_id", jobId).maybeSingle();
  if (!data) return;
  const left = Number(data.videos) - videos;
  if (left > 0) await db.from("vip_usage").update({ videos: left }).eq("id", data.id);
  else await db.from("vip_usage").delete().eq("id", data.id);
}
