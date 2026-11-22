"use client";

import { useEffect, useRef, useState } from "react";

// Botão flutuante "Relatar problema": conversa curta com a IA, print opcional e envio do relato.
// Erros do navegador ficam guardados para ajudar na correção (só vão junto quando a pessoa envia).

type Msg = { role: "user" | "assistant"; content: string };
const MAX_USER = 8;
const erros: string[] = [];
const OLA = "Oi! Me conta o problema que aconteceu no site: o que você tentou fazer e o que deu errado? Se quiser, pode anexar um print (não é obrigatório).";

function info() {
  return {
    url: location.pathname + location.search,
    referrer: document.referrer,
    screen: `${screen.width}x${screen.height}`,
    viewport: `${innerWidth}x${innerHeight}`,
    language: navigator.language,
    erros,
  };
}

// Reduz o print para no máximo 1280 px (JPEG) para caber no relato.
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    for (const [max, q] of [
      [1280, 0.72],
      [960, 0.6],
      [720, 0.5],
    ]) {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", q);
      if (data.length < 880_000) return data;
    }
    throw new Error("grande");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function RelatarProblema() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: OLA }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [print, setPrint] = useState<string | null>(null);
  const [contato, setContato] = useState("");
  const [logado, setLogado] = useState<boolean | null>(null);
  const [semIa, setSemIa] = useState(false);
  const [done, setDone] = useState(false);
  const [erro, setErro] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onErr = (e: ErrorEvent) => erros.push(`${e.message} @ ${e.filename?.split("/").pop()}:${e.lineno}`.slice(0, 400));
    const onRej = (e: PromiseRejectionEvent) => erros.push(`promessa: ${String(e.reason?.message || e.reason)}`.slice(0, 400));
    addEventListener("error", onErr);
    addEventListener("unhandledrejection", onRej);
    return () => {
      removeEventListener("error", onErr);
      removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  useEffect(() => {
    if (!open || logado !== null) return;
    fetch("/api/relatos")
      .then((r) => r.json())
      .then((j) => {
        setLogado(Boolean(j.logado));
        if (!j.ia) setSemIa(true);
      })
      .catch(() => setLogado(false));
  }, [open, logado]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, done]);

  const userCount = msgs.filter((m) => m.role === "user").length;

  async function enviar(all: Msg[], extra?: { resumo: string; detalhes: string; pagina: string }) {
    setErro("");
    const res = await fetch("/api/relatos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acao: "enviar", mensagens: all.slice(1), info: info(), print, contato, ...extra }),
    }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    if (res?.ok) {
      setDone(true);
      return;
    }
    setErro(j?.error || "Não consegui enviar agora. Tente de novo.");
  }

  async function mandar(e?: React.FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || busy || done || userCount >= MAX_USER) return;
    const all: Msg[] = [...msgs, { role: "user", content: t.slice(0, 1000) }];
    setMsgs(all);
    setText("");
    if (semIa) return;
    setBusy(true);
    try {
      const res = await fetch("/api/relatos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "conversar", mensagens: all.slice(1), info: info() }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.semIa || j.limite || !res.ok) {
        setSemIa(true);
        setMsgs([
          ...all,
          {
            role: "assistant",
            content: j.limite
              ? "Recebi muitas mensagens agora. Escreva tudo o que puder e toque em Enviar relato."
              : "Pode escrever mais detalhes se quiser. Quando terminar, toque em Enviar relato.",
          },
        ]);
        return;
      }
      if (j.kind === "report") {
        const fim = j.text || "Obrigado! Já registrei o problema para a equipe analisar.";
        const withEnd: Msg[] = [...all, { role: "assistant", content: fim }];
        setMsgs(withEnd);
        await enviar(withEnd, { resumo: j.summary, detalhes: j.details, pagina: j.page });
        return;
      }
      setMsgs([...all, { role: "assistant", content: j.text }]);
    } finally {
      setBusy(false);
    }
  }

  function reiniciar() {
    setMsgs([{ role: "assistant", content: OLA }]);
    setPrint(null);
    setDone(false);
    setErro("");
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Relatar problema"
          className="group fixed bottom-3 right-3 z-40 flex h-10 items-center gap-1.5 rounded-full border border-foreground/15 bg-surface/90 px-2.5 text-sm font-bold opacity-70 shadow-md backdrop-blur hover:opacity-100 sm:bottom-5 sm:right-5"
          aria-label="Relatar problema no site"
        >
          {/* Recolhido: só o ícone; o texto aparece ao passar o mouse (pedido do Andre). */}
          <span aria-hidden>🐞</span>
          <span className="hidden whitespace-nowrap pr-1 group-hover:inline group-focus-visible:inline">Relatar problema</span>
        </button>
      )}
      {open && (
        <div
          role="dialog"
          aria-label="Relatar problema"
          className="fixed inset-x-2 bottom-2 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-foreground/15 bg-surface shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-foreground/10 bg-accent/15 px-4 py-2.5">
            <div>
              <p className="font-black">🐞 Relatar problema</p>
              <p className="text-[11px] text-foreground/60">Atendimento automático só para erros do site</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-lg px-2 py-1 text-lg hover:bg-foreground/10">
              ✕
            </button>
          </div>

          <div ref={listRef} className="grid min-h-40 flex-1 content-start gap-2 overflow-y-auto px-3 py-3 text-sm">
            {msgs.map((m, i) => (
              <p
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${m.role === "user" ? "justify-self-end bg-brand/40" : "justify-self-start bg-foreground/5"}`}
              >
                {m.content}
              </p>
            ))}
            {busy && <p className="justify-self-start rounded-2xl bg-foreground/5 px-3 py-2 text-foreground/50">digitando…</p>}
            {done && (
              <div className="rounded-xl border border-brand bg-brand/15 px-3 py-2 text-center">
                <p className="font-bold">✓ Relato enviado. Obrigado!</p>
                <p className="text-xs text-foreground/60">A equipe vai analisar e corrigir.</p>
                <button type="button" onClick={reiniciar} className="mt-1 text-xs underline">
                  Relatar outro problema
                </button>
              </div>
            )}
          </div>

          {!done && (
            <div className="grid gap-2 border-t border-foreground/10 px-3 py-2">
              {logado === false && (
                <input
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  placeholder="Seu WhatsApp ou e-mail para retorno (opcional)"
                  className="rounded-lg border border-foreground/15 bg-field px-3 py-1.5 text-xs"
                  maxLength={120}
                />
              )}
              {print && (
                <div className="flex items-center gap-2 text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element -- prévia local do print */}
                  <img src={print} alt="Print anexado" className="h-10 w-10 rounded object-cover" />
                  <span className="flex-1">Print anexado</span>
                  <button type="button" onClick={() => setPrint(null)} className="underline">
                    remover
                  </button>
                </div>
              )}
              <form onSubmit={mandar} className="flex items-end gap-1.5">
                <button
                  type="button"
                  title="Anexar print (opcional)"
                  aria-label="Anexar print (opcional)"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-foreground/15 px-2.5 py-2 hover:bg-foreground/5"
                >
                  📎
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try {
                      setPrint(await shrink(f));
                    } catch {
                      setErro("Não consegui ler essa imagem. Tente outra.");
                    }
                  }}
                />
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      mandar();
                    }
                  }}
                  rows={1}
                  maxLength={1000}
                  disabled={busy || userCount >= MAX_USER}
                  placeholder={userCount >= MAX_USER ? "Toque em Enviar relato" : "Escreva aqui…"}
                  aria-label="Sua mensagem"
                  className="max-h-28 min-h-10 flex-1 resize-none rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm"
                />
                <button
                  disabled={busy || !text.trim()}
                  className="rounded-lg bg-brand px-3 py-2 font-black text-on-brand hover:bg-brand-dark disabled:opacity-40"
                  aria-label="Mandar mensagem"
                >
                  ➤
                </button>
              </form>
              {userCount > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => enviar(msgs)}
                  className="rounded-lg bg-accent py-1.5 text-xs font-bold text-on-accent hover:bg-accent-dark disabled:opacity-40"
                >
                  Enviar relato agora
                </button>
              )}
              {erro && <p className="text-xs font-semibold text-brand-ink">{erro}</p>}
            </div>
          )}
        </div>
      )}
    </>
  );
}
