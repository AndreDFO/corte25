"use client";

import { useEffect, useRef, useState } from "react";
import DicasPostagem from "../../dicas-postagem";
import Link from "next/link";
import type { Job, Variation } from "@/lib/jobs";
import { rememberJob, timeLeft } from "@/lib/my-jobs";
import Narrator from "./narrator";
import BigPlayer from "./big-player";

type JobInfo = Job & { expiresAt?: string; canNarrate?: boolean };

// Arquivo que o card mostra: a versão narrada (se houver e não pediu o original).
const shownFile = (v: Variation, original: Set<number>) =>
  v.narrated && !original.has(v.index) ? v.file.replace(/\.mp4$/, "_narrado.mp4") : v.file;

// Frases que alternam enquanto o lote é gerado (pedido do Andre: aviso maior e motivacional).
const PHRASES = [
  "Cada vídeo é uma nova chance de viralizar. 🚀",
  "Quem posta todo dia vende todo dia. Seus vídeos estão saindo do forno! 🔥",
  "Constância vence talento: com esse lote você tem conteúdo para a semana toda. 💪",
  "O próximo vídeo pode ser o que bomba. Bora! ✨",
  "Enquanto você espera, pense na legenda do primeiro post. 😉",
  "Teste vários ganchos: o TikTok mostra qual funciona melhor. 📈",
];

function Generating({ message, done, total, pct, slow }: { message?: string; done: number; total: number; pct: number; slow?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % PHRASES.length), 9000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mt-3 grid gap-2 rounded-2xl border border-brand/40 bg-brand/10 p-4 text-center sm:p-6">
      <p className="text-2xl font-black sm:text-3xl">
        <span className="mr-2 inline-block animate-spin">⏳</span>Gerando seus vídeos…
      </p>
      <p className="text-sm font-semibold text-foreground/70 sm:text-base">{message}</p>
      <div className="mx-auto h-3 w-full max-w-xl overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full bg-gradient-to-r from-accent to-brand transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm font-bold">
        {done} de {total} vídeos prontos
      </p>
      {slow && <p className="text-xs font-semibold text-foreground/60">⏱️ Com {slow}, os vídeos demoram mais para ficar prontos. Pode deixar esta aba aberta.</p>}
      <p key={i} className="animate-pulse text-base font-bold text-accent-ink sm:text-lg">
        {PHRASES[i]}
      </p>
      <p className="text-[11px] text-foreground/50">Pode deixar esta página aberta: os vídeos aparecem aqui embaixo assim que ficam prontos.</p>
    </div>
  );
}

