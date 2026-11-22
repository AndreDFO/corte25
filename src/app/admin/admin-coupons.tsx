"use client";

import Link from "next/link";
import { useState } from "react";
import type { Coupon, CouponKind } from "@/lib/coupons";

const KINDS: { id: CouponKind; label: string; hint: string }[] = [
  { id: "percent", label: "% de desconto", hint: "Ex.: 20 = 20% off" },
  { id: "fixed", label: "R$ de desconto", hint: "Ex.: 5 = R$ 5,00 off" },
  { id: "videos", label: "Vídeos de bônus", hint: "Ex.: 25 = +25 vídeos" },
];

function describe(c: Coupon) {
  const n = Number(c.amount);
  if (c.kind === "percent") return `${n}% de desconto`;
  if (c.kind === "fixed") return `R$ ${n.toFixed(2).replace(".", ",")} de desconto`;
  return `+${n} vídeos de bônus`;
}

const field = "rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm";

export default function AdminCoupons({ initial, now, children }: { initial: Coupon[]; now: number; children?: React.ReactNode }) {
  const [list, setList] = useState(initial);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<CouponKind>("percent");
  const [amount, setAmount] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/cupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, kind, amount, max_uses: maxUses, expires, note }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: j.error || "Não deu certo." });
    setList([j.coupon, ...list]);
    setMsg({ ok: true, text: `Cupom ${j.coupon.code} criado.` });
    setCode("");
    setAmount("");
    setMaxUses("");
    setExpires("");
    setNote("");
  }

  async function toggle(c: Coupon) {
    const res = await fetch("/api/admin/cupons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, active: !c.active }),
    });
    if (res.ok) setList(list.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)));
  }

  async function remove(c: Coupon) {
    const aviso =
      c.uses > 0
        ? `Excluir o cupom ${c.code}? Ele para de funcionar e some da lista. As vendas que já usaram ele continuam no relatório.`
        : `Excluir o cupom ${c.code} para sempre?`;
    if (!window.confirm(aviso)) return;
    const res = await fetch(`/api/admin/cupons?id=${encodeURIComponent(c.id)}`, { method: "DELETE" });
    if (res.ok) setList(list.filter((x) => x.id !== c.id));
    else alert((await res.json().catch(() => ({}))).error || "Não foi possível excluir.");
  }

  const hint = KINDS.find((k) => k.id === kind)!.hint;
  return (
    <div className="mx-auto grid max-w-3xl gap-4 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-black tracking-tight">Área do administrador</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/contatos" className="underline">
            Contatos do teste grátis
          </Link>
          <Link href="/conta" className="text-foreground/60 underline">
            Voltar para a conta
          </Link>
        </div>
      </div>

      {children}

      <form onSubmit={create} className="grid gap-3 rounded-2xl bg-surface p-5 ring-1 ring-foreground/10">
        <h2 className="text-lg font-black">Criar cupom</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={`rounded-xl border p-2.5 text-sm font-bold ${kind === k.id ? "border-brand bg-brand/15 ring-2 ring-brand/40" : "border-foreground/15"}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-foreground/60">
            Código do cupom
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex.: BLACK20" required className={field} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-foreground/60">
            {KINDS.find((k) => k.id === kind)!.label}
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={hint} required className={field} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-foreground/60">
            Limite de usos (vazio = sem limite)
            <input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" placeholder="Ex.: 50" className={field} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-foreground/60">
            Válido até (vazio = sem validade)
            <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={field} />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold text-foreground/60">
          Anotação (só você vê)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: parceria com fulano" className={field} />
        </label>
        <p className="text-xs text-foreground/50">
          Cada pessoa usa um cupom uma vez. Desconto em % ou R$ não soma com os 10% da indicação: vale o que deixar mais barato. Vídeos de
          bônus somam com tudo. Na assinatura, o desconto vale só na 1ª mensalidade. Cobrança mínima: R$ 5,00.
        </p>
        {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-foreground" : "text-brand-ink"}`}>{msg.text}</p>}
        <button disabled={busy} className="rounded-xl bg-accent py-3 font-black text-white hover:bg-accent-dark disabled:opacity-50">
          {busy ? "Criando…" : "Criar cupom"}
        </button>
      </form>

      <div className="grid gap-2 rounded-2xl bg-surface p-5 ring-1 ring-foreground/10">
        <h2 className="text-lg font-black">Cupons ({list.length})</h2>
        {list.length === 0 && <p className="text-sm text-foreground/60">Nenhum cupom criado ainda.</p>}
        <ul className="grid gap-2">
          {list.map((c) => {
            const expired = c.expires_at && new Date(c.expires_at).getTime() < now;
            return (
              <li key={c.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 p-3 ${c.active && !expired ? "" : "opacity-60"}`}>
                <div className="min-w-0">
                  <p className="font-black">
                    {c.code} <span className="font-semibold text-foreground/70">· {describe(c)}</span>
                  </p>
                  <p className="text-xs text-foreground/60">
                    {c.uses} uso{c.uses === 1 ? "" : "s"}
                    {c.max_uses ? ` de ${c.max_uses}` : ""}
                    {c.expires_at ? ` · até ${new Date(c.expires_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}
                    {expired ? " (vencido)" : ""}
                    {c.note ? ` · ${c.note}` : ""}
                  </p>
                </div>
                <span className="flex gap-2">
                  <button onClick={() => toggle(c)} className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm font-bold">
                    {c.active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => remove(c)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-bold text-red-700 hover:bg-red-50"
                  >
                    Excluir
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
