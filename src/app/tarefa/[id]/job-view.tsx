"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Job, Variation } from "@/lib/jobs";
import { ZIP_PART } from "@/lib/pricing";
import { rememberJob, timeLeft } from "@/lib/my-jobs";

export default function JobView({ id }: { id: string }) {
  const [job, setJob] = useState<(Job & { expiresAt?: string }) | null>(null);
  const [now, setNow] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [otherAccount, setOtherAccount] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      try {
        const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        if (res.status === 404) return setNotFound(true);
        if (res.status === 403) return setOtherAccount(true);
        const j: Job & { expiresAt?: string } = await res.json();
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
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="mb-3 inline-flex items-center gap-1 rounded-lg bg-foreground/5 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/10">
            ← Voltar ao início
          </Link>
          <p className="text-sm text-foreground/50">Produto</p>
          <h1 className="text-3xl font-extrabold">{job.product}</h1>
          <p className="mt-1 text-foreground/60">
            {job.message}
          </p>
          {job.expiresAt && now > 0 && (
            <p className="mt-2 inline-block rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent-ink">
              ⏱ Disponível por mais {timeLeft(job.expiresAt, now)}: baixe quantas vezes quiser
            </p>
          )}
        </div>
        {done > 0 && (
          <div className="flex gap-3">
            <a href={`/api/jobs/${id}/legendas`} className="rounded-lg border border-foreground/20 px-4 py-2.5 font-semibold hover:bg-foreground/5">
              Baixar legendas
            </a>
            <a
              href={`/api/jobs/${id}/zip`}
              className={`rounded-lg px-4 py-2.5 font-bold ${finished ? "bg-brand text-on-brand hover:bg-brand-dark" : "bg-foreground/10 pointer-events-none text-foreground/50"}`}
            >
              {finished ? `Baixar tudo (ZIP, ${done} vídeos)` : "ZIP disponível ao terminar"}
            </a>
          </div>
        )}
      </div>
      {finished && done > ZIP_PART && (
        <div className="mt-3 rounded-xl bg-accent/10 border border-accent/30 px-4 py-3 text-sm">
          <b>No celular?</b> O ZIP completo é grande. Baixe em partes menores
          <span className="inline-flex flex-wrap gap-2 ml-2 align-middle">
            {Array.from({ length: Math.ceil(done / ZIP_PART) }, (_, i) => (
              <a
                key={i}
                href={`/api/jobs/${id}/zip?parte=${i + 1}`}
                className="rounded-md bg-accent px-2.5 py-1 text-xs font-bold text-white hover:bg-accent-dark"
              >
                Parte {i + 1} ({i * ZIP_PART + 1}–{Math.min(done, (i + 1) * ZIP_PART)})
              </a>
            ))}
          </span>
          <span className="block mt-1 text-foreground/60">
            Ou marque os vídeos que quiser (quadradinho em cada um) e baixe só eles, sem ZIP.
          </span>
        </div>
      )}

      <div className="mt-6 h-2 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent to-brand transition-all"
          style={{ width: `${job.status === "writing" || job.status === "queued" ? 3 : pct}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-foreground/50">
        {done} de {total} vídeos prontos
      </p>

      {job.plan === "free" && finished && done > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand/40 bg-brand/10 p-5">
          <div>
            <p className="font-bold text-lg">Gostou? Libere 25 vídeos + 2 de bônus, sem marca d&apos;água.</p>
            <p className="text-sm text-foreground/70">Cada gancho com cada corpo e cada CTA, prontos para postar.</p>
          </div>
          <Link href="/" className="rounded-lg bg-brand text-on-brand hover:bg-brand-dark px-5 py-3 font-bold">
            Gerar o lote completo
          </Link>
        </div>
      )}

      {job.status === "error" && done === 0 && (
        <p className="mt-6 rounded-lg bg-brand/10 border border-brand/40 p-4 text-sm">{job.message}</p>
      )}

      <div className="mt-8 grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {job.variations.map((v) => (
          <Card
            key={v.index}
            id={id}
            v={v}
            selected={sel.has(v.file)}
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
          files={job.variations.filter((v) => v.status === "done" && sel.has(v.file)).map((v) => v.file)}
          allCount={done}
          onAll={() => setSel(new Set(job.variations.filter((v) => v.status === "done").map((v) => v.file)))}
          onClear={() => setSel(new Set())}
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
  const [busy, setBusy] = useState<string | null>(null);
  const [ready, setReady] = useState<File[] | null>(null);
  const key = files.join(",");
  const [readyKey, setReadyKey] = useState("");
  const n = files.length;
  const prepared = ready && readyKey === key ? ready : null;

  async function download() {
    if (!n) return;
    if (canShareVideos()) {
      // 1º toque: baixa os vídeos para a memória. 2º toque: abre "Salvar vídeos" do celular.
      if (prepared) {
        try {
          await navigator.share({ files: prepared });
        } catch {}
        return;
      }
      try {
        const out: File[] = [];
        for (let i = 0; i < n; i++) {
          setBusy(`Preparando ${i + 1} de ${n}…`);
          const blob = await (await fetch(fileUrl(id, files[i]))).blob();
          out.push(new File([blob], files[i], { type: "video/mp4" }));
        }
        setReady(out);
        setReadyKey(key);
      } finally {
        setBusy(null);
      }
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

  return (
    <div className="sticky bottom-3 z-20 mt-6 flex flex-wrap items-center gap-2 rounded-2xl bg-surface/95 p-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.35)] ring-1 ring-foreground/10 backdrop-blur">
      <span className="text-sm font-semibold">
        {n} de {allCount} selecionado{n === 1 ? "" : "s"}
      </span>
      <button type="button" onClick={n === allCount ? onClear : onAll} className="text-sm text-accent-ink underline">
        {n === allCount ? "Limpar" : "Marcar todos"}
      </button>
      <button
        type="button"
        disabled={!n || !!busy}
        onClick={download}
        className="ml-auto rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-on-brand hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ??
          (prepared
            ? `Salvar ${n} vídeo${n === 1 ? "" : "s"} no celular`
            : n
              ? `Baixar ${n} vídeo${n === 1 ? "" : "s"}`
              : "Marque os vídeos para baixar")}
      </button>
    </div>
  );
}

function Card({ id, v, selected, onToggle }: { id: string; v: Variation; selected: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false);
  const src = `/api/jobs/${id}/files/${v.file}`;
  const fullCaption = `${v.caption} ${v.hashtags.map((h) => "#" + h).join(" ")}`;
  return (
    <div
      className={`rounded-xl border overflow-hidden flex flex-col ${selected ? "border-brand ring-4 ring-brand/50 bg-brand/10" : "border-foreground/10 bg-foreground/[0.03]"}`}
    >
      <div className="relative aspect-[9/16] bg-black grid place-items-center">
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
        {v.status === "done" ? (
          <video src={src} controls playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : v.status === "error" ? (
          <span className="text-xs text-brand-ink p-3 text-center">Falhou</span>
        ) : (
          <span className="text-xs text-foreground/40 animate-pulse">{v.status === "rendering" ? "Montando…" : "Na fila"}</span>
        )}
      </div>
      <div className="p-3 grid gap-2 text-xs">
        <p className="font-bold text-sm leading-snug">
          #{v.index + 1} · <span className="text-accent-ink">{v.durationSec}s</span> · {v.hook}
        </p>
        <p className="text-foreground/40">{v.recipe}</p>
        <p className="text-foreground/60 line-clamp-3">{fullCaption}</p>
        <div className="flex gap-2 mt-auto">
          <button
            onClick={() => {
              navigator.clipboard.writeText(fullCaption);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex-1 rounded-md bg-foreground/10 hover:bg-foreground/15 py-1.5"
          >
            {copied ? "Copiado!" : "Copiar legenda"}
          </button>
          {v.status === "done" && (
            <a href={`${src}?download=1`} className="flex-1 text-center rounded-md bg-brand text-on-brand hover:bg-brand-dark py-1.5 font-semibold">
              Baixar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
