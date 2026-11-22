"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const params = useSearchParams();
  const back = params.get("volta") || "/conta";
  const [mode, setMode] = useState<"entrar" | "cadastrar">(params.get("modo") === "cadastrar" ? "cadastrar" : "entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/conta/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, whatsapp }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Não deu certo, tente de novo.");
      window.location.href = back.startsWith("/") ? back : "/conta";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const field = "rounded-lg bg-field border border-foreground/15 px-3 py-2.5 text-sm outline-none focus:border-brand";
  return (
    <div className="mx-auto max-w-sm px-5 py-10">
      <form onSubmit={submit} className="grid gap-3 rounded-3xl bg-surface p-6 ring-1 ring-foreground/10 border-t-8 border-brand">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-foreground/5 p-1 text-sm font-bold">
          {(["entrar", "cadastrar"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg py-2 ${mode === m ? "bg-surface shadow-sm" : "text-foreground/50"}`}
            >
              {m === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>
        {mode === "cadastrar" && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" aria-label="Nome" className={field} />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          placeholder="E-mail"
          aria-label="E-mail"
          required
          className={field}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete={mode === "entrar" ? "current-password" : "new-password"}
          placeholder={mode === "entrar" ? "Senha" : "Crie uma senha (mínimo 8 caracteres)"}
          aria-label="Senha"
          required
          className={field}
        />
        {mode === "cadastrar" && (
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            type="tel"
            inputMode="tel"
            placeholder="WhatsApp com DDD (opcional)"
            aria-label="WhatsApp"
            className={field}
          />
        )}
        {error && <p className="text-sm text-brand-ink">{error}</p>}
        <button disabled={busy} className="rounded-xl bg-accent py-3 font-black text-white hover:bg-accent-dark disabled:opacity-60">
          {busy ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Criar conta"}
        </button>
      </form>
    </div>
  );
}
