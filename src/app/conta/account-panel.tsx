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
  // Kit do afiliado: textos prontos com o link da pessoa (copiar ou mandar no WhatsApp).
  const kit = [
    {
      id: "convite",
      title: "Convite para outro vendedor",
      text: `Oi! Você vende no TikTok Shop? O Corte25 transforma poucos vídeos seus em 25 vídeos diferentes, prontos para postar, com gancho, corpo e chamada para comprar. Eu uso e recomendo. Dá para testar grátis e, pelo meu link, você ganha ${REFERRAL_DISCOUNT}% de desconto na primeira compra 👉 ${refLink}`,
    },
    {
      id: "ganhar",
      title: "Convite para ganhar dinheiro indicando",
      text: `Além de fazer 25 vídeos para TikTok Shop em minutos, o Corte25 paga ${p.affiliatePercent}% de comissão nas ${AFFILIATE_MAX_PURCHASES} primeiras compras de cada pessoa que você indicar e ${AFFILIATE_LATER_PERCENT}% para sempre depois, direto na sua conta do Asaas. Crie sua conta grátis, teste e comece a indicar 👉 ${refLink}`,
    },
    {
      id: "whatsapp",
      title: "WhatsApp (contatos e status)",
      text: `Descobri um site que faz 25 vídeos para TikTok Shop a partir de poucos vídeos meus, em minutos 🎬 Ficaram muito bons e dá para testar grátis. Com meu link tem ${REFERRAL_DISCOUNT}% de desconto na primeira compra: ${refLink}`,
    },
    {
      id: "tiktok",
      title: "Legenda para TikTok ou Instagram",
      text: `Gravei poucos vídeos e saíram 25 prontos para postar 😱 Quer saber como? O link está na bio, e com ele você tem ${REFERRAL_DISCOUNT}% de desconto. #tiktokshop #vendasonline #afiliados`,
    },
    {
      id: "grupo",
      title: "Post para grupo de vendedores",
      text: `Para quem vende no TikTok Shop e não tem tempo de editar: o Corte25 junta seus ganchos, corpos e chamadas e monta 25 vídeos diferentes de uma vez. Dá para testar grátis antes de pagar, e quem gosta ainda ganha comissão indicando. Link com ${REFERRAL_DISCOUNT}% de desconto na primeira compra: ${refLink}`,
    },
  ];
  const [copiedKit, setCopiedKit] = useState("");
  const [kitOpen, setKitOpen] = useState(false);
  const [allPayments, setAllPayments] = useState(false);

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
  // "Tenho um cupom": vídeos grátis ou VIP sem compra.
  const [freeCode, setFreeCode] = useState("");
  const [freeMsg, setFreeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [freeBusy, setFreeBusy] = useState(false);
  const [freeOpen, setFreeOpen] = useState(false);
  async function redeemFree(e: React.FormEvent) {
    e.preventDefault();
    setFreeBusy(true);
    setFreeMsg(null);
    const res = await fetch("/api/conta/cupom", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: freeCode }) });
    const j = await res.json().catch(() => ({}));
    setFreeBusy(false);
    if (!res.ok) return setFreeMsg({ ok: false, text: j.error || "Não deu para resgatar." });
    setFreeCode("");
    const until = j.until ? new Date(j.until).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
    setFreeMsg({
      ok: true,
      text: j.kind === "gratis" ? `🎉 Pronto! ${j.videos} vídeos grátis entraram no seu saldo.` : `🎉 Pronto! ${describeVipFeatures(j.features)} liberado até ${until}.`,
    });
    setTimeout(() => window.location.reload(), 1800);
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

      {(p.paid || p.payments.some((x) => x.status === "CONFIRMED" || x.status === "RECEIVED")) && !savedWallet && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent/15 p-4 ring-1 ring-accent">
          <div className="min-w-0 flex-1">
            <p className="font-black">💸 Ganhe dinheiro indicando o Corte25</p>
            <p className="text-sm text-foreground/70">
              Você ganha {p.affiliatePercent}% nas {AFFILIATE_MAX_PURCHASES} primeiras compras de cada pessoa que indicar e {AFFILIATE_LATER_PERCENT}% para sempre
              depois. Já tem textos prontos para mandar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setKitOpen(true);
              document.getElementById("afiliado")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="rounded-xl bg-accent px-5 py-2.5 font-black text-white hover:bg-accent-dark"
          >
            Quero ser afiliado
          </button>
        </div>
      )}

      <div className="grid gap-0.5 rounded-2xl bg-surface px-4 py-3 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-foreground/60">Seu saldo</p>
          {!freeOpen ? (
            <button
              id="cupom"
              type="button"
              onClick={() => setFreeOpen(true)}
              className="scroll-mt-24 whitespace-nowrap rounded-lg border-2 border-accent bg-accent/10 px-2.5 py-0.5 text-sm font-bold text-accent hover:bg-accent/20"
            >
              🎟 Tenho um cupom
            </button>
          ) : (
            <form id="cupom" onSubmit={redeemFree} className="flex w-full scroll-mt-24 gap-2 sm:w-80">
              <input
                autoFocus
                value={freeCode}
                onChange={(e) => setFreeCode(e.target.value.toUpperCase())}
                placeholder="Código do cupom"
                aria-label="Código do cupom"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border-2 border-accent/60 bg-field px-3 py-1 text-sm"
              />
              <button disabled={freeBusy || !freeCode.trim()} className="rounded-lg bg-accent px-4 text-sm font-bold text-white hover:bg-accent-dark disabled:opacity-50">
                {freeBusy ? "…" : "Resgatar"}
              </button>
            </form>
          )}
        </div>
        {freeMsg && <p className={`text-sm font-semibold sm:text-right ${freeMsg.ok ? "text-foreground" : "text-brand-ink"}`}>{freeMsg.text}</p>}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl font-black leading-none">
              {p.credits} <span className="text-base font-bold text-foreground/60">vídeo{p.credits === 1 ? "" : "s"}</span>
            </p>
            <p className="mt-1 whitespace-nowrap text-[11px] leading-tight text-foreground/50">Gerando 25: +2 grátis</p>
          </div>
          <Link href="/#criar" className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-black text-on-brand hover:bg-brand-dark">
            Gerar vídeos
          </Link>
        </div>
      </div>


      <div id="vip" className="grid scroll-mt-24 gap-1 rounded-2xl border-2 border-accent/40 bg-surface px-4 py-3.5 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-foreground/60">⭐ Plano VIP</p>
          {p.vip.active ? (
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-black text-white">{p.vip.admin ? "VIP (admin)" : p.vip.coupon ? "VIP por cupom" : "VIP ativo"}</span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setFreeOpen(true);
                document.getElementById("cupom")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="whitespace-nowrap text-xs font-semibold text-accent underline"
            >
              Tem cupom VIP?
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl font-black leading-none">
              {brl(VIP_PRICE)} <span className="text-base font-bold text-foreground/60">/mês</span>
            </p>
          </div>
          {!p.vip.admin && (!p.vip.active || vipCanceled || p.vip.coupon) && (
            <button
              type="button"
              onClick={() => {
                choose("vip");
                document.getElementById("comprar")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-black text-white hover:bg-accent-dark"
            >
              {p.vip.active && !p.vip.coupon ? "Assinar de novo" : "Quero ser VIP"}
            </button>
          )}
        </div>
        <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs leading-snug text-foreground/60">
          {["Música", "Legenda automática", "Textos no vídeo", "Cortar partes sem som", "Narração", "Transição suave"].map((f) => (
            <span key={f} className="whitespace-nowrap">✓ {f}</span>
          ))}
          <b className="whitespace-nowrap text-foreground/80">✓ +25 vídeos (+2 grátis) por mês</b>
        </p>
        {p.vip.active && !p.vip.admin && p.vip.until && (
          <p className="mt-1 text-xs">
            {p.vip.coupon ? "Liberado pelo cupom até " : vipCanceled ? "Cancelado: continua VIP até " : "Próxima renovação por volta de "}
            <b>{new Date(p.vip.until).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</b>.
          </p>
        )}
        {!p.vip.active && p.vip.subscriber && p.vip.quota !== null && (
          <p className="mt-1 text-xs text-foreground/70">
            Como assinante, você tem <b>{p.vip.quota} de {SUBSCRIBER_VIP_VIDEOS} vídeos VIP</b> este mês (renova todo dia 1º).
          </p>
        )}
        {!p.vip.active &&
          p.vip.grants.map((g, i) => (
            <p key={i} className="mt-1 text-xs">
              🎟 Cupom: <b>{describeVipFeatures(g.features)}</b> até{" "}
              <b>{new Date(g.until).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</b>.
            </p>
          ))}
        {vipMsg && <p className="mt-1 text-xs text-brand-ink">{vipMsg}</p>}
        {p.vip.active && !p.vip.admin && !p.vip.coupon && !vipCanceled && (
          <button type="button" onClick={cancelVip} className="mt-1 justify-self-start text-xs text-foreground/60 underline">
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

      <div id="afiliado" className="grid scroll-mt-24 gap-2 rounded-2xl bg-surface px-4 py-3.5 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-foreground/60">💸 Indique e ganhe</p>
          <p className="text-xs">
            <span className="rounded-full bg-accent px-2 py-0.5 font-black text-white">{REFERRAL_DISCOUNT}% OFF para eles</span>{" "}
            <span className="rounded-full bg-brand px-2 py-0.5 font-black text-on-brand">{p.affiliatePercent}% para você</span>
          </p>
        </div>
        <p className="text-xs leading-snug text-foreground/60">
          {p.affiliatePercent}% nas {AFFILIATE_MAX_PURCHASES} primeiras compras de cada indicado e {AFFILIATE_LATER_PERCENT}% para sempre depois. Cai direto na sua conta do Asaas.
        </p>
        <div className="flex gap-2">
          <input readOnly value={refLink} aria-label="Seu link de indicação" className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-field px-3 py-1.5 text-sm" />
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/60">
          <span><b className="text-sm text-foreground">{p.affiliate.referrals}</b> indicações</span>
          <span><b className="text-sm text-foreground">{p.affiliate.sales}</b> compras</span>
          <span><b className="text-sm text-foreground">R$ {p.affiliate.commission.toFixed(2).replace(".", ",")}</b> de comissão</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setKitOpen((v) => !v)}
            className={`rounded-lg border-2 border-accent px-3 py-1 text-sm font-bold ${kitOpen ? "bg-accent text-white" : "bg-accent/10 text-accent"}`}
          >
            🧰 {kitOpen ? "Fechar kit" : "Textos prontos"}
          </button>
          <button
            type="button"
            onClick={() => setShowComm((v) => !v)}
            className="rounded-lg border-2 border-foreground/15 px-3 py-1 text-sm font-bold"
          >
            💰 {showComm ? "Fechar" : "Quanto ganho?"}
          </button>
        </div>
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
        {kitOpen && (
          <div className="grid gap-2 rounded-lg border border-dashed border-accent/60 bg-accent/10 px-3 py-2 text-sm">
            <>
              {kit.map((k) => (
                <div key={k.id} className="grid gap-1.5 rounded-lg bg-background/70 px-3 py-2">
                  <p className="text-xs font-bold text-foreground/70">{k.title}</p>
                  <p className="text-xs">{k.text}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(k.text);
                        setCopiedKit(k.id);
                        setTimeout(() => setCopiedKit(""), 1500);
                      }}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-dark"
                    >
                      {copiedKit === k.id ? "Copiado!" : "Copiar"}
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(k.text)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-[#25d366] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Mandar no WhatsApp
                    </a>
                  </div>
                </div>
              ))}
              <div className="grid gap-1 rounded-lg bg-background/70 px-3 py-2 text-xs">
                <p className="font-bold text-foreground/70">🎬 Vídeos para mostrar</p>
                <p>
                  Os melhores vídeos de divulgação são os que o Corte25 fez para você. Abra{" "}
                  <Link href="/meus-videos" className="font-semibold underline">Meus vídeos</Link>, baixe 2 ou 3 e poste com a legenda
                  acima. Mostre o antes (poucos vídeos) e o depois (25 prontos).
                </p>
              </div>
              <div className="grid gap-1 rounded-lg bg-background/70 px-3 py-2 text-xs">
                <p className="font-bold text-foreground/70">📍 Onde divulgar</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  <li>Grupos de WhatsApp, Telegram e Facebook de vendedores e afiliados do TikTok Shop.</li>
                  <li>Comentários e mensagens para quem vende no TikTok Shop e posta pouco.</li>
                  <li>Seu status do WhatsApp e a bio do seu TikTok ou Instagram.</li>
                </ul>
                <p className="text-foreground/60">Dica: sem spam. Uma mensagem por grupo e responda as dúvidas, isso vende mais.</p>
              </div>
            </>
          </div>
        )}
        {!savedWallet && (
          <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs leading-snug text-foreground/70">
            Para receber, crie uma conta grátis no{" "}
            <a href="https://www.asaas.com/" target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline">
              Asaas ↗
            </a>{" "}
            e cole aqui o seu Wallet ID. <b>Ele só aparece no site do Asaas, pelo navegador (no app não aparece).</b>
          </p>
        )}
        <details className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs text-foreground/70">
          <summary className="cursor-pointer font-semibold text-foreground">Onde acho o Wallet ID?</summary>
          <p className="mt-2 rounded-md border border-amber-400 bg-amber-100 px-2 py-1.5 font-bold text-amber-900">
            ⚠ O Wallet ID NÃO aparece no aplicativo do Asaas. Ele só aparece no site: abra <u>asaas.com</u> no
            navegador (Chrome, Safari...), mesmo no celular.
          </p>
          <p className="mt-2">Passo a passo no navegador:</p>
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
              com seu e-mail e senha. No celular, se o app abrir sozinho, feche e use o navegador.
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
            className="min-w-0 flex-1 rounded-lg bg-field border border-foreground/15 px-3 py-1.5 text-sm"
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
        <div className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-foreground/10">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs text-foreground/60">🧾 Suas compras</p>
            {p.payments.length > 3 && (
              <button type="button" onClick={() => setAllPayments((v) => !v)} className="text-xs font-semibold text-accent underline">
                {allPayments ? "Ver menos" : `Ver todas (${p.payments.length})`}
              </button>
            )}
          </div>
          <ul className="grid divide-y divide-foreground/5 text-xs">
            {(allPayments ? p.payments : p.payments.slice(0, 3)).map((x) => (
              <li key={x.id} className="flex justify-between gap-2 py-1">
                <span className="min-w-0 truncate">
                  {CATALOG[x.product as ProductId]?.label ?? x.product} · {new Date(x.created_at).toLocaleDateString("pt-BR")}
                </span>
                <span className="shrink-0 text-foreground/60">
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
