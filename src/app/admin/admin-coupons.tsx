"use client";

import Link from "next/link";
import { useState } from "react";
import type { Coupon, CouponKind } from "@/lib/coupons";
import { VIP_FEATURE_LIST, describeVipFeatures } from "@/lib/pricing";

const KINDS: { id: CouponKind; label: string; hint: string }[] = [
  { id: "percent", label: "% de desconto", hint: "Ex.: 20 = 20% off" },
  { id: "fixed", label: "R$ de desconto", hint: "Ex.: 5 = R$ 5,00 off" },
  { id: "videos", label: "Vídeos de bônus", hint: "Ex.: 25 = +25 vídeos" },
  { id: "vip", label: "⭐ Recursos VIP", hint: "Ex.: 30 = 30 dias" },
];

function describe(c: Coupon) {
  const n = Number(c.amount);
  if (c.kind === "vip") return `⭐ ${describeVipFeatures(c.features)} por ${n} dia${n === 1 ? "" : "s"}`;
  if (c.kind === "percent") return `${n}% de desconto`;
  if (c.kind === "fixed") return `R$ ${n.toFixed(2).replace(".", ",")} de desconto`;
  return `+${n} vídeos de bônus`;
}

// Botãozinho de copiar o código do cupom.
function CopyCode({ code }: { code: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      title="Copiar código"
      aria-label={`Copiar código ${code}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          const t = document.createElement("textarea");
          t.value = code;
          document.body.appendChild(t);
          t.select();
          document.execCommand("copy");
          t.remove();
        }
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className={`ml-1 inline-flex items-center rounded-md border px-1.5 py-0.5 align-middle text-[11px] font-bold ${ok ? "border-brand bg-brand/20" : "border-foreground/15 text-foreground/60 hover:bg-foreground/5"}`}
    >
      {ok ? "✓ Copiado" : "📋 Copiar"}
    </button>
  );
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
  const [features, setFeatures] = useState<string[]>(["todos"]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  function startEdit(c: Coupon) {
    setEditing(c);
    setCode(c.code);
    setKind(c.kind);
    setAmount(String(Number(c.amount)).replace(".", ","));
    setMaxUses(c.max_uses ? String(c.max_uses) : "");
    setExpires(c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : "");
    setNote(c.note || "");
    setFeatures(c.features?.length ? c.features : ["todos"]);
    setMsg(null);
    document.getElementById("form-cupom")?.scrollIntoView({ behavior: "smooth" });
  }

  function clearForm() {
    setEditing(null);
    setCode("");
    setAmount("");
    setMaxUses("");
    setExpires("");
    setNote("");
    setFeatures(["todos"]);
  }
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/cupons", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing?.id, code, kind, amount, max_uses: maxUses, expires, note, features }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: j.error || "Não deu certo." });
    if (editing) {
      setList(list.map((x) => (x.id === j.coupon.id ? j.coupon : x)));
      setMsg({ ok: true, text: `Cupom ${j.coupon.code} atualizado.` });
    } else {
      setList([j.coupon, ...list]);
      setMsg({ ok: true, text: `Cupom ${j.coupon.code} criado.` });
    }
    clearForm();
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
          <button
            type="button"
            className="underline"
            onClick={async (e) => {
              if (!window.confirm("Liberar o teste grátis de novo para todo mundo? Quem já usou poderá testar outra vez.")) return;
              const b = e.currentTarget;
              const res = await fetch("/api/admin/testes", { method: "POST" });
              b.textContent = res.ok ? "Testes grátis liberados ✓" : "Falhou";
            }}
          >
            Zerar testes grátis
          </button>
          <Link href="/conta" className="text-foreground/60 underline">
            Voltar para a conta
          </Link>
        </div>
      </div>

      {children}

      <form id="form-cupom" onSubmit={create} className={`scroll-mt-20 grid gap-3 rounded-2xl bg-surface p-5 ring-1 ${editing ? "ring-2 ring-accent" : "ring-foreground/10"}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-black">{editing ? `Editar cupom ${editing.code}` : "Criar cupom"}</h2>
          {editing && (
            <button type="button" onClick={clearForm} className="text-sm text-foreground/60 underline">
              Cancelar edição
            </button>
          )}
        </div>
        {editing && editing.uses > 0 && (
          <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-foreground/70">
            Esse cupom já foi usado {editing.uses} vez{editing.uses === 1 ? "" : "es"}. A mudança vale só para as próximas compras; as
            vendas antigas e o relatório continuam com o valor da época. O código não muda.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex.: BLACK20" required readOnly={!!editing} className={`${field} ${editing ? "opacity-60" : ""}`} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-foreground/60">
            {kind === "vip" ? "Dias liberados (conta a partir do resgate)" : KINDS.find((k) => k.id === kind)!.label}
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
        {kind === "vip" && (
          <div className="grid gap-1.5 rounded-xl bg-accent/5 p-3 ring-1 ring-accent/20">
            <p className="text-xs font-semibold text-foreground/60">Quais recursos esse cupom libera?</p>
            <div className="flex flex-wrap gap-2">
              {[{ id: "todos", label: "Todos (VIP completo)" }, ...VIP_FEATURE_LIST].map((f) => {
                const on = f.id === "todos" ? features.includes("todos") : !features.includes("todos") && features.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      setFeatures(
                        f.id === "todos"
                          ? ["todos"]
                          : on
                            ? features.filter((x) => x !== f.id)
                            : [...features.filter((x) => x !== "todos"), f.id],
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${on ? "border-accent bg-accent text-white" : "border-foreground/15"}`}
                  >
                    {on ? "✓ " : ""}
                    {f.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-foreground/50">
              O cliente resgata em Minha conta, no quadro VIP. Os recursos valem em todos os vídeos durante os dias escolhidos. &quot;Todos&quot;
              também inclui recursos VIP que forem lançados depois.
            </p>
          </div>
        )}
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
          {busy ? "Salvando…" : editing ? "Salvar alterações" : "Criar cupom"}
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
                    {c.code} <CopyCode code={c.code} /> <span className="font-semibold text-foreground/70">· {describe(c)}</span>
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
                  <button onClick={() => startEdit(c)} className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm font-bold">
                    Editar
                  </button>
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