export default function JobView({ id }: { id: string }) {
  const [job, setJob] = useState<JobInfo | null>(null);
  const [now, setNow] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [otherAccount, setOtherAccount] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [original, setOriginal] = useState<Set<number>>(new Set());
  const [narrating, setNarrating] = useState<Variation | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      try {
        const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        if (res.status === 404) return setNotFound(true);
        if (res.status === 403) return setOtherAccount(true);
        const j: JobInfo = await res.json();
        if (stop) return;
        setJob(j);
        rememberJob({ id: j.id, product: j.product, createdAt: j.createdAt });
        if (j.status === "done" || j.status === "error") return;
      } catch {}
      timer = setTimeout(tick, 2000);
    }
    tick();
    const first = setTimeout(() => setNow(Date.now()), 0);
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(clock);
      clearTimeout(first);
    };
  }, [id]);

  if (otherAccount)
    return (
      <div className="p-10 text-center">
        <p className="font-bold">Este lote é de outra conta.</p>
        <p className="mt-1 text-sm text-foreground/60">Entre com a conta que gerou os vídeos para ver e baixar.</p>
        <Link href={`/entrar?volta=/tarefa/${id}`} className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 font-bold text-on-brand">
          Entrar
        </Link>
      </div>
    );
  if (notFound)
    return (
      <div className="p-10 text-center">
        <p className="font-bold">Esses vídeos não estão mais disponíveis.</p>
        <p className="mt-1 text-sm text-foreground/60">Os vídeos ficam guardados por 24 horas e depois são excluídos.</p>
        <Link href="/#criar" className="mt-4 inline-block rounded-xl bg-accent px-5 py-2.5 font-bold text-white">
          Gerar novos vídeos
        </Link>
      </div>
    );
  if (!job) return <p className="p-10 text-center text-foreground/60">Carregando…</p>;

  const done = job.variations.filter((v) => v.status === "done").length;
  const total = job.variations.length || job.count || 1;
  const pct = Math.round((done / total) * 100);
  const finished = job.status === "done" || job.status === "error";

  return (
    <div className="mx-auto max-w-6xl px-3 py-3 sm:px-5 sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <h1 className="truncate text-base font-extrabold sm:text-2xl">{job.product}</h1>
          <p className="text-[11px] text-foreground/60 sm:text-xs">
            {finished && job.message}
            {finished && job.trimSilence && job.trimInfo && (
              <span className="ml-1">
                · ✂️ {(() => {
                  const cut = job.trimInfo.filter((t) => t.includes(": tirou ")).length;
                  return cut
                    ? `Corte sem som em ${cut} de ${job.trimInfo.length} clipes`
                    : "Corte sem som: não achou partes sem som nos clipes";
                })()}
              </span>
            )}
            {job.expiresAt && now > 0 && (
              <span className="ml-1 font-bold text-accent-ink">· ⏱ disponível por mais {timeLeft(job.expiresAt, now)}</span>
            )}
          </p>
        </div>
        {done > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {finished ? (
              <SaveButton
                id={id}
                files={job.variations.filter((v) => v.status === "done").map((v) => shownFile(v, original))}
                all
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-on-brand hover:bg-brand-dark disabled:opacity-60"
              />
            ) : (
              <span className="rounded-lg bg-foreground/10 px-4 py-2 text-sm font-bold text-foreground/50">Baixar todos ao terminar</span>
            )}
            <a href={`/api/jobs/${id}/legendas`} className="text-xs font-semibold text-foreground/60 underline hover:text-foreground">
              Baixar legendas
            </a>
          </div>
        )}
      </div>
      {finished && done > 0 && (
        <p className="mt-1 text-[11px] leading-snug text-foreground/55">
          📱 Toque em <b>Baixar todos</b> e depois em <b>Salvar</b> para ir à galeria
          {done > SHARE_CHUNK ? ` (de ${SHARE_CHUNK} em ${SHARE_CHUNK})` : ""}.
        </p>
      )}

      {!finished && (
        <Generating
          message={job.message}
          done={done}
          total={total}
          pct={job.status === "writing" || job.status === "queued" ? 3 : Math.max(pct, 5)}
          slow={[job.autoCaptions && "legenda automática", job.music && !job.music.startsWith("musica_ov_") && "som do seu vídeo"].filter(Boolean).join(" e ")}
        />
      )}

      {job.plan === "free" && finished && done > 0 && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2">
          <div>
            <p className="text-xs font-bold sm:text-sm">Gostou? 25 vídeos + 2 grátis, sem marca d&apos;água.</p>
            <p className="hidden text-xs text-foreground/70 sm:block">Cada gancho com cada corpo e cada CTA, prontos para postar.</p>
          </div>
          <Link href="/" className="shrink-0 rounded-lg bg-brand text-on-brand hover:bg-brand-dark px-3 py-1.5 text-xs font-bold sm:text-sm">
            Gerar lote completo
          </Link>
        </div>
      )}

      {finished && done > 0 && <DicasPostagem className="mt-2" />}

      {job.status === "error" && done === 0 && (
        <p className="mt-6 rounded-lg bg-brand/10 border border-brand/40 p-4 text-sm">{job.message}</p>
      )}

      <div className="mt-3 grid gap-2 sm:gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
        {job.variations.map((v) => (
          <Card
            key={v.index}
            id={id}
            v={v}
            selected={sel.has(v.file)}
            shown={shownFile(v, original)}
            onNarrate={v.status === "done" ? () => setNarrating(v) : undefined}
            narrateLocked={!job.canNarrate && !v.vip}
            onOriginal={(o) =>
              setOriginal((s) => {
                const n = new Set(s);
                if (o) n.add(v.index);
                else n.delete(v.index);
                return n;
              })
            }
            onToggle={() =>
              setSel((s) => {
                const n = new Set(s);
                if (n.has(v.file)) n.delete(v.file);
                else n.add(v.file);
                return n;
              })
            }
          />
        ))}
      </div>

      {finished && done > 0 && (
        <SelectionBar
          id={id}
          files={job.variations.filter((v) => v.status === "done" && sel.has(v.file)).map((v) => shownFile(v, original))}
          allCount={done}
          onAll={() => setSel(new Set(job.variations.filter((v) => v.status === "done").map((v) => v.file)))}
          onClear={() => setSel(new Set())}
        />
      )}

      {narrating && (
        <Narrator
          id={id}
          v={narrating}
          onClose={() => setNarrating(null)}
          onSaved={(nv) => {
            setJob((j) => (j ? { ...j, variations: j.variations.map((x) => (x.index === nv.index ? nv : x)) } : j));
            setOriginal((s) => {
              const n = new Set(s);
              n.delete(nv.index);
              return n;
            });
            setNarrating(null);
          }}
        />
      )}
    </div>
  );
}

