"use client";

import Link from "next/link";
import PlanPicker from "../plan-picker";
import { useState } from "react";
import { AFFILIATE_LATER_PERCENT, AFFILIATE_MAX_PURCHASES, CATALOG, PACKAGES, REFERRAL_DISCOUNT, SUBSCRIBER_VIP_VIDEOS, SUBSCRIPTION_OPTIONS, VIP_PRICE, brl, describeVipFeatures, includesVip, discounted, type ProductId } from "@/lib/pricing";

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
  vip: { active: boolean; until: string | null; canceled: boolean; admin: boolean; coupon?: boolean; combo?: boolean; quota: number | null; subscriber: boolean; grants: { features: string[]; until: string }[] };
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
  const [showComm, setShowComm] = useState(false);
  // Comissão em centavos inteiros (39,90 × 15% = 5,985 → R$ 5,99).
  const comm = (value: number, percent: number) => Math.round(Math.round(value * 100) * percent / 100) / 100;
  // Tabela de comissões: assinaturas primeiro, depois avulsos.
  const commissionRows = [
    ...SUBSCRIPTION_OPTIONS.map((x) => ({ id: x.id, label: `Assinatura ${(x.credits * 25).toLocaleString("pt-BR")} vídeos/mês`, value: CATALOG[x.id as ProductId].value })),
    ...PACKAGES.map((x) => ({ id: `pacote-${x.credits}`, label: `Avulso ${(x.credits * 25).toLocaleString("pt-BR")} vídeos`, value: x.value })),
  ];
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

  const [vipCanceled, setVipCanceled] = useState(p.vip.canceled);
  const [vipMsg, setVipMsg] = useState("");
  const [vipCode, setVipCode] = useState("");
  const [vipBusy, setVipBusy] = useState(false);
  async function redeemVip(e: React.FormEvent) {
    e.preventDefault();
    setVipBusy(true);
    const res = await fetch("/api/conta/vip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: vipCode }) });
    const j = await res.json().catch(() => ({}));
    setVipBusy(false);
    if (!res.ok) return setVipMsg(j.error || "Não deu para resgatar.");
    setVipMsg(`Cupom resgatado: ${describeVipFeatures(j.features)} até ${new Date(j.until).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`);
    setVipCode("");
    window.location.reload();
  }
  async function cancelVip() {
    const aviso = p.vip.combo
      ? "Seu VIP está junto com a assinatura de vídeos. Cancelar encerra a assinatura inteira (vídeos + VIP): você não será cobrado de novo, continua VIP até o fim do mês já pago e o saldo de vídeos que já tem fica na conta. Cancelar?"
      : "Cancelar o VIP? Você continua VIP até o fim do mês já pago e não será cobrado de novo.";
    if (!window.confirm(aviso)) return;
    const res = await fetch("/api/conta/vip", { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setVipCanceled(true);
    setVipMsg(res.ok ? "VIP cancelado. Você não será cobrado de novo." : j.error || "Não deu para cancelar.");
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
  const card = "rounded-2xl bg-surface p-5 ring-1 ring-foreground/10";
  const [savedName, setSavedName] = useState(p.name);
  const [nameMsg, setNameMsg] = useState("");
  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/conta/nome", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setNameMsg(j.error || "Não deu para salvar.");
    setSavedName(j.name);
    window.location.reload();
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{savedName ? `Olá, ${savedName.split(" ")[0]}!` : "Minha conta"}</h1>
          <p className="text-sm text-foreground/60">{p.email}</p>
        </div>
        <div className="flex items-center gap-4">
          {p.admin && (
            <Link href="/admin" className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-bold text-background">
              Área do administrador
            </Link>
          )}
          <button onClick={logout} className="rounded-lg border border-foreground/20 px-3 py-1.5 text-sm font-bold text-foreground/70 hover:bg-foreground/5">
            Sair
          </button>
        </div>
      </div>

      {!savedName && (
        <form id="nome" onSubmit={saveName} className={`${card} grid scroll-mt-24 gap-2 border-2 border-brand`}>
          <h2 className="text-lg font-black">Como podemos te chamar?</h2>
          <p className="text-sm text-foreground/60">Seu nome aparece no topo do site para você saber que está na sua conta.</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              aria-label="Seu nome"
              autoComplete="name"
              className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm"
            />
            <button className="rounded-lg bg-brand px-4 font-bold text-on-brand hover:bg-brand-dark">Salvar</button>
          </div>
          {nameMsg && <p className="text-sm text-brand-ink">{nameMsg}</p>}
        </form>
      )}

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

      <div id="vip" className={`${card} grid gap-2 scroll-mt-24 border-2 border-accent/40`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black">⭐ VIP · {brl(VIP_PRICE)}/mês</h2>
          {p.vip.active && <span className="rounded-full bg-accent px-3 py-1 text-xs font-black text-white">{p.vip.admin ? "VIP (admin)" : p.vip.coupon ? "VIP por cupom" : "VIP ativo"}</span>}
        </div>
        <p className="text-sm text-foreground/70">
          Libera em todos os vídeos: <b>música</b>, <b>textos no vídeo</b>, <b>cortar partes sem som</b>, <b>narração</b>, <b>legenda automática</b> e <b>transição suave</b>. E ainda
          inclui <b>25 vídeos + 2 grátis</b> no seu saldo a cada mês pago.
        </p>
        {p.vip.active && !p.vip.admin && p.vip.until && (
          <p className="text-sm">
            {p.vip.coupon ? "Liberado pelo cupom até " : vipCanceled ? "Cancelado: continua VIP até " : "Próxima renovação por volta de "}
            <b>{new Date(p.vip.until).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</b>.
          </p>
        )}
        {!p.vip.active && p.vip.subscriber && p.vip.quota !== null && (
          <p className="text-sm text-foreground/70">
            Como assinante mensal, você tem <b>{p.vip.quota} de {SUBSCRIBER_VIP_VIDEOS} vídeos VIP</b> este mês (renova todo dia 1º).
          </p>
        )}
        {!p.vip.active &&
          p.vip.grants.map((g, i) => (
            <p key={i} className="text-sm">
              🎟 Cupom: <b>{describeVipFeatures(g.features)}</b> liberado até{" "}
              <b>{new Date(g.until).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</b>.
            </p>
          ))}
        {vipMsg && <p className="text-sm text-brand-ink">{vipMsg}</p>}
        {!p.vip.admin && (!p.vip.active || vipCanceled || p.vip.coupon) && (
          <button
            type="button"
            onClick={() => {
              choose("vip");
              document.getElementById("comprar")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="justify-self-start rounded-xl bg-accent px-5 py-2.5 font-black text-white hover:bg-accent-dark"
          >
            {p.vip.active && !p.vip.coupon ? "Assinar VIP de novo" : `Quero ser VIP · ${brl(VIP_PRICE)}/mês`}
          </button>
        )}
        {!p.vip.admin && (
          <form onSubmit={redeemVip} className="flex max-w-sm gap-2">
            <input
              value={vipCode}
              onChange={(e) => setVipCode(e.target.value.toUpperCase())}
              placeholder="Tem um cupom VIP?"
              aria-label="Cupom VIP"
              className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-field px-3 py-1.5 text-sm"
            />
            <button disabled={vipBusy || !vipCode.trim()} className="rounded-lg border border-accent px-3 py-1.5 text-sm font-bold text-accent disabled:opacity-50">
              {vipBusy ? "…" : "Resgatar"}
            </button>
          </form>
        )}
        {p.vip.active && !p.vip.admin && !p.vip.coupon && !vipCanceled && (
          <button type="button" onClick={cancelVip} className="justify-self-start text-xs text-foreground/60 underline">
            {p.vip.combo ? "Cancelar assinatura (vídeos + VIP)" : "Cancelar VIP"}
          </button>
        )}
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
        <PlanPicker
          chosen={chosen?.replace(/-vip$/, "")}
          onChoose={(id) => choose(id as ProductId)}
          avulsos={PACKAGES.map((x) => {
            const id = `pacote-${x.credits}` as ProductId;
            return { id, videos: x.credits * 25, price: priceOf(id).now, full: priceOf(id).full, per: x.perBatch, tag: x.tag || (x.best ? "economia" : undefined) };
          })}
          mensais={SUBSCRIPTION_OPTIONS.map((x, i) => {
            const id = x.id as ProductId;
            return {
              id,
              videos: x.credits * 25,
              price: priceOf(id).now,
              full: priceOf(id).full,
              per: `${x.perBatch}${p.discount ? " · desconto no 1º mês" : ""}`,
              highlight: i === 0,
              tag: i === 0 ? "popular" : undefined,
            };
          })}
        />
        {chosen?.startsWith("assinatura") && !(p.vip.admin || (p.vip.active && !p.vip.coupon && !vipCanceled)) && (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={includesVip(chosen)}
              onChange={(e) => choose((chosen.replace(/-vip$/, "") + (e.target.checked ? "-vip" : "")) as ProductId)}
              className="h-4 w-4 shrink-0 accent-accent"
            />
            <span>
              <b>+ ⭐ VIP</b> por mais {brl(VIP_PRICE)}/mês, na mesma mensalidade: música, textos no vídeo, cortar silêncio, narração e legenda
              automática em todos os vídeos, e mais 25 vídeos por mês no saldo.
            </span>
          </label>
        )}
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
            <p className="text-sm font-semibold">
              nas {AFFILIATE_MAX_PURCHASES} primeiras compras de cada indicado, depois {AFFILIATE_LATER_PERCENT}% para sempre
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowComm((v) => !v)}
          className="justify-self-start rounded-lg border border-foreground/20 px-3 py-1.5 text-sm font-bold"
        >
          {showComm ? "Fechar comissões" : "💰 Comissões: veja quanto você ganha"}
        </button>
        {showComm && (
          <div className="grid gap-2 rounded-xl bg-foreground/5 p-3">
            <p className="text-xs text-foreground/70">
              Você ganha <b>{p.affiliatePercent}%</b> nas {AFFILIATE_MAX_PURCHASES} primeiras compras de cada pessoa que indicar e{" "}
              <b>{AFFILIATE_LATER_PERCENT}% em todas as compras seguintes, para sempre</b>, inclusive em cada mensalidade da assinatura.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-foreground/60">
                    <th className="py-1 pr-2 font-semibold">Plano</th>
                    <th className="py-1 pr-2 font-semibold">Preço</th>
                    <th className="py-1 pr-2 font-semibold">3 primeiras ({p.affiliatePercent}%)</th>
                    <th className="py-1 font-semibold">Depois ({AFFILIATE_LATER_PERCENT}%)</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionRows.map((r) => (
                    <tr key={r.id} className="border-t border-foreground/10">
                      <td className="py-1 pr-2">{r.label}</td>
                      <td className="whitespace-nowrap py-1 pr-2">{brl(r.value)}</td>
                      <td className="whitespace-nowrap py-1 pr-2 font-bold">{brl(comm(r.value, p.affiliatePercent))}</td>
                      <td className="whitespace-nowrap py-1 font-bold">{brl(comm(r.value, AFFILIATE_LATER_PERCENT))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-foreground/50">
              Exemplo: alguém assina o plano de 1.150 vídeos pelo seu link. Você recebe {brl(comm(99.99, p.affiliatePercent))} em cada uma das 3
              primeiras mensalidades e {brl(comm(99.99, AFFILIATE_LATER_PERCENT))} todo mês depois disso. Na 1ª compra o indicado tem{" "}
              {REFERRAL_DISCOUNT}% de desconto, e a comissão é sobre o valor pago.
            </p>
          </div>
        )}
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
        {!savedWallet && (
          <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-accent/10 px-3 py-2">
            <p className="min-w-0 flex-1 text-xs text-foreground/70">
              Para receber, você precisa de uma conta no Asaas (é grátis). Depois, cole aqui o seu Wallet ID.
            </p>
            <a
              href="https://www.asaas.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-dark"
            >
              Abrir conta no Asaas ↗
            </a>
          </div>
        )}
        <details className="rounded-lg border border-foreground/10 px-3 py-2 text-xs text-foreground/70">
          <summary className="cursor-pointer font-semibold text-foreground">Onde acho o Wallet ID?</summary>
          <p className="mt-2">
            O aplicativo do Asaas não mostra o Wallet ID. Use o <b>site</b> do Asaas (pode ser no navegador do
            celular):
          </p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>
              Ainda não tem conta? Crie grátis em{" "}
              <a href="https://www.asaas.com/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                asaas.com
              </a>
              .
            </li>
            <li>
              Entre em{" "}
              <a href="https://www.asaas.com/login" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                asaas.com/login
              </a>{" "}
              com seu e-mail e senha (no celular, se abrir o app, escolha continuar no navegador).
            </li>
            <li>
              Toque no seu nome ou ícone de perfil, no alto, e abra <b>Minha conta</b> → <b>Integrações</b>.
            </li>
            <li>
              Procure <b>Wallet ID</b> e copie o código. Ele é parecido com{" "}
              <span className="font-mono break-all">a1b2c3d4-e5f6-7890-abcd-ef1234567890</span>.
            </li>
            <li>Volte aqui, cole no campo abaixo e toque em <b>Salvar</b>.</li>
          </ol>
          <p className="mt-2">
            Não achou? No app do Asaas, toque em <b>Fale com a gente</b> e peça o seu &quot;Wallet ID&quot;.
          </p>
          <p className="mt-2">Atenção: o Wallet ID não é a chave Pix nem a chave de API.</p>
        </details>
        <div className="flex gap-2">
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Cole aqui seu Wallet ID do Asaas"
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
