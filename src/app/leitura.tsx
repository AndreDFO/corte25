"use client";

import { useEffect, useRef, useState } from "react";
import { WPS, contaPalavras, quebraFala, type Palavra } from "@/lib/fala";

// Leitura no ritmo da fala, usada pelo teleprompter (área Criadores) e pelo gravador do site.
// Contagem regressiva 3-2-1, depois a palavra da vez acende no ritmo escolhido; pausa (/) e fim
// de frase seguram um pouco mais.

export const RITMOS = [
  { nome: "Devagar", wps: 2.0 },
  { nome: "Normal", wps: WPS },
  { nome: "Rápido", wps: 3.0 },
];

export type EstadoLeitura = "parado" | "contagem" | "lendo" | "fim";

export function useLeitura(texto: string, wps: number) {
  const palavras = quebraFala(texto);
  const [estado, setEstado] = useState<EstadoLeitura>("parado");
  const [conta, setConta] = useState(3);
  const [idx, setIdx] = useState(-1);
  const [ms, setMs] = useState(0);
  const inicio = useRef(0);

  function parar() {
    setEstado("parado");
    setIdx(-1);
    setMs(0);
  }
  function iniciar() {
    setIdx(-1);
    setMs(0);
    setConta(3);
    setEstado("contagem");
  }

  useEffect(() => {
    if (estado !== "contagem") return;
    const t = setTimeout(() => {
      if (conta <= 1) {
        inicio.current = Date.now();
        setIdx(0);
        setEstado("lendo");
      } else setConta(conta - 1);
    }, 800);
    return () => clearTimeout(t);
  }, [estado, conta]);

  const n = palavras.length;
  const w = idx >= 0 ? palavras[idx] : undefined;
  const espera = 1000 / wps + (w?.pausa ? 350 : w?.fimFrase ? 250 : w && /,$/.test(w.t) ? 120 : 0);
  useEffect(() => {
    if (estado !== "lendo") return;
    const t = setTimeout(() => {
      if (idx + 1 >= n) setEstado("fim");
      setIdx(idx + 1);
    }, espera);
    return () => clearTimeout(t);
  }, [estado, idx, n, espera]);

  // Cronômetro: continua contando depois do fim (a pessoa pode estar gravando ainda).
  useEffect(() => {
    if (estado !== "lendo" && estado !== "fim") return;
    const t = setInterval(() => setMs(Date.now() - inicio.current), 100);
    return () => clearInterval(t);
  }, [estado]);

  return { palavras, estado, conta, idx, ms, iniciar, parar, alvo: Math.max(1, Math.round(contaPalavras(texto) / wps)) };
}

// O texto com a palavra da vez acesa. Rola sozinho para manter a palavra no terço de cima.
export function TextoLeitura({
  palavras,
  idx,
  estado,
  className = "",
  scroller,
}: {
  palavras: Palavra[];
  idx: number;
  estado: EstadoLeitura;
  className?: string;
  scroller: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    // Sem "return" aqui: no Chrome novo scrollTo devolve uma Promise, e o React acha que é a limpeza do efeito.
    if (idx < 0) {
      box.scrollTo({ top: 0 });
      return;
    }
    const el = box.querySelector<HTMLElement>(`[data-w="${idx}"]`);
    if (el) box.scrollTo({ top: Math.max(0, el.offsetTop - box.clientHeight * 0.3), behavior: "smooth" });
  }, [idx, scroller]);
  return (
    <p className={`relative font-bold leading-[1.3] ${className}`}>
      {palavras.map((w, i) => {
        const lida = (estado === "lendo" || estado === "fim") && i < idx;
        const agora = i === idx && estado === "lendo";
        return (
          <span key={i} data-w={i}>
            <span
              className={`rounded-md px-0.5 transition-colors ${agora ? "bg-white text-[#101106]" : lida ? "text-white/35" : w.enfase ? "text-[#c8f135]" : ""} ${w.enfase ? "underline decoration-[#c8f135] decoration-4 underline-offset-8" : ""}`}
            >
              {w.t}
            </span>
            {w.pausa && <span className="text-[#8b7bff]"> /</span>}{" "}
          </span>
        );
      })}
    </p>
  );
}

export function Contagem({ conta }: { conta: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/55">
      <span className="text-[140px] font-black leading-none text-[#c8f135] drop-shadow-lg">{conta}</span>
    </div>
  );
}

export function Cronometro({ ms, alvo }: { ms: number; alvo: number }) {
  const passou = ms / 1000 > alvo + 1;
  return (
    <span className={`rounded-lg px-2 py-1 font-mono text-base font-bold tabular-nums ${passou ? "bg-red-500/40 text-red-100" : "bg-white/15"}`}>
      {(ms / 1000).toFixed(1).replace(".", ",")}s<span className="text-white/50">/{alvo}s</span>
    </span>
  );
}
