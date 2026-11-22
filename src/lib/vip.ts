import { supabaseAdmin, supabaseConfigured } from "./supabase-admin";
import { SUBSCRIBER_VIP_VIDEOS, SUBSCRIPTIONS, VIP_DAYS } from "./pricing";

// Plano VIP (22/11/2026): assinatura extra de R$ 14,99/mês. Só VIP (e o admin) usa:
// textos no vídeo, cortar partes sem som, música (biblioteca e envio), narração e legenda automática.
// Use isVip() no SERVIDOR antes de aplicar qualquer um desses recursos (não confie só na tela).
export const VIP_FEATURES = ["textos no vídeo", "cortar partes sem som", "música", "narração", "legenda automática"] as const;

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
}

export async function vipStatus(user: U): Promise<VipStatus> {
  const none: VipStatus = { active: false, until: null, canceled: false, subscriptionId: null, admin: false };
  if (!user) return none;
  if (adminEmail(user.email)) return { ...none, active: true, admin: true };
  if (!supabaseConfigured()) return none;
  const db = supabaseAdmin();
  const { data: pay } = await db
    .from("payments")
    .select("subscription_id, updated_at, created_at")
    .eq("user_id", user.id)
    .eq("product", "vip")
    .in("status", ["CONFIRMED", "RECEIVED"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pay) return none;
  const paidAt = new Date(pay.updated_at || pay.created_at).getTime();
  const until = new Date(paidAt + VIP_DAYS * 24 * 3600_000);
  const { data: prof } = await db.from("profiles").select("vip_canceled_at").eq("id", user.id).maybeSingle();
  return {
    active: until.getTime() > Date.now(),
    until: until.toISOString(),
    canceled: Boolean(prof?.vip_canceled_at),
    subscriptionId: pay.subscription_id ?? null,
    admin: false,
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
// vip = tudo liberado; quota = quantos vídeos VIP ainda restam no mês (assinante mensal sem VIP).
export async function vipAllowance(user: U): Promise<{ vip: boolean; quota: number; subscriber: boolean }> {
  if (await isVip(user)) return { vip: true, quota: Infinity, subscriber: false };
  if (!user || !supabaseConfigured()) return { vip: false, quota: 0, subscriber: false };
  const db = supabaseAdmin();
  const since = new Date(Date.now() - VIP_DAYS * 24 * 3600_000).toISOString();
  const { count } = await db
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("product", SUBSCRIPTIONS.map((s) => s.id))
    .in("status", ["CONFIRMED", "RECEIVED"])
    .gte("updated_at", since);
  if (!count) return { vip: false, quota: 0, subscriber: false };
  const { data } = await db.from("vip_usage").select("videos").eq("user_id", user.id).gte("created_at", monthStart());
  const used = (data ?? []).reduce((a, r) => a + Number(r.videos), 0);
  return { vip: false, quota: Math.max(0, SUBSCRIBER_VIP_VIDEOS - used), subscriber: true };
}

// Registra os vídeos VIP gastos da cota do mês.
export async function spendVipQuota(userId: string, jobId: string, videos: number) {
  if (videos > 0) await supabaseAdmin().from("vip_usage").insert({ user_id: userId, job_id: jobId, videos });
}