const fileUrl = (id: string, file: string) => `/api/jobs/${id}/files/${file}`;

// Celular com "compartilhar arquivos" (iPhone e Android): salva vários vídeos de uma vez na galeria.
function canShareVideos() {
  try {
    if (typeof navigator === "undefined" || !navigator.canShare) return false;
    if (!window.matchMedia("(pointer: coarse)").matches) return false;
    return navigator.canShare({ files: [new File([""], "t.mp4", { type: "video/mp4" })] });
  } catch {
    return false;
  }
}

const SHARE_CHUNK = 10;

// Baixa vídeos um por um. No celular: prepara de 10 em 10 e abre o "Salvar vídeos" do aparelho (galeria).
function SaveButton({ id, files, all, className }: { id: string; files: string[]; all?: boolean; className: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [ready, setReady] = useState<{ key: string; start: number; files: File[] } | null>(null);
  const [sharedUpTo, setSharedUpTo] = useState<{ key: string; n: number } | null>(null);
  const key = files.join(",");
  const n = files.length;
  const prepared = ready && ready.key === key ? ready : null;
  const savedN = sharedUpTo && sharedUpTo.key === key ? sharedUpTo.n : 0;
  const many = n > SHARE_CHUNK;

  async function prepare(start: number) {
    const part = files.slice(start, start + SHARE_CHUNK);
    const out: File[] = [];
    try {
      for (let i = 0; i < part.length; i++) {
        setBusy(`Preparando ${start + i + 1} de ${n}…`);
        const blob = await (await fetch(fileUrl(id, part[i]))).blob();
        out.push(new File([blob], part[i], { type: "video/mp4" }));
      }
      setReady({ key, start, files: out });
    } catch {
      setBusy("Falhou. Toque de novo.");
      await new Promise((r) => setTimeout(r, 1500));
    } finally {
      setBusy(null);
    }
  }

  async function run() {
    if (!n) return;
    if (canShareVideos()) {
      if (!prepared) return prepare(savedN < n ? savedN : 0);
      try {
        await navigator.share({ files: prepared.files });
      } catch {
        return; // cancelou: mantém pronto para tentar de novo
      }
      const next = prepared.start + prepared.files.length;
      setReady(null);
      setSharedUpTo({ key, n: next });
      if (next < n) await prepare(next);
      return;
    }
    // Computador: um download por vídeo, em sequência (o navegador pode pedir para permitir vários downloads).
    for (let i = 0; i < n; i++) {
      setBusy(`Baixando ${i + 1} de ${n}…`);
      const a = document.createElement("a");
      a.href = `${fileUrl(id, files[i])}?download=1`;
      a.download = files[i];
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 900));
    }
    setBusy(null);
  }

  const plural = (k: number) => `${k} vídeo${k === 1 ? "" : "s"}`;
  let label: string;
  if (busy) label = busy;
  else if (prepared) {
    const a = prepared.start + 1;
    const b = prepared.start + prepared.files.length;
    label = many ? `Salvar ${a}–${b} de ${n} na galeria` : `Salvar ${plural(n)} na galeria`;
  } else if (savedN >= n && n > 0) label = `✓ ${plural(n)} salvos. Salvar de novo`;
  else if (!n) label = "Marque para baixar";
  else label = all ? `Baixar todos (${plural(n)})` : `Baixar ${plural(n)}`;

  return (
    <button
      type="button"
      disabled={!n || !!busy}
      onClick={run}
      className={
        prepared && !busy
          ? `${className} bg-accent! text-white! hover:bg-accent-dark! ring-4 ring-accent/40 animate-pulse`
          : className
      }
    >
      {label}
    </button>
  );
}

