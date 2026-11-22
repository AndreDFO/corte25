"use client";

import { useEffect, useRef, useState } from "react";
import type { Variation } from "@/lib/jobs";

// Gravar narração: o vídeo roda SEM som e a pessoa fala junto pelo microfone.
// Depois pode ouvir, regravar ou salvar. O servidor troca o áudio do vídeo pela voz.

type Phase = "idle" | "asking" | "count" | "rec" | "review" | "saving" | "error";

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"])
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  return "";
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function Narrator({
  id,
  v,
  onClose,
  onSaved,
}: {
  id: string;
  v: Variation;
  onClose: () => void;
  onSaved: (v: Variation) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const t0 = useRef(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(3);
  const [clock, setClock] = useState(0);
  const [msg, setMsg] = useState("");
  const [take, setTake] = useState<{ blob: Blob; url: string; offset: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const src = `/api/jobs/${id}/files/${v.file}`;

  const stopMic = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      try {
        if (recRef.current?.state === "recording") recRef.current.stop();
      } catch {}
      stopMic();
    };
  }, []);

  useEffect(
    () => () => {
      if (take) URL.revokeObjectURL(take.url);
    },
    [take],
  );

  async function start() {
    setMsg("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase("error");
      setMsg("Este navegador não grava áudio. No iPhone use o Safari atualizado; no Android, o Chrome.");
      return;
    }
    setPhase("asking");
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setPhase("error");
      setMsg("Não consegui usar o microfone. Libere o microfone para o corte25.com.br nas configurações do navegador e tente de novo.");
      return;
    }
    const video = videoRef.current!;
    video.pause();
    video.muted = true;
    video.currentTime = 0;
    for (let i = 3; i > 0; i--) {
      setCount(i);
      setPhase("count");
      await new Promise((r) => setTimeout(r, 800));
    }

    const mime = pickMime();
    let videoStart = 0;
    const rec = new MediaRecorder(streamRef.current!, mime ? { mimeType: mime } : undefined);
    recRef.current = rec;
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      stopMic();
      const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
      setTake((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { blob, url: URL.createObjectURL(blob), offset: Math.max(0, videoStart - t0.current) };
      });
      setPhase("review");
    };
    await new Promise<void>((resolve) => {
      rec.onstart = () => resolve();
      rec.start(250);
      setTimeout(resolve, 600); // alguns navegadores não avisam o início
    });
    t0.current = performance.now();
    video.onplaying = () => {
      if (!videoStart) videoStart = performance.now();
    };
    video.onended = () => rec.state === "recording" && rec.stop();
    setPhase("rec");
    setClock(0);
    try {
      await video.play();
    } catch {
      rec.stop();
      setPhase("error");
      setMsg("O vídeo não começou a tocar. Toque em Gravar de novo.");
      return;
    }
    if (!videoStart) videoStart = performance.now();
  }

  // Relógio da gravação
  useEffect(() => {
    if (phase !== "rec") return;
    const t = setInterval(() => setClock(videoRef.current?.currentTime ?? 0), 250);
    return () => clearInterval(t);
  }, [phase]);

  function stop() {
    videoRef.current?.pause();
    if (recRef.current?.state === "recording") recRef.current.stop();
  }

  async function listen() {
    const video = videoRef.current!;
    const audio = audioRef.current!;
    if (!take) return;
    if (playing) {
      video.pause();
      audio.pause();
      setPlaying(false);
      return;
    }
    video.muted = true;
    video.currentTime = 0;
    audio.currentTime = take.offset / 1000;
    video.onended = () => {
      audio.pause();
      setPlaying(false);
    };
    setPlaying(true);
    try {
      await Promise.all([audio.play(), video.play()]);
    } catch {
      setPlaying(false);
    }
  }

  async function save() {
    if (!take) return;
    videoRef.current?.pause();
    audioRef.current?.pause();
    setPlaying(false);
    setPhase("saving");
    const fd = new FormData();
    fd.append("index", String(v.index));
    fd.append("offset", String(Math.round(take.offset)));
    const ext = take.blob.type.includes("mp4") ? "m4a" : take.blob.type.includes("ogg") ? "ogg" : "webm";
    fd.append("audio", take.blob, `narracao.${ext}`);
    try {
      const res = await fetch(`/api/jobs/${id}/narracao`, { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Falhou ao salvar.");
      onSaved(j.variation);
    } catch (e) {
      setPhase("review");
      setMsg(e instanceof Error ? e.message : "Falhou ao salvar. Tente de novo.");
    }
  }

  async function removeIt() {
    setPhase("saving");
    const res = await fetch(`/api/jobs/${id}/narracao?index=${v.index}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) onSaved(j.variation);
    else {
      setPhase("idle");
      setMsg(j.error || "Falhou. Tente de novo.");
    }
  }

  const busy = phase === "asking" || phase === "count" || phase === "rec" || phase === "saving";
  const btn = "rounded-full px-4 py-2 text-sm font-black disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-black/90 p-3 text-white" role="dialog" aria-label="Gravar narração">
      <div className="flex w-full max-w-sm items-center justify-between">
        <p className="text-sm font-bold">🎙 Narrar vídeo #{v.index + 1}</p>
        <button type="button" onClick={onClose} disabled={phase === "saving"} className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
          Fechar
        </button>
      </div>

      <div className="relative aspect-[9/16] max-h-[68dvh] w-auto overflow-hidden rounded-xl bg-black" style={{ height: "68dvh" }}>
        <video ref={videoRef} src={src} muted playsInline preload="auto" className="h-full w-full object-contain" />
        {phase === "count" && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 text-7xl font-black">{count}</div>
        )}
        {phase === "rec" && (
          <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-black">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> GRAVANDO {fmt(clock)}
          </span>
        )}
        {phase === "saving" && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-bold">Juntando a voz ao vídeo…</div>
        )}
      </div>
      {take && <audio ref={audioRef} src={take.url} preload="auto" className="hidden" />}

      <p className="max-w-sm text-center text-[11px] leading-snug text-white/70">
        {phase === "rec"
          ? "Fale junto com o vídeo. Ele para sozinho no fim."
          : phase === "review"
            ? "Ouça como ficou. Se não gostar, grave de novo."
            : "O som original sai e fica só a sua voz. Use fone com microfone para ficar mais limpo."}
      </p>
      {msg && <p className="max-w-sm text-center text-xs font-bold text-red-300">{msg}</p>}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {phase === "rec" ? (
          <button type="button" onClick={stop} className={`${btn} bg-red-600`}>
            ■ Parar
          </button>
        ) : phase === "review" || (phase === "saving" && take) ? (
          <>
            <button type="button" onClick={listen} disabled={busy} className={`${btn} bg-white/15`}>
              {playing ? "❚❚ Pausar" : "▶ Ouvir"}
            </button>
            <button type="button" onClick={start} disabled={busy} className={`${btn} bg-white/15`}>
              ↺ Regravar
            </button>
            <button type="button" onClick={save} disabled={busy} className={`${btn} bg-brand text-on-brand`}>
              ✓ Salvar
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={start} disabled={busy} className={`${btn} bg-red-600`}>
              {phase === "asking" ? "Liberando microfone…" : phase === "count" ? "Prepare-se…" : "● Gravar"}
            </button>
            {v.narrated && phase !== "count" && (
              <button type="button" onClick={removeIt} disabled={busy} className="text-xs text-white/70 underline">
                Apagar narração e voltar ao original
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
