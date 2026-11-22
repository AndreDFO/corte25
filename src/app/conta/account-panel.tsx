"use client";

import Link from "next/link";
import { useState } from "react";
import { CATALOG, PACKAGES, SUBSCRIPTION, type ProductId } from "@/lib/pricing";

type Payment = { id: string; product: string; value: number; status: string; created_at: string };

const STATUS: Record<string, string> = {
  PENDING: "aguardando pagamento",
  CONFIRMED: "pago",
  RECEIVED: "pago",
  REFUNDED: "estornado",
};

export default function AccountPanel(p: {
  email: string;
  name: string;
  credits: number;
  refCode: string;
  hasWallet: boolean;
  hasCustomer: boolean;
  paymentsOn: boolean;
  buy: string | null;
  affiliatePercent: number;
  payments: Payment[];
  siteUrl: string;
}) {
  const [chosen, setChosen] = useState<ProductId | null>((p.buy as ProductId) || null);
  const [name, setName] = useState(p.name);
  const [doc, setDoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState("");
  const [walletMsg, setWalletMsg] = useState(p.hasWallet ? "Carteira cadastrada. Você recebe automaticamente." : "");
  const [copied, setCopied] = useState(false);
  const refLink = `${p.siteUrl}/?ref=${p.refCode}`;

  async function pay() {
    if (!chosen) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: chosen, name, cpfCnpj: doc }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Não deu certo, tente de novo.");
      window.location.href = j.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function saveWallet() {
    const res = await fetch("/api/conta/afiliado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletId: wallet }),
    });
    const j = await res.json().catch(() => ({}));
    setWalletMsg(res.ok ? "Carteira cadastrada. Você recebe automaticamente." : j.error);
  }

  async function logout() {
    await fetch("/api/conta/sair", { method: "POST" });
    window.location.href = "/";
  }

  const options: { id: ProductId; title: string; price: string; sub: string; accent?: boolean }[] = [
    { id: "assinatura", title: "Assinatura mensal", price: `${SUBSCRIPTION.price}/mês`, sub: `${SUBSCRIPTION.credits} lotes por mês · ${SUBSCRIPTION.perBatch}`, accent: true },
    ...PACKAGES.map((x) => ({ id: `pacote-${x.credits}` as ProductId, title: `${x.credits} lotes`, price: x.price, sub: x.perBatch })),
  ];
  const card = "rounded-2xl bg-surface p-5 ring-1 ring-foreground/10";

  return (
    <div className="mx-auto grid max-w-3xl gap-4 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Minha conta</h1>
          <p className="text-sm text-foreground/60">{p.email}</p>
        </div>
        <button onClick={logout} className="text-sm text-foreground/60 underline">
          Sair
        </button>
      </div>

      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className="text-sm text-foreground/60">Seu saldo</p>
          <p className="text-4xl font-black">
            {p.credits} <span className="text-lg font-bold text-foreground/60">lote{p.credits === 1 ? "" : "s"}</span>
          </p>
          <p className="text-xs text-foreground/50">Cada lote = 25 vídeos + 2 de bônus</p>
        </div>
        <Link href="/#criar" className="rounded-xl bg-brand px-5 py-3 font-black text-on-brand hover:bg-brand-dark">
          Gerar vídeos
        </Link>
      </div>

      <div id="comprar" className={`${card} grid gap-3`}>
        <h2 className="text-lg font-black">Comprar lotes</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setChosen(o.id)}
              className={`rounded-xl border p-3 text-left ${chosen === o.id ? "border-brand bg-brand/15 ring-2 ring-brand/40" : o.accent ? "border-accent bg-accent/10" : "border-foreground/15"}`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-bold">{o.title}</span>
                <span className="whitespace-nowrap font-extrabold">{o.price}</span>
              </span>
              <span className="block text-xs text-foreground/60">{o.sub}</span>
            </button>
          ))}
        </div>
        {chosen && !p.hasCustomer && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              aria-label="Nome completo"
              className="rounded-lg bg-field border border-foreground/15 px-3 py-2 text-sm"
            />
            <input
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              inputMode="numeric"
              placeholder="CPF ou CNPJ (para a cobrança)"
              aria-label="CPF ou CNPJ"
              className="rounded-lg bg-field border border-foreground/15 px-3 py-2 text-sm"
            />
          </div>
        )}
        {error && <p className="text-sm text-brand-ink">{error}</p>}
        {p.paymentsOn ? (
          <button
            disabled={!chosen || busy}
            onClick={pay}
            className="rounded-xl bg-accent py-3 font-black text-white hover:bg-accent-dark disabled:opacity-50"
          >
            {busy ? "Gerando cobrança…" : chosen ? `Pagar ${CATALOG[chosen].label}` : "Escolha uma opção"}
          </button>
        ) : (
          <p className="rounded-lg bg-foreground/5 px-3 py-2 text-sm text-foreground/60">O pagamento entra no ar em breve.</p>
        )}
        <p className="text-xs text-foreground/50">
          Você paga por Pix, cartão ou boleto na página segura do Asaas. Os lotes entram aqui assim que o pagamento é confirmado.
        </p>
      </div>

      <div className={`${card} grid gap-2`}>
        <h2 className="text-lg font-black">Indique e ganhe {p.affiliatePercent}%</h2>
        <p className="text-sm text-foreground/70">
          Quem criar conta pelo seu link vira sua indicação. Você recebe {p.affiliatePercent}% de tudo que essa pessoa pagar,
          direto na sua conta do Asaas, sem pedir saque.
        </p>
        <div className="flex gap-2">
          <input readOnly value={refLink} aria-label="Seu link de indicação" className="min-w-0 flex-1 rounded-lg bg-field border border-foreground/15 px-3 py-2 text-sm" />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(refLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded-lg bg-foreground/10 px-3 text-sm font-semibold"
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <p className="mt-1 text-xs text-foreground/60">
          Para receber, informe o ID da sua carteira do Asaas (no app do Asaas: Minha conta → Integrações → Carteira).
        </p>
        <div className="flex gap-2">
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="ID da carteira (walletId)"
            aria-label="ID da carteira do Asaas"
            className="min-w-0 flex-1 rounded-lg bg-field border border-foreground/15 px-3 py-2 text-sm"
          />
          <button type="button" onClick={saveWallet} className="rounded-lg bg-brand px-3 text-sm font-bold text-on-brand">
            Salvar
          </button>
        </div>
        {walletMsg && <p className="text-xs text-foreground/70">{walletMsg}</p>}
      </div>

      {p.payments.length > 0 && (
        <div className={card}>
          <h2 className="mb-2 text-lg font-black">Compras</h2>
          <ul className="grid gap-1 text-sm">
            {p.payments.map((x) => (
              <li key={x.id} className="flex justify-between gap-2">
                <span>
                  {CATALOG[x.product as ProductId]?.label ?? x.product} ·{" "}
                  {new Date(x.created_at).toLocaleDateString("pt-BR")}
                </span>
                <span className="text-foreground/60">
                  R$ {Number(x.value).toFixed(2).replace(".", ",")} · {STATUS[x.status] ?? x.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
