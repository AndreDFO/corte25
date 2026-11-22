// Números para a área do administrador: vendas pagas, pacotes por tipo, testes grátis e contas.
import { listLeads } from "./leads";
import { CATALOG, type ProductId } from "./pricing";
import { supabaseAdmin } from "./supabase-admin";

const PAID = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];
// Dia no horário de Brasília (AAAA-MM-DD).
const dayBR = (iso: string | Date) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export async function adminStats(now: number) {
  const db = supabaseAdmin();
  const [{ data: pays }, { count: accounts }, leads, { data: used }] = await Promise.all([
    db.from("payments").select("product, value, status, created_at"),
    db.from("profiles").select("id", { count: "exact", head: true }),
    listLeads().catch(() => []),
    db.from("credit_ledger").select("delta").lt("delta", 0),
  ]);
  const today = dayBR(new Date(now));
  const month = today.slice(0, 7);
  const weekAgo = now - 7 * 864e5;
  const paid = (pays ?? []).filter((p) => PAID.includes(p.status));
  const sum = (l: { value: number }[]) => l.reduce((a, p) => a + Number(p.value), 0);
  const byProduct = (Object.keys(CATALOG) as ProductId[]).map((id) => {
    const l = paid.filter((p) => p.product === id);
    return { id, label: CATALOG[id].label, count: l.length, total: sum(l) };
  });
  const paidToday = paid.filter((p) => dayBR(p.created_at) === today);
  const paidMonth = paid.filter((p) => dayBR(p.created_at).startsWith(month));
  return {
    sales: { count: paid.length, total: sum(paid) },
    today: { count: paidToday.length, total: sum(paidToday) },
    month: { count: paidMonth.length, total: sum(paidMonth) },
    pending: (pays ?? []).filter((p) => p.status === "PENDING").length,
    byProduct,
    trials: {
      total: leads.length,
      today: leads.filter((l) => dayBR(l.createdAt) === today).length,
      week: leads.filter((l) => new Date(l.createdAt).getTime() >= weekAgo).length,
    },
    accounts: accounts ?? 0,
    videosGenerated: (used ?? []).reduce((a, r) => a - Number(r.delta), 0),
  };
}

export type AdminStats = Awaited<ReturnType<typeof adminStats>>;
