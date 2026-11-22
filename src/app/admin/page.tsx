import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { hasAdminKeyCookie, isAdminEmail } from "@/lib/admin";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Coupon } from "@/lib/coupons";
import AdminCoupons from "./admin-coupons";
import Stats from "./stats";
import AdminRelatos, { type Relato } from "./admin-relatos";
import { adminStats } from "@/lib/admin-stats";

const nowMs = () => Date.now();

export const metadata = { title: "Administrador · Corte25", robots: { index: false } };

// Só a conta listada em ADMIN_EMAILS chega aqui (as outras recebem "página não encontrada"),
// e ainda precisa digitar a senha ADMIN_KEY (vale 12 horas neste navegador).
async function Admin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Lê os parâmetros antes de tudo: deixa a página dinâmica (sem isso o build a congelava num redirecionamento).
  await connection();
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/entrar?volta=/admin");
  if (!(await isAdminEmail())) notFound();
  if (!(await hasAdminKeyCookie())) {
    const erro = sp.erro;
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
        {(process.env.ADMIN_KEY || "").length < 12 ? (
          <p className="text-sm font-semibold text-brand-ink">
            A senha ADMIN_KEY não está no Railway ou tem menos de 12 caracteres. Ajuste em Variables e clique em Deploy.
          </p>
        ) : (
          erro && (
            <p className="text-sm font-semibold text-brand-ink">
              Senha não confere. É a senha da página de contatos (ADMIN_KEY no Railway), não a senha de login da conta.
            </p>
          )
        )}
        <button className="rounded-xl bg-brand py-2.5 font-black text-on-brand hover:bg-brand-dark">Entrar</button>
        <Link href="/conta" className="text-center text-sm text-foreground/60 underline">
          Voltar para a conta
        </Link>
      </form>
    );
  }
  const now = nowMs();
  const [{ data }, stats, relatos] = await Promise.all([
    supabaseAdmin().from("coupons").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
    adminStats(now),
    supabaseAdmin()
      .from("bug_reports")
      .select("id, created_at, status, summary, details, page, email, contact, transcript, browser, fix_note, fix_pr, has_print:has_screenshot")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return (
    <AdminCoupons initial={(data ?? []) as Coupon[]} now={now}>
      <Stats s={stats} />
      <AdminRelatos initial={(relatos.data ?? []) as Relato[]} />
    </AdminCoupons>
  );
}

export default function Page({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-foreground/60">Carregando…</p>}>
      <Admin searchParams={searchParams} />
    </Suspense>
  );
}