function SelectionBar({
  id,
  files,
  allCount,
  onAll,
  onClear,
}: {
  id: string;
  files: string[];
  allCount: number;
  onAll: () => void;
  onClear: () => void;
}) {
  const n = files.length;
  return (
    <div className="sticky bottom-2 z-20 mt-3 ml-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-surface/95 py-1 pl-3 pr-1 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.35)] ring-1 ring-foreground/10 backdrop-blur">
      <span className="whitespace-nowrap text-[11px] font-semibold">
        {n}/{allCount} marcado{n === 1 ? "" : "s"}
      </span>
      <button type="button" onClick={n === allCount ? onClear : onAll} className="whitespace-nowrap text-[11px] text-accent-ink underline">
        {n === allCount ? "Limpar" : "Marcar todos"}
      </button>
      <SaveButton
        id={id}
        files={files}
        className="rounded-full bg-brand px-3 py-1.5 text-[11px] font-black text-on-brand hover:bg-brand-dark disabled:opacity-50"
      />
    </div>
  );
}

function Card({
  id,
  v,
  selected,
  onToggle,
  shown,
  onNarrate,
  narrateLocked,
  onOriginal,
}: {
  id: string;
  v: Variation;
  selected: boolean;
  onToggle: () => void;
  shown: string;
  onNarrate?: () => void;
  narrateLocked?: boolean;
  onOriginal: (original: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(true);
  const [big, setBig] = useState<{ at: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const isNarr = shown !== v.file;
  // ?n= muda a cada nova narração, para o navegador não mostrar a gravação anterior.
  const src = `/api/jobs/${id}/files/${shown}${isNarr ? `?n=${encodeURIComponent(v.narrated || "")}` : ""}`;
  const dl = `/api/jobs/${id}/files/${shown}?download=1`;
  const fullCaption = `${v.caption} ${v.hashtags.map((h) => "#" + h).join(" ")}`;
  return (
    <div
      className={`rounded-xl border overflow-hidden flex flex-col ${selected ? "border-brand ring-4 ring-brand/50 bg-brand/10" : "border-foreground/10 bg-foreground/[0.03]"}`}
    >
      <div className="relative aspect-[9/16] bg-black grid place-items-center">
        {v.vip && (
          <span title="Vídeo VIP" className="absolute right-2 top-2 z-10 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-black text-white shadow">
            ⭐ VIP
          </span>
        )}
        {v.status === "done" && (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={`Selecionar vídeo ${v.index + 1}`}
            onClick={onToggle}
            className={`absolute left-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-lg border-2 text-base font-black shadow ${selected ? "border-brand bg-brand text-on-brand" : "border-white bg-black/40 text-transparent"}`}
          >
            ✓
          </button>
        )}
        {v.status === "done" && (
          <button
            type="button"
            onClick={() => {
              const el = videoRef.current;
              setBig({ at: el?.currentTime ?? 0 });
              el?.pause();
            }}
            aria-label={`Ver o vídeo ${v.index + 1} em tela cheia`}
            title="Tela cheia"
            className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-lg border-2 border-white bg-black/40 text-white shadow"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        )}
        {v.status === "done" ? (
          <>
            {/* Controles próprios: o menu nativo (3 pontinhos) abria para fora da tela nos cards pequenos. */}
            <video
              ref={videoRef}
              key={src}
              src={src}
              playsInline
              loop
              preload="metadata"
              onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
              onPlay={() => setPaused(false)}
              onPause={() => setPaused(true)}
              onEnded={() => setPaused(true)}
              onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
              className="h-full w-full cursor-pointer object-cover"
            />
            {paused && (
              <button
                type="button"
                aria-label={`Tocar o vídeo ${v.index + 1}`}
                onClick={() => videoRef.current?.play()}
                className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white ring-2 ring-white/80"
              >
                <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor">
                  <path d="M7 4.5v15l13-7.5z" />
                </svg>
              </button>
            )}
            <div
              className="absolute inset-x-0 bottom-0 h-3 cursor-pointer"
              onClick={(e) => {
                const el = videoRef.current;
                if (!el || !el.duration) return;
                const r = e.currentTarget.getBoundingClientRect();
                el.currentTime = ((e.clientX - r.left) / r.width) * el.duration;
              }}
            >
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
                <div className="h-full bg-brand" style={{ width: `${Math.min(100, progress * 100)}%` }} />
              </div>
            </div>
          </>
        ) : v.status === "error" ? (
          <span className="text-xs text-brand-ink p-3 text-center">Falhou</span>
        ) : (
          <span className="text-xs text-foreground/40 animate-pulse">{v.status === "rendering" ? "Montando…" : "Na fila"}</span>
        )}
      </div>
      <div className="p-2 grid gap-1.5 text-[11px]">
        <p className="font-bold leading-snug line-clamp-2">
          #{v.index + 1} · <span className="text-accent-ink">{v.durationSec}s</span> · {v.hook}
        </p>
        {onNarrate &&
          (narrateLocked ? (
            <Link
              href="/conta#vip"
              title="Narração é exclusiva do plano VIP"
              className="rounded-md border border-accent/50 py-1 text-center font-bold text-accent-ink hover:bg-accent/10"
            >
              🎙 Narrar <span className="text-[9px]">⭐ VIP</span>
            </Link>
          ) : (
            <button type="button" onClick={onNarrate} className="rounded-md bg-accent py-1 font-bold text-white hover:bg-accent-dark">
              🎙 {v.narrated ? "Narrar de novo" : "Narrar"}
            </button>
          ))}
        {v.narrated && (
          <div className="flex overflow-hidden rounded-md bg-foreground/10 text-[10px] font-bold">
            <button type="button" onClick={() => onOriginal(true)} className={`flex-1 py-0.5 ${!isNarr ? "bg-foreground text-surface" : ""}`}>
              Original
            </button>
            <button type="button" onClick={() => onOriginal(false)} className={`flex-1 py-0.5 ${isNarr ? "bg-accent text-white" : ""}`}>
              🎙 Narrado
            </button>
          </div>
        )}
        <div className="hidden sm:block">
          <p className="text-foreground/55 line-clamp-2">{fullCaption}</p>
        </div>
        <div className="flex flex-col gap-1 mt-auto sm:flex-row sm:gap-1.5">
          <button
            onClick={() => {
              navigator.clipboard.writeText(fullCaption);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex-1 rounded-md bg-foreground/10 hover:bg-foreground/15 py-1"
          >
            {copied ? "Copiado!" : "Copiar texto"}
          </button>
          {v.status === "done" && (
            <a href={dl} className="flex-1 text-center rounded-md bg-brand text-on-brand hover:bg-brand-dark py-1 font-semibold">
              Baixar
            </a>
          )}
        </div>
      </div>
      {big && <BigPlayer src={src} title={`#${v.index + 1} · ${v.hook}`} startAt={big.at} onClose={() => setBig(null)} />}
    </div>
  );
}
