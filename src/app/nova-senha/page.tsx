"use client";

import { useState } from "react";
import PasswordInput from "../password-input";

// Página aberta pelo link do e-mail "Esqueci minha senha".
export default function NovaSenha() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const field = "rounded-lg bg-field border border-foreground/15 px-3 py-2.5 text-sm outline-none focus:border-brand";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As duas senhas não são iguais.");
    setBusy(true);
    const res = await fetch("/api/conta/nova-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(j.error || "Não deu certo, tente de novo.");
    }
    window.location.href = "/conta";
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-10">
      <form onSubmit={submit} className="grid gap-3 rounded-3xl bg-surface p-6 ring-1 ring-foreground/10 border-t-8 border-brand">
        <h1 className="text-xl font-black">Crie sua nova senha</h1>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Nova senha (mínimo 8 caracteres)" aria-label="Nova senha" required className={field} />
        <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="Repita a nova senha" aria-label="Repita a nova senha" required className={field} />
        {error && <p className="text-sm text-brand-ink">{error}</p>}
        <button disabled={busy} className="rounded-xl bg-accent py-3 font-black text-white hover:bg-accent-dark disabled:opacity-60">
          {busy ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}
