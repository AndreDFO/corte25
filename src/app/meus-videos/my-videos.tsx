"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { forgetJobs, readMyJobs, timeLeft } from "@/lib/my-jobs";
type Row = { id: string; product: string; plan: "free" | "full"; createdAt: string; expiresAt: string; done: number };

export default function MyVideos() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [now, setNow] = useState(0);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState("");

  async function remove(j: Row) {
    setDeleting(true);
    setDelError("");
    try {
      const res = await fetch(`/api/jobs/${j.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setDelError(body.error || "Não foi possível excluir. Tente de novo.");
      forgetJobs([j.id]);
      setRows((r) => (r ? r.filter((x) => x.id !== j.id) : r));
      setConfirm(null);
    } catch {
      setDelError("Sem conexão. Tente de novo.");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    (async () => {
      // Uma ida só ao servidor (antes era um pedido por lote, um depois do outro).
      // Com login: os lotes da conta (de qualquer aparelho). Sem login: os lotes deste navegador.
      const ids = readMyJobs().map((m) => m.id).join(",");
      try {
        const r = await fetch(`/api/conta/videos?ids=${ids}`, { cache: "no-store" });
        const j = r.ok ? ((await r.json()) as { logged: boolean; rows: Row[]; gone: string[] }) : null;
        if (!j) return setRows([]);
        if (!j.logged && j.gone.length) forgetJobs(j.gone);
        setRows(j.rows);
      } catch {
        setRows([]);
      }
    })();
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-5">
      <h1 className="text-xl font-black tracking-tight sm:text-2xl">Meus vídeos</h1>
      <p className="mt-0.5 text-xs text-foreground/60">
        Ficam guardados por <b>24 horas</b>; baixe quantas vezes quiser nesse prazo.
      </p>
      {rows === null ? (
        <p className="mt-8 text-foreground/50">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-xl bg-surface p-4 text-center ring-1 ring-foreground/10">
          <p className="text-foreground/60">Nenhum lote nas últimas 24 horas.</p>
          <Link href="/#criar" className="mt-3 inline-block rounded-xl bg-accent px-5 py-2.5 font-bold text-white">
            Gerar vídeos
          </Link>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-foreground/10 rounded-xl bg-surface ring-1 ring-foreground/10">
          {rows.map((j) => {
            const done = j.done;
            return (
              <li key={j.id} className="flex items-center">
                <Link
                  href={`/tarefa/${j.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 hover:bg-foreground/5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-bold">{j.product}</p>
                    <p className="truncate text-[11px] text-foreground/60">
                      {j.plan === "free" ? "Teste grátis" : "Lote completo"} · {done} vídeo{done === 1 ? "" : "s"} ·{" "}
                      {new Date(j.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-[11px] leading-tight">
                    <span className="block font-bold text-accent-ink">{now ? timeLeft(j.expiresAt, now) : "…"}</span>
                    <span className="text-foreground/50">para expirar</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-brand px-2.5 py-1 text-xs font-bold text-on-brand">Abrir</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setDelError("");
                    setConfirm(j);
                  }}
                  aria-label="Excluir este lote"
                  title="Excluir"
                  className="mr-2 shrink-0 rounded-lg p-1.5 text-foreground/40 hover:bg-foreground/5 hover:text-red-600"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !deleting && setConfirm(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-black">Excluir estes vídeos?</p>
            <p className="mt-1 truncate text-sm font-semibold">{confirm.product}</p>
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              ⚠️ Os vídeos serão <b>apagados para sempre</b> desta conta e não dá para recuperar. Confira se você já baixou
              todos antes de excluir.
            </p>
            {delError && <p className="mt-2 text-sm text-red-700">{delError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirm(null)}
                className="rounded-lg bg-foreground/10 px-4 py-2 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => remove(confirm)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Excluindo…" : "Excluir para sempre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
