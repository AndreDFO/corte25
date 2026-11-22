"use client";

import Link from "next/link";
import { useState } from "react";
import type { Report } from "@/lib/report";

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const br = (d: string) => d.split("-").reverse().join("/");
const card = "min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-foreground/10 sm:p-5";
const th = "px-2 py-1.5 text-left text-xs font-semibold text-foreground/60";
const td = "px-2 py-1.5";
const field = "w-full min-w-0 rounded-lg border border-foreground/15 bg-field px-2 py-1.5 text-sm";

// Atalhos de período (horário de Brasília).
function preset(kind: "hoje" | "7" | "30" | "mes" | "ano") {
  const day = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const now = new Date();
  const today = day(now);
  if (kind === "hoje") return [today, today];
  if (kind === "7") return [day(new Date(now.getTime() - 6 * 864e5)), today];
  if (kind === "30") return [day(new Date(now.getTime() - 29 * 864e5)), today];
  if (kind === "mes") return [`${today.slice(0, 7)}-01`, today];
  return [`${today.slice(0, 4)}-01-01`, today];
}

// No PC: tabela. No celular: cada linha vira um cartão (primeira coluna em destaque, o resto em "rótulo: valor").
function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty?: string }) {
  if (!rows.length) return <p className="text-sm text-foreground/60">{empty || "Nada no período."}</p>;
  return (
    <>
      <ul className="grid grid-cols-1 gap-2 sm:hidden">
        {rows.map((r, i) => (
          <li key={i} className="min-w-0 rounded-xl bg-foreground/5 px-3 py-2 text-sm">
            <p className="break-words font-bold">{r[0]}</p>
            <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
              {r.slice(1).map((c, j) => (
                <div key={j} className="contents">
                  <dt className="text-foreground/60">{head[j + 1]}</dt>
                  <dd className="break-words text-right font-semibold">{c}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10">
              {head.map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-foreground/5">
                {r.map((c, j) => (
                  <td key={j} className={`${td} ${j ? "whitespace-nowrap" : ""}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function ReportView({ r }: { r: Report }) {
  const [de, setDe] = useState(r.de);
  const [ate, setAte] = useState(r.ate);
  const [busy, setBusy] = useState(false);
  const s = r.summary;
  const go = (a: string, b: string) => (window.location.href = `/admin/relatorio?de=${a}&ate=${b}`);

  const summary: [string, string][] = [
    ["Vendas pagas", String(s.sales)],
    ["Faturamento", brl(s.revenue)],
    ["Ticket médio", brl(s.ticket)],
    ["Clientes que compraram", String(s.buyers)],
    ["Testes grátis", String(s.trials)],
    ["Conversão teste → compra", `${s.conversion}%`],
    ["Contas criadas", String(s.accounts)],
    ["Vídeos pagos gerados", String(s.videosGenerated)],
    ["Cobranças em aberto", `${s.pending} · ${brl(s.pendingValue)}`],
    ["Comissão de afiliados", brl(s.commission)],
  ];
  const dailyRows = r.daily.filter((d) => d.sales || d.trials || d.accounts).map((d) => [br(d.date), d.sales, brl(d.revenue), d.trials, d.accounts]);
  const productRows = r.byProduct.map((p) => [p.product, p.count, brl(p.revenue)]);
  const couponRows = r.coupons.map((c) => [c.code, c.count, brl(c.revenue)]);
  const affRows = r.affiliates.map((a) => [a.code, a.count, brl(a.revenue), brl(a.commission)]);
  const saleRows = r.sales.map((x) => [br(x.date), x.product, brl(x.value), x.customer || x.email, x.coupon || "—", x.affiliate || "—"]);

  async function pdf() {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const lilac: [number, number, number] = [139, 123, 255];
      doc.setFontSize(18);
      doc.text("Relatório de vendas · Corte25", 40, 50);
      doc.setFontSize(10);
      doc.setTextColor(110);
      doc.text(`Período: ${br(r.de)} a ${br(r.ate)} · gerado em ${new Date(r.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, 40, 68);
      doc.setTextColor(0);
      let y = 84;
      const section = (title: string, head: string[], body: (string | number)[][]) => {
        if (!body.length) return;
        autoTable(doc, {
          startY: y + 14,
          head: [head],
          body: body.map((row) => row.map(String)),
          headStyles: { fillColor: lilac },
          styles: { fontSize: 9 },
          margin: { left: 40, right: 40 },
        });
        doc.setFontSize(12);
        doc.text(title, 40, y + 8);
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
      };
      section("Resumo", ["Indicador", "Valor"], summary);
      section("Por dia", ["Data", "Vendas", "Faturamento", "Testes grátis", "Contas"], dailyRows);
      section("Por pacote", ["Pacote", "Vendas", "Faturamento"], productRows);
      section("Cupons", ["Cupom", "Vendas", "Faturamento"], couponRows);
      section("Afiliados", ["Código", "Vendas", "Faturamento", "Comissão"], affRows);
      section("Vendas", ["Data", "Pacote", "Valor", "Cliente", "Cupom", "Afiliado"], saleRows);
      doc.save(`relatorio-corte25_${r.de}_a_${r.ate}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 overflow-x-hidden px-3 py-6 sm:px-5 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Relatório de vendas</h1>
          <p className="text-sm text-foreground/60">
            {br(r.de)} a {br(r.ate)} · horário de Brasília
          </p>
        </div>
        <Link href="/admin" className="text-sm underline">
          ← Área do administrador
        </Link>
      </div>

      <div className={`${card} grid grid-cols-1 gap-3`}>
        <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-foreground/60">
            De
            <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className={field} />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-foreground/60">
            Até
            <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className={field} />
          </label>
          <button onClick={() => go(de, ate)} className="col-span-2 rounded-lg bg-brand px-4 py-2 text-sm font-black text-on-brand hover:bg-brand-dark">
            Filtrar
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(
            [
              ["hoje", "Hoje"],
              ["7", "7 dias"],
              ["30", "30 dias"],
              ["mes", "Este mês"],
              ["ano", "Este ano"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} onClick={() => go(...(preset(k) as [string, string]))} className="rounded-full border border-foreground/15 px-3 py-1 font-semibold">
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <a
            href={`/api/admin/relatorio?de=${r.de}&ate=${r.ate}&formato=csv`}
            className="rounded-xl bg-foreground px-4 py-2 text-center text-sm font-bold text-background"
          >
            ⬇ Baixar planilha (Excel)
          </a>
          <button onClick={pdf} disabled={busy} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-dark disabled:opacity-60">
            {busy ? "Gerando PDF…" : "⬇ Baixar PDF"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {summary.map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-xl bg-surface p-3 ring-1 ring-foreground/10">
            <p className="text-[11px] font-semibold text-foreground/60">{k}</p>
            <p className="break-words text-base font-black sm:text-lg">{v}</p>
          </div>
        ))}
      </div>

      <div className={`${card} grid grid-cols-1 gap-2`}>
        <h2 className="font-black">Por dia</h2>
        <Table head={["Data", "Vendas", "Faturamento", "Testes grátis", "Contas"]} rows={dailyRows} />
      </div>
      <div className={`${card} grid grid-cols-1 gap-2`}>
        <h2 className="font-black">Por pacote</h2>
        <Table head={["Pacote", "Vendas", "Faturamento"]} rows={productRows} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={`${card} grid grid-cols-1 gap-2`}>
          <h2 className="font-black">Cupons usados</h2>
          <Table head={["Cupom", "Vendas", "Faturamento"]} rows={couponRows} empty="Nenhum cupom usado no período." />
        </div>
        <div className={`${card} grid grid-cols-1 gap-2`}>
          <h2 className="font-black">Afiliados</h2>
          <Table head={["Código", "Vendas", "Faturamento", "Comissão"]} rows={affRows} empty="Nenhuma venda por afiliado no período." />
        </div>
      </div>
      <div className={`${card} grid grid-cols-1 gap-2`}>
        <h2 className="font-black">Vendas</h2>
        <Table head={["Data", "Pacote", "Valor", "Cliente", "Cupom", "Afiliado"]} rows={saleRows} />
      </div>
    </div>
  );
}
