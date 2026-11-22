import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser, getProfile } from "@/lib/auth";
import { asaasConfigured } from "@/lib/asaas";
import { balance, referralDiscount, syncPendingPayments } from "@/lib/credits";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";
import { AFFILIATE_PERCENT, CATALOG } from "@/lib/pricing";
import { isAdminEmail } from "@/lib/admin";
import { activeGrants, vipAllowance, vipStatus } from "@/lib/vip";
import AccountPanel from "./account-panel";

// Indicações de quem está logado: quantas contas vieram pelo link, compras pagas e comissão.
async function affiliateStats(userId: string) {
  const db = supabaseAdmin();
  const { data: me } = await db.from("profiles").select("ref_code").eq("id", userId).maybeSingle();
  if (!me?.ref_code) return { referrals: 0, sales: 0, commission: 0 };
  const [{ count }, { data: paid }] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", me.ref_code),
    db.from("payments").select("value, affiliate_percent").eq("affiliate_code", me.ref_code).in("status", ["CONFIRMED", "RECEIVED"]),
  ]);
  const total = (paid ?? []).reduce((a, r) => a + Number(r.value) * Number(r.affiliate_percent ?? AFFILIATE_PERCENT), 0);
  return { referrals: count ?? 0, sales: paid?.length ?? 0, commission: Math.round(total) / 100 };
}

export const metadata = { title: "Minha conta · Corte25" };

async function Account({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const buy = typeof sp.comprar === "string" && sp.comprar in CATALOG ? sp.comprar : null;
  if (!supabaseConfigured())
    return <p className="p-10 text-center text-foreground/60">O login ainda não está ativo nesta versão de teste.</p>;
  const user = await currentUser();
  if (!user) redirect(`/entrar?volta=${encodeURIComponent(buy ? `/conta?comprar=${buy}` : "/conta")}`);
  await syncPendingPayments(user.id);
  const [profile, credits, payments, affiliate] = await Promise.all([
    getProfile(user.id),
    balance(user.id),
    supabaseAdmin()
      .from("payments")
      .select("id, product, value, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then((r) => r.data ?? []),
    affiliateStats(user.id),
  ]);
  const [discount, admin, vip, allowance, grants] = await Promise.all([
    referralDiscount(user.id, profile?.referred_by),
    isAdminEmail(),
    vipStatus(user),
    vipAllowance(user),
    activeGrants(user.id).catch(() => []),
  ]);
  return (
    <AccountPanel
      email={user.email || ""}
      name={profile?.name || ""}
      credits={credits}
      refCode={profile?.ref_code || ""}
      hasWallet={Boolean(profile?.affiliate_wallet_id)}
      walletId={profile?.affiliate_wallet_id || ""}
      hasCustomer={Boolean(profile?.asaas_customer_id)}
      paymentsOn={asaasConfigured()}
      buy={buy}
      paid={sp.pago === "1"}
      affiliatePercent={AFFILIATE_PERCENT}
      affiliate={affiliate}
      discount={discount}
      payments={payments}
      siteUrl={process.env.SITE_URL || "https://corte25.com.br"}
      admin={admin}
      vip={{ ...vip, quota: allowance.vip ? null : allowance.quota, subscriber: allowance.subscriber, grants }}
    />
  );
}

export default function Page({ searchParams }: PageProps<"/conta">) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-foreground/60">Carregando…</p>}>
      <Account searchParams={searchParams} />
    </Suspense>
  );
}
