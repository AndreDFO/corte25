// Relatório de vendas do administrador (período em horário de Brasília).
import { listLeads } from "./leads";
import { AFFILIATE_PERCENT, CATALOG, type ProductId } from "./pricing";
import { supabaseAdmin } from "./supabase-admin";

const PAID = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];
export const dayBR = (iso: string | Date) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const round = (n: number) => Math.round(n * 100) / 100;
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export interface Sale {
  date: string; // dia do pagamento (AAAA-MM-DD)
  product: string;
  value: number;
  customer: string;
  email: string;
  coupon: string;
  affiliate: string;
  commission: number;
}

export async function buildReport(deRaw: string, ateRaw: string, now = new Date()) {
  const today = dayBR(now);
  const ate = isDay(ateRaw) ? ateRaw : today;
  const de = isDay(deRaw) ? deRaw : `${today.slice(0, 7)}-01`;
  const from = new Date(`${de}T00:00:00-03:00`).toISOString();
  const to = new Date(`${ate}T23:59:59.999-03:00`).toISOString();
  const inRange = (iso: string) => iso >= from && iso <= to;
  const db = supabaseAdmin();

  const [{ data: pays }, { data: profs }, leads, { data: used }] = await Promise.all([
    // Pagamento confirmado: a data é a da confirmação (updated_at).
    db.from("payments").select("id, user_id, product, value, status, affiliate_code, affiliate_percent, coupon_code, bonus_videos, created_at, updated_at").limit(10000),
    db.from("profiles").select("id, name, email, created_at").limit(10000),
    listLeads().catch(() => []),
    db.from("credit_ledger").select("delta, created_at").lt("delta", 0).gte("created_at", from).lte("created_at", to).limit(10000),
  ]);
  const people = new Map((profs ?? []).map((p) => [p.id, p]));
  const paid = (pays ?? []).filter((p) => PAID.includes(p.status) && inRange(p.updated_at || p.created_at));
  const created = (pays ?? []).filter((p) => inRange(p.created_at));
  const pending = created.filter((p) => p.status === "PENDING" || p.status === "OVERDUE");
  const trials = leads.filter((l) => inRange(new Date(l.createdAt).toISOString()));
  const accounts = (profs ?? []).filter((p) => inRange(p.created_at));

  const sales: Sale[] = paid
    .map((p) => ({
      date: dayBR(p.updated_at || p.created_at),
      product: CATALOG[p.product as ProductId]?.label || p.product,
      value: Number(p.value),
      customer: people.get(p.user_id)?.name || "",
      email: people.get(p.user_id)?.email || "",
      coupon: p.coupon_code || "",
      affiliate: p.affiliate_code || "",
      commission: p.affiliate_code ? round((Number(p.value) * Number(p.affiliate_percent ?? AFFILIATE_PERCENT)) / 100) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const revenue = round(sales.reduce((a, s) => a + s.value, 0));

  // Um dia por linha, do início ao fim do período (inclusive dias sem venda).
  const daily: { date: string; sales: number; revenue: number; trials: number; accounts: number }[] = [];
  for (let d = new Date(`${de}T12:00:00-03:00`); dayBR(d) <= ate && daily.length < 400; d = new Date(d.getTime() + 864e5)) {
    const k = dayBR(d);
    const ds = sales.filter((s) => s.date === k);
    daily.push({
      date: k,
      sales: ds.length,
      revenue: round(ds.reduce((a, s) => a + s.value, 0)),
      trials: trials.filter((t) => dayBR(t.createdAt) === k).length,
      accounts: accounts.filter((a) => dayBR(a.created_at) === k).length,
    });
  }

  const byProduct = (Object.keys(CATALOG) as ProductId[]).map((id) => {
    const l = paid.filter((p) => p.product === id);
    return { product: CATALOG[id].label, count: l.length, revenue: round(l.reduce((a, p) => a + Number(p.value), 0)) };
  });

  const group = (key: "coupon" | "affiliate") => {
    const m = new Map<string, { count: number; revenue: number }>();
    for (const s of sales) {
      if (!s[key]) continue;
      const g = m.get(s[key]) || { count: 0, revenue: 0 };
      g.count++;
      g.revenue = round(g.revenue + s.value);
      m.set(s[key], g);
    }
    return [...m.entries()].map(([code, g]) => ({ code, ...g }));
  };
  const affiliates = group("affiliate").map((a) => ({
    ...a,
    commission: round(sales.filter((s) => s.affiliate === a.code).reduce((t, s) => t + s.commission, 0)),
  }));
  const buyers = new Set(paid.map((p) => p.user_id)).size;

  return {
    de,
    ate,
    generatedAt: now.toISOString(),
    summary: {
      sales: sales.length,
      revenue,
      ticket: sales.length ? round(revenue / sales.length) : 0,
      buyers,
      pending: pending.length,
      pendingValue: round(pending.reduce((a, p) => a + Number(p.value), 0)),
      trials: trials.length,
      accounts: accounts.length,
      conversion: trials.length ? Math.round((buyers / trials.length) * 100) : 0,
      videosGenerated: (used ?? []).reduce((a, r) => a - Number(r.delta), 0),
      commission: round(affiliates.reduce((a, x) => a + x.commission, 0)),
    },
    daily,
    byProduct,
    coupons: group("coupon"),
    affiliates,
    sales,
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

// Planilha em CSV (abre no Excel em português: ";" e vírgula decimal, com BOM para os acentos).
export function reportCsv(r: Report) {
  const n = (v: number) => v.toFixed(2).replace(".", ",");
  const br = (d: string) => d.split("-").reverse().join("/");
  const esc = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: (string | number)[][] = [
    ["Relatório de vendas Corte25", `${br(r.de)} a ${br(r.ate)}`],
    [],
    ["RESUMO"],
    ["Vendas pagas", r.summary.sales],
    ["Faturamento (R$)", n(r.summary.revenue)],
    ["Ticket médio (R$)", n(r.summary.ticket)],
    ["Clientes que compraram", r.summary.buyers],
    ["Cobranças em aberto", r.summary.pending],
    ["Valor em aberto (R$)", n(r.summary.pendingValue)],
    ["Testes grátis", r.summary.trials],
    ["Contas criadas", r.summary.accounts],
    ["Conversão teste → compra (%)", r.summary.conversion],
    ["Vídeos pagos gerados", r.summary.videosGenerated],
    ["Comissão de afiliados (R$)", n(r.summary.commission)],
    [],
    ["POR DIA"],
    ["Data", "Vendas", "Faturamento (R$)", "Testes grátis", "Contas criadas"],
    ...r.daily.map((d) => [br(d.date), d.sales, n(d.revenue), d.trials, d.accounts]),
    [],
    ["POR PACOTE"],
    ["Pacote", "Vendas", "Faturamento (R$)"],
    ...r.byProduct.map((p) => [p.product, p.count, n(p.revenue)]),
    [],
    ["CUPONS"],
    ["Cupom", "Vendas", "Faturamento (R$)"],
    ...r.coupons.map((c) => [c.code, c.count, n(c.revenue)]),
    [],
    ["AFILIADOS"],
    ["Código", "Vendas", "Faturamento (R$)", "Comissão (R$)"],
    ...r.affiliates.map((a) => [a.code, a.count, n(a.revenue), n(a.commission)]),
    [],
    ["VENDAS"],
    ["Data", "Pacote", "Valor (R$)", "Cliente", "E-mail", "Cupom", "Afiliado"],
    ...r.sales.map((s) => [br(s.date), s.product, n(s.value), s.customer, s.email, s.coupon, s.affiliate]),
  ];
  return "﻿" + rows.map((row) => row.map(esc).join(";")).join("\r\n");
}
