import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasAdminKeyCookie, isAdminEmail } from "@/lib/admin";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Coupon } from "@/lib/coupons";
import AdminCoupons from "./admin-coupons";

const nowMs = () => Date.now();

export const metadata = { title: "Administrador · Corte25", robots: { index: false } };

// Só a conta listada em ADMIN_EMAILS chega aqui (as outras recebem "página não encontrada"),
// e ainda precisa digitar a senha ADMIN_KEY (vale 12 horas neste navegador).
async function Admin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await currentUser();
  if (!user) redirect("/entrar?volta=/admin");
  if (!(await isAdminEmail())) notFound();
  if (!(await hasAdminKeyCookie())) {
    const erro = (await searchParams).erro;
    return (
      <form method="post" action="/api/admin" className="mx-auto grid max-w-sm gap-3 px-5 py-16">
        <input type="hidden" name="volta" value="/admin" />
        <h1 className="text-2xl font-black tracking-tight">Área do administrador</h1>
        <p className="text-sm text-foreground/60">Digite a senha de administrador (a que está em ADMIN_KEY no Railway).</p>
        <input
          name="chave"
          type="password"
          required
          autoComplete="current-password"
          aria-label="Senha de administrador"
          placeholder="Senha de administrador"
          className="rounded-lg border border-foreground/15 bg-field px-3 py-2"
        />
        {erro && <p className="text-sm font-semibold text-brand-ink">Senha não confere.</p>}
        <button className="rounded-xl bg-brand py-2.5 font-black text-on-brand hover:bg-brand-dark">Entrar</button>
        <Link href="/conta" className="text-center text-sm text-foreground/60 underline">
          Voltar para a conta
        </Link>
      </form>
    );
  }
  const { data } = await supabaseAdmin().from("coupons").select("*").order("created_at", { ascending: false });
  return <AdminCoupons initial={(data ?? []) as Coupon[]} now={nowMs()} />;
}

export default function Page({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-foreground/60">Carregando…</p>}>
      <Admin searchParams={searchParams} />
    </Suspense>
  );
}
