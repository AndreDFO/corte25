"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { forgetJobs, readMyJobs, timeLeft } from "@/lib/my-jobs";
import type { Job } from "@/lib/jobs";

type Row = Job & { expiresAt: string };

export default function MyVideos() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    (async () => {
      const mine = readMyJobs();
      const gone: string[] = [];
      const found: Row[] = [];
      for (const m of mine) {
        try {
          const res = await fetch(`/api/jobs/${m.id}`, { cache: "no-store" });
          if (res.status === 404) gone.push(m.id);
          else if (res.ok) found.push(await res.json());
        } catch {}
      }
      if (gone.length) forgetJobs(gone);
      setRows(found);
    })();
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="text-3xl font-black tracking-tight">Meus vídeos</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Seus vídeos ficam guardados por <b>24 horas</b>. Nesse prazo você pode abrir e baixar quantas vezes quiser.
        Depois disso eles são excluídos.
      </p>
      {rows === null ? (
        <p className="mt-8 text-foreground/50">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-surface p-6 text-center ring-1 ring-foreground/10">
          <p className="text-foreground/60">Nenhum lote nas últimas 24 horas.</p>
          <Link href="/#criar" className="mt-3 inline-block rounded-xl bg-accent px-5 py-2.5 font-bold text-white">
            Gerar vídeos
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {rows.map((j) => {
            const done = j.variations.filter((v) => v.status === "done").length;
            return (
              <li key={j.id}>
                <Link
                  href={`/tarefa/${j.id}`}
                  className="flex items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-foreground/10 hover:ring-brand"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-bold">{j.product}</p>
                    <p className="text-xs text-foreground/60">
                      {j.plan === "free" ? "Teste grátis" : "Lote completo"} · {done} vídeo{done === 1 ? "" : "s"} ·{" "}
                      {new Date(j.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent-ink">
                    expira em {now ? timeLeft(j.expiresAt, now) : "…"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
