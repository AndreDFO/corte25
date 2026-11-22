"use client";

import Link from "next/link";
import { useState } from "react";
import { AFFILIATE_MAX_PURCHASES, CATALOG, PACKAGES, REFERRAL_DISCOUNT, SUBSCRIPTION, brl, discounted, type ProductId } from "@/lib/pricing";

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
  walletId?: string; // carteira do Asaas já salva (só a própria pessoa vê)
  hasCustomer: boolean;
  paymentsOn: boolean;
  buy: string | null;
  paid?: boolean;
  affiliatePercent: number;
  affiliate: { referrals: number; sales: number; commission: number };
  discount: number; // % de desconto da indicação na primeira compra (0 = sem desconto)
  payments: Payment[];
  siteUrl: string;
  admin?: boolean; // só a conta do dono (ADMIN_EMAILS), conferido no servidor
}) {
  const [chosen, setChosen] = useState<ProductId | null>((p.buy as ProductId) || null);
  const [name, setName] = useState(p.name);
  const [doc, setDoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState(p.walletId || "");
  const [savedWallet, setSavedWallet] = useState(p.walletId || "");
  const [walletMsg, setWalletMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; msg: string; price: string; full: string | null; product: string } | null>(null);
  const [couponErr, setCouponErr] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const refLink = `${p.siteUrl}/?ref=${p.refCode}`;
  const shareText = `Use meu link e ganhe ${REFERRAL_DISCOUNT}% de desconto na primeira compra do Corte25 👉 ${refLink}`;

  async function pay() {
    if (!chosen) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: chosen, name, cpfCnpj: doc, coupon: coupon?.product === chosen ? coupon.code : undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Não deu certo, tente de novo.");
      window.location.href = j.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function applyCoupon(product = chosen, code = couponInput) {
    setCouponErr("");
    if (!product) return setCouponErr("Escolha um pacote primeiro.");
    if (!code.trim()) return;
    setCouponBusy(true);
    const res = await fetch("/api/cupom/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, product }),
    });
    const j = await res.json().catch(() => ({}));
    setCouponBusy(false);
    if (!res.ok) {
      setCoupon(null);
      return setCouponErr(j.error || "Cupom inválido.");
    }
    setCoupon({ code: j.code, msg: j.msg, price: j.price, full: j.full, product });
  }

  function choose(id: ProductId) {
    setChosen(id);
    // Cupom aplicado vale para o pacote escolhido: refaz a conta ao trocar.
    if (coupon) applyCoupon(id, coupon.code);
  }

  async function saveWallet() {
    const res = await fetch("/api/conta/afiliado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletId: wallet }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setSavedWallet(wallet.trim());
    setWalletMsg(res.ok ? "" : j.error);
  }

  async function logout() {
    await fetch("/api/conta/sair", { method: "POST" });
    try {
      localStorage.removeItem("corte25_jobs");
    } catch {}
    window.location.href = "/";
  }

  // Com desconto de indicação, mostra o preço cheio riscado e o novo preço (primeira compra).
  const priceOf = (id: ProductId) => {
    const full = CATALOG[id].value;
    return p.discount ? { full: brl(full), now: brl(discounted(full, p.discount)) } : { full: "", now: brl(full) };
  };
  const options: { id: ProductId; title: string; full: string; price: string; sub: string; accent?: boolean }[] = [
    {
      id: "assinatura",
      title: "Assinatura mensal",
      full: priceOf("assinatura").full,
      price: `${priceOf("assinatura").now}/mês`,
      sub: `${SUBSCRIPTION.credits * 25} vídeos por mês · ${SUBSCRIPTION.perBatch}${p.discount ? " · desconto no 1º mês" : ""}`,
      accent: true,
    },
    ...PACKAGES.map((x) => {
      const id = `pacote-${x.credits}` as ProductId;
      return { id, title: `${x.credits * 25} vídeos`, full: priceOf(id).full, price: priceOf(id).now, sub: x.perBatch };
    }),
  ];
  const card = "rounded-2xl bg-surface p-5 ring-1 ring-foreground/10";

  return (
    <div className="mx-auto grid max-w-3xl gap-4 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Minha conta</h1>
          <p className="text-sm text-foreground/60">{p.email}</p>
        </div>
        <div className="flex items-center gap-4">
          {p.admin && (
            <Link href="/admin" className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-bold text-background">
              Área do administrador
            </Link>
          )}
          <button onClick={logout} className="text-sm text-foreground/60 underline">
            Sair
          </button>
        </div>
      </div>

      {p.paid && (
        <div className="rounded-2xl bg-brand/20 p-4 text-sm font-semibold ring-1 ring-brand">
          Pagamento recebido, obrigado! Seus vídeos entram no saldo em instantes. Se ainda não aparecerem, atualize a página.
        </div>
      )}

      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className="text-sm text-foreground/60">Seu saldo</p>
          <p className="text-4xl font-black">
            {p.credits} <span className="text-lg font-bold text-foreground/60">vídeo{p.credits === 1 ? "" : "s"}</span>
          </p>
          <p className="text-xs text-foreground/50">Cada lote = 25 vídeos. Gere quantos quiser por vez; gerando 25 de uma vez, ganha +2 grátis.</p>
        </div>
        <Link href="/#criar" className="rounded-xl bg-brand px-5 py-3 font-black text-on-brand hover:bg-brand-dark">
          Gerar vídeos
        </Link>
      </div>

      <div id="comprar" className={`${card} grid gap-3`}>
        <h2 className="text-lg font-black">Comprar vídeos</h2>
        {p.discount > 0 && (
          <div className="rounded-xl bg-accent px-4 py-3 text-white">
            <p className="text-2xl font-black">🎁 {p.discount}% OFF</p>
            <p className="text-sm font-semibold">
              Você chegou por indicação: {p.discount}% de desconto na sua primeira compra, já aplicado nos preços abaixo.
            </p>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o.id)}
              className={`rounded-xl border p-3 text-left ${chosen === o.id ? "border-brand bg-brand/15 ring-2 ring-brand/40" : o.accent ? "border-accent bg-accent/10" : "border-foreground/15"}`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-bold">{o.title}</span>
                <span className="whitespace-nowrap font-extrabold">
                  {o.full && <s className="mr-1 text-xs font-semibold text-foreground/40">{o.full}</s>}
                  {o.price}
                </span>
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
        {p.paymentsOn &&
          (couponOpen ? (
            <div className="grid gap-1">
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                  placeholder="Código do cupom"
                  aria-label="Código do cupom"
                  className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={couponBusy}
                  onClick={() => applyCoupon()}
                  className="rounded-lg border border-foreground/20 px-4 text-sm font-bold disabled:opacity-50"
                >
                  {couponBusy ? "…" : "Aplicar"}
                </button>
              </div>
              {couponErr && <p className="text-xs font-semibold text-brand-ink">{couponErr}</p>}
              {coupon && coupon.product === chosen && (
                <p className="text-xs font-semibold">
                  ✅ {coupon.msg} Você paga {coupon.full && <s className="text-foreground/40">{coupon.full}</s>} {coupon.price}.{" "}
                  <button type="button" onClick={() => setCoupon(null)} className="text-foreground/50 underline">
                    remover
                  </button>
                </p>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => setCouponOpen(true)} className="justify-self-start text-xs text-foreground/50 underline">
              Tem um cupom?
            </button>
          ))}
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
          Você paga por Pix, cartão ou boleto na página segura do Asaas. Os vídeos entram no seu saldo assim que o pagamento é confirmado.
        </p>
      </div>

      <div className={`${card} grid gap-2`}>
        <h2 className="text-lg font-black">
          Indique: eles ganham {REFERRAL_DISCOUNT}%, você ganha {p.affiliatePercent}%
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-accent px-4 py-3 text-white">
            <p className="text-2xl font-black">🎁 {REFERRAL_DISCOUNT}% OFF</p>
            <p className="text-sm font-semibold">para quem você indicar, na primeira compra</p>
          </div>
          <div className="rounded-xl bg-brand px-4 py-3 text-on-brand">
            <p className="text-2xl font-black">💰 {p.affiliatePercent}% para você</p>
            <p className="text-sm font-semibold">nas {AFFILIATE_MAX_PURCHASES} primeiras compras de cada indicado</p>
          </div>
        </div>
        <p className="text-sm text-foreground/70">
          Quem criar conta pelo seu link vira sua indicação. A comissão cai direto na sua conta do Asaas, sem pedir saque.
        </p>
        <div className="grid gap-2 rounded-lg border border-dashed border-accent/60 bg-accent/10 px-3 py-2 text-sm">
          <p>
            <b>Texto para divulgar:</b> &quot;{shareText}&quot;
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(shareText);
              setCopiedText(true);
              setTimeout(() => setCopiedText(false), 1500);
            }}
            className="justify-self-start rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-dark"
          >
            {copiedText ? "Texto copiado!" : "Copiar texto"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Indicações", String(p.affiliate.referrals)],
            ["Compras", String(p.affiliate.sales)],
            ["Comissão", `R$ ${p.affiliate.commission.toFixed(2).replace(".", ",")}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-foreground/5 py-2">
              <p className="text-lg font-black">{v}</p>
              <p className="text-[11px] text-foreground/60">{k}</p>
            </div>
          ))}
        </div>
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
          <button
            type="button"
            onClick={saveWallet}
            disabled={Boolean(savedWallet) && wallet.trim() === savedWallet}
            className="rounded-lg bg-brand px-3 text-sm font-bold text-on-brand disabled:opacity-60"
          >
            {savedWallet && wallet.trim() === savedWallet ? "Salvo ✓" : "Salvar"}
          </button>
        </div>
        {savedWallet && wallet.trim() === savedWallet && (
          <p className="text-xs font-semibold text-foreground/70">✓ Carteira salva. Você recebe os {p.affiliatePercent}% automaticamente.</p>
        )}
        {walletMsg && <p className="text-xs text-brand-ink">{walletMsg}</p>}
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
