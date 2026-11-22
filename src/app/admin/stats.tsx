import type { AdminStats } from "@/lib/admin-stats";
import { brl } from "@/lib/pricing";

const box = "rounded-xl bg-foreground/5 p-3";

export default function Stats({ s }: { s: AdminStats }) {
  const big = [
    ["Vendas pagas", String(s.sales.count), brl(s.sales.total)],
    ["Neste mês", String(s.month.count), brl(s.month.total)],
    ["Hoje", String(s.today.count), brl(s.today.total)],
    ["Testes grátis", String(s.trials.total), `${s.trials.week} nos últimos 7 dias · ${s.trials.today} hoje`],
  ];
  return (
    <div className="grid gap-3 rounded-2xl bg-surface p-5 ring-1 ring-foreground/10">
      <h2 className="text-lg font-black">Vendas e testes</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {big.map(([k, v, sub]) => (
          <div key={k} className={box}>
            <p className="text-xs font-semibold text-foreground/60">{k}</p>
            <p className="text-2xl font-black">{v}</p>
            <p className="text-[11px] text-foreground/60">{sub}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-1">
        <p className="text-xs font-semibold text-foreground/60">Pacotes vendidos (pagos)</p>
        <ul className="grid gap-1 text-sm">
          {s.byProduct.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-foreground/5 px-3 py-2">
              <span className="min-w-0 truncate">{p.label}</span>
              <span className="whitespace-nowrap font-bold">
                {p.count} · {brl(p.total)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-foreground/60">
        {s.accounts} contas criadas · {s.videosGenerated} vídeos pagos gerados · {s.pending} cobrança{s.pending === 1 ? "" : "s"} aguardando
        pagamento · conversão teste → venda: {s.trials.total ? Math.round((s.sales.count / s.trials.total) * 100) : 0}% (aproximada)
      </p>
    </div>
  );
}
