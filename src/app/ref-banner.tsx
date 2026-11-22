"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REFERRAL_DISCOUNT } from "@/lib/pricing";

// Faixa para quem chegou pelo link de um afiliado (?ref= ou cookie corte25_ref): destaca o desconto.
export default function RefBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const has = new URLSearchParams(location.search).has("ref") || /(?:^|; )corte25_ref=/.test(document.cookie);
    const t = setTimeout(() => setShow(has), 0);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="bg-accent px-4 py-3 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
        <span className="text-2xl font-black sm:text-3xl">🎁 {REFERRAL_DISCOUNT}% OFF</span>
        <span className="text-sm font-semibold sm:text-base">Você foi indicado! Ganhe {REFERRAL_DISCOUNT}% de desconto na sua primeira compra.</span>
        <Link href="/entrar?modo=cadastrar&volta=/conta%23comprar" className="rounded-lg bg-white px-3 py-1.5 text-sm font-black text-accent-ink">
          Criar conta e usar o desconto
        </Link>
      </div>
    </div>
  );
}
