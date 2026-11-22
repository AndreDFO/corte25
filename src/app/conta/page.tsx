import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser, getProfile } from "@/lib/auth";
import { asaasConfigured } from "@/lib/asaas";
import { balance } from "@/lib/credits";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";
import { AFFILIATE_PERCENT, CATALOG } from "@/lib/pricing";
import AccountPanel from "./account-panel";

export const metadata = { title: "Minha conta · Corte25" };

async function Account({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const buy = typeof sp.comprar === "string" && sp.comprar in CATALOG ? sp.comprar : null;
  if (!supabaseConfigured())
    return <p className="p-10 text-center text-foreground/60">O login ainda não está ativo nesta versão de teste.</p>;
  const user = await currentUser();
  if (!user) redirect(`/entrar?volta=${encodeURIComponent(buy ? `/conta?comprar=${buy}` : "/conta")}`);
  const [profile, credits, payments] = await Promise.all([
    getProfile(user.id),
    balance(user.id),
    supabaseAdmin()
      .from("payments")
      .select("id, product, value, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then((r) => r.data ?? []),
  ]);
  return (
    <AccountPanel
      email={user.email || ""}
      name={profile?.name || ""}
      credits={credits}
      refCode={profile?.ref_code || ""}
      hasWallet={Boolean(profile?.affiliate_wallet_id)}
      hasCustomer={Boolean(profile?.asaas_customer_id)}
      paymentsOn={asaasConfigured()}
      buy={buy}
      affiliatePercent={AFFILIATE_PERCENT}
      payments={payments}
      siteUrl={process.env.SITE_URL || "https://corte25.com.br"}
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
