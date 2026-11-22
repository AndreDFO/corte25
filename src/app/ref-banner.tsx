"use client";

import { useEffect, useState } from "react";
import { REFERRAL_DISCOUNT } from "@/lib/pricing";

// Faixa para quem chegou pelo link de um afiliado (?ref= ou cookie corte25_ref): avisa do desconto.
export default function RefBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const has = new URLSearchParams(location.search).has("ref") || /(?:^|; )corte25_ref=/.test(document.cookie);
    const t = setTimeout(() => setShow(has), 0);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="bg-accent px-4 py-1.5 text-center text-xs font-bold text-white sm:text-sm">
      🎁 Você chegou por indicação: {REFERRAL_DISCOUNT}% de desconto na primeira compra ao criar sua conta.
    </div>
  );
}
