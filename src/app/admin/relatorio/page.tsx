import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { hasAdminKeyCookie, isAdminEmail } from "@/lib/admin";
import { currentUser } from "@/lib/auth";
import { buildReport } from "@/lib/report";
import ReportView from "./report-view";

export const metadata = { title: "Relatório de vendas · Corte25", robots: { index: false } };

// Mesma trava da área do administrador: conta do dono + senha ADMIN_KEY.
async function Relatorio({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  if (!(await currentUser())) redirect("/entrar?volta=/admin/relatorio");
  if (!(await isAdminEmail())) notFound();
  if (!(await hasAdminKeyCookie())) redirect("/admin");
  const r = await buildReport(typeof sp.de === "string" ? sp.de : "", typeof sp.ate === "string" ? sp.ate : "");
  return <ReportView r={r} />;
}

export default function Page({ searchParams }: PageProps<"/admin/relatorio">) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-foreground/60">Carregando…</p>}>
      <Relatorio searchParams={searchParams} />
    </Suspense>
  );
}
