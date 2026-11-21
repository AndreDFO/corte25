"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Job, Variation } from "@/lib/jobs";
import { FULL_PRICE, ZIP_PART } from "@/lib/pricing";

export default function JobView({ id }: { id: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      try {
        const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        if (res.status === 404) return setNotFound(true);
        const j: Job = await res.json();
        if (stop) return;
        setJob(j);
        if (j.status === "done" || j.status === "error") return;
      } catch {}
      timer = setTimeout(tick, 2000);
    }
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (notFound) return <p className="p-10 text-center text-foreground/60">Tarefa não encontrada.</p>;
  if (!job) return <p className="p-10 text-center text-foreground/60">Carregando…</p>;

  const done = job.variations.filter((v) => v.status === "done").length;
  const total = job.variations.length || job.count || 1;
  const pct = Math.round((done / total) * 100);
  const finished = job.status === "done" || job.status === "error";

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-foreground/50">Produto</p>
          <h1 className="text-3xl font-extrabold">{job.product}</h1>
          <p className="mt-1 text-foreground/60">
            {job.message}
            {job.copySource === "template" && (
              <span className="ml-2 text-xs text-foreground/50">
                (hooks de modelos prontos; configure a chave da IA para hooks personalizados)
              </span>
            )}
          </p>
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
            Ou toque em <b>Baixar</b> em cada vídeo para salvar direto, sem ZIP.
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
            🔒 Lote completo · {FULL_PRICE}
          </Link>
        </div>
      )}

      {job.status === "error" && done === 0 && (
        <p className="mt-6 rounded-lg bg-brand/10 border border-brand/40 p-4 text-sm">{job.message}</p>
      )}

      <div className="mt-8 grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {job.variations.map((v) => (
          <Card key={v.index} id={id} v={v} />
        ))}
      </div>
    </div>
  );
}

function Card({ id, v }: { id: string; v: Variation }) {
  const [copied, setCopied] = useState(false);
  const src = `/api/jobs/${id}/files/${v.file}`;
  const fullCaption = `${v.caption} ${v.hashtags.map((h) => "#" + h).join(" ")}`;
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] overflow-hidden flex flex-col">
      <div className="aspect-[9/16] bg-black grid place-items-center">
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
