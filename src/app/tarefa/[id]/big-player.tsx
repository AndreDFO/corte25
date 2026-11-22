"use client";

import { useEffect, useRef, useState } from "react";

// Tela grande da prévia com controles PRÓPRIOS, sempre visíveis (pedido do Andre):
// a barra de tempo nunca some; só o botão de play/pause some enquanto o vídeo toca.
// (Os controles nativos do celular em tela cheia somem sozinhos.)

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

export default function BigPlayer({ src, title, startAt, onClose }: { src: string; title: string; startAt: number; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(true);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onClose = () => closeRef.current();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // No Android/PC some também a barra do navegador; no iPhone fica como tela grande na página.
    boxRef.current?.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onFs = () => !document.fullscreenElement && onClose();
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const seek = (s: number) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(dur || v.duration || 0, s));
    setT(v.currentTime);
  };

  return (
    <div ref={boxRef} className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-label={title}>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="truncate text-sm font-bold">{title}</p>
        <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
          ✕ Fechar
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <video
          ref={ref}
          src={src}
          playsInline
          loop
          autoPlay
          muted={muted}
          preload="auto"
          onLoadedMetadata={(e) => {
            setDur(e.currentTarget.duration);
            if (startAt > 0) e.currentTarget.currentTime = startAt;
          }}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onEnded={() => setPaused(true)}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onClick={toggle}
          className="h-full w-full object-contain"
        />
        {paused && (
          <button
            type="button"
            aria-label="Tocar"
            onClick={toggle}
            className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 ring-2 ring-white/80"
          >
            <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          </button>
        )}
      </div>

      {/* Barra sempre visível */}
      <div className="flex items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <button type="button" onClick={toggle} aria-label={paused ? "Tocar" : "Pausar"} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15">
          {paused ? (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
          )}
        </button>
        <button type="button" onClick={() => seek(t - 5)} className="shrink-0 rounded-full bg-white/15 px-2 py-1 text-[11px] font-bold">
          −5s
        </button>
        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums">{fmt(t)}</span>
        <input
          type="range"
          min={0}
          max={dur || 0}
          step={0.05}
          value={Math.min(t, dur || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Tempo do vídeo"
          className="h-6 min-w-0 flex-1 accent-[#c8f135]"
        />
        <span className="w-9 shrink-0 text-[11px] tabular-nums">{fmt(dur)}</span>
        <button type="button" onClick={() => seek(t + 5)} className="shrink-0 rounded-full bg-white/15 px-2 py-1 text-[11px] font-bold">
          +5s
        </button>
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Ligar som" : "Tirar som"} className="shrink-0 text-base">
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
    </div>
  );
}
