"use client";

import { useEffect, useState } from "react";

// Navegador embutido do Instagram, TikTok, Facebook etc.: costuma apagar o login ao fechar o app.
// Mostra um aviso para abrir o site no Chrome ou no Safari.
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Bytedance|BytedanceWebview|Line\/|Snapchat|Pinterest/i;

export default function InAppBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(IN_APP.test(navigator.userAgent) && !sessionStorage.getItem("corte25_inapp_ok")), 0);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  const ios = /iPhone|iPad|iPod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "");
  return (
    <div className="bg-foreground px-4 py-2.5 text-center text-sm text-background">
      <b>Dica:</b> você está no navegador do app. Para não perder o login, toque em <b>⋯</b> e escolha{" "}
      <b>{ios ? "Abrir no Safari" : "Abrir no Chrome"}</b>.{" "}
      <button
        type="button"
        className="ml-1 underline opacity-70"
        onClick={() => {
          sessionStorage.setItem("corte25_inapp_ok", "1");
          setShow(false);
        }}
      >
        Fechar
      </button>
    </div>
  );
}
