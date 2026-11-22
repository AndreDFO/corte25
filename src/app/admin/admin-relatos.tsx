"use client";

import { useState } from "react";

// Relatos do botão "Relatar problema" (tabela bug_reports).
export type Relato = {
  id: string;
  created_at: string;
  status: string;
  summary: string;
  details: string | null;
  page: string | null;
  email: string | null;
  contact: string | null;
  transcript: { role: string; content: string }[];
  browser: { userAgent?: string; viewport?: string; erros?: string[] };
  fix_note: string | null;
  fix_pr: string | null;
  has_print: boolean;
};

const STATUS: { id: string; label: string; cls: string }[] = [
  { id: "novo", label: "Novo", cls: "bg-accent/25" },
  { id: "em_correcao", label: "Em correção", cls: "bg-yellow-300/50" },
  { id: "corrigido", label: "Corrigido", cls: "bg-brand/40" },
  { id: "descartado", label: "Descartado", cls: "bg-foreground/10" },
];

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Item({ r, onStatus }: { r: Relato; onStatus: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [print, setPrint] = useState<string | null>(null);
  const st = STATUS.find((s) => s.id === r.status) || STATUS[0];
  return (
    <li className="min-w-0 rounded-xl border border-foreground/10 bg-surface p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 break-words text-left font-semibold hover:underline">
          {r.summary}
        </button>
        <span className="text-xs text-foreground/50">{when(r.created_at)}</span>
      </div>
      <p className="mt-1 break-all text-xs text-foreground/60">
        {r.email || r.contact || "sem contato"} · {r.page || "página ?"} {r.has_print && "· 📎 print"}
      </p>
      {open && (
        <div className="mt-2 grid min-w-0 grid-cols-1 gap-2">
          {r.details && <p className="whitespace-pre-wrap break-words">{r.details}</p>}
          {r.contact && r.email && <p className="break-all text-xs">Contato: {r.contact}</p>}
          <details className="text-xs">
            <summary className="cursor-pointer text-foreground/60">Conversa ({r.transcript?.length || 0} mensagens)</summary>
            <div className="mt-1 grid gap-1">
              {(r.transcript || []).map((m, i) => (
                <p key={i} className="whitespace-pre-wrap break-words">
                  <b>{m.role === "user" ? "Cliente" : "IA"}:</b> {m.content}
                </p>
              ))}
            </div>
          </details>
          <p className="break-all text-[11px] text-foreground/50">
            {r.browser?.viewport} · {r.browser?.userAgent}
            {r.browser?.erros?.length ? ` · erros: ${r.browser.erros.join(" | ")}` : ""}
          </p>
          {r.fix_note && (
            <p className="break-words rounded-lg bg-brand/15 px-2 py-1 text-xs">
              Correção: {r.fix_note}{" "}
              {r.fix_pr && (
                <a href={r.fix_pr} target="_blank" rel="noreferrer" className="underline">
                  ver alteração
                </a>
              )}
            </p>
          )}
          {r.has_print &&
            (print ? (
              // eslint-disable-next-line @next/next/no-img-element -- print enviado pelo cliente
              <img src={print} alt="Print do cliente" className="max-h-96 w-auto max-w-full rounded-lg border border-foreground/10" />
            ) : (
              <button
                type="button"
                className="justify-self-start text-xs underline"
                onClick={async () => {
                  const j = await fetch(`/api/admin/relatos?id=${r.id}`).then((x) => x.json()).catch(() => ({}));
                  if (j.print) setPrint(j.print);
                }}
              >
                Ver print
              </button>
            ))}
          <div className="flex flex-wrap gap-1.5">
            {STATUS.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={s.id === r.status}
                onClick={() => onStatus(s.id)}
                className="rounded-lg border border-foreground/15 px-2 py-1 text-xs hover:bg-foreground/5 disabled:font-bold disabled:opacity-60"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

export default function AdminRelatos({ initial }: { initial: Relato[] }) {
  const [list, setList] = useState(initial);
  const [filtro, setFiltro] = useState("abertos");
  const shown = list.filter((r) => (filtro === "abertos" ? r.status === "novo" || r.status === "em_correcao" : filtro === "todos" || r.status === filtro));
  const novos = list.filter((r) => r.status === "novo").length;

  async function setStatus(id: string, status: string) {
    const res = await fetch("/api/admin/relatos", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) setList((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <section className="grid min-w-0 grid-cols-1 gap-2 rounded-2xl border border-foreground/10 bg-surface/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black">🐞 Problemas relatados {novos > 0 && <span className="text-accent-ink">({novos} novos)</span>}</h2>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="rounded-lg border border-foreground/15 bg-field px-2 py-1 text-sm" aria-label="Filtrar relatos">
          <option value="abertos">Abertos</option>
          <option value="todos">Todos</option>
          {STATUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {shown.length ? (
        <ul className="grid grid-cols-1 gap-2">
          {shown.map((r) => (
            <Item key={r.id} r={r} onStatus={(s) => setStatus(r.id, s)} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/60">Nenhum relato aqui.</p>
      )}
    </section>
  );
}
