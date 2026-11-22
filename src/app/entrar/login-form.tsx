"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import PasswordInput from "../password-input";

export default function LoginForm() {
  const params = useSearchParams();
  const back = params.get("volta") || "/conta";
  const [mode, setMode] = useState<"entrar" | "cadastrar" | "recuperar">(params.get("modo") === "cadastrar" ? "cadastrar" : "entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const linkError = params.get("erro") === "link";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "recuperar") {
        const res = await fetch("/api/conta/recuperar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || "Não deu certo, tente de novo.");
        setSent(true);
        setBusy(false);
        return;
      }
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
              onClick={() => {
                setMode(m);
                setSent(false);
                setError("");
              }}
              className={`rounded-lg py-2 ${mode === m || (mode === "recuperar" && m === "entrar") ? "bg-surface shadow-sm" : "text-foreground/50"}`}
            >
              {m === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>
        {mode === "cadastrar" && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome (aparece no topo do site)" aria-label="Nome" required autoComplete="name" className={field} />
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
        {mode === "recuperar" ? (
          <p className="text-xs text-foreground/60">
            Digite o e-mail da sua conta. Vamos mandar um link para você criar uma senha nova (confira também o spam).
          </p>
        ) : (
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "entrar" ? "current-password" : "new-password"}
            placeholder={mode === "entrar" ? "Senha" : "Crie uma senha (mínimo 8 caracteres)"}
            aria-label="Senha"
            required
            className={field}
          />
        )}
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
        {linkError && mode !== "cadastrar" && !sent && (
          <p className="text-sm text-brand-ink">O link de nova senha venceu ou já foi usado. Peça outro em “Esqueci minha senha”.</p>
        )}
        {error && <p className="text-sm text-brand-ink">{error}</p>}
        {sent ? (
          <div className="grid gap-2">
            <p className="rounded-lg bg-brand/15 px-3 py-2 text-sm font-semibold">
              Pronto! Se existir uma conta com esse e-mail, o link para criar a nova senha chega em alguns minutos.
            </p>
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              📩 <b>Não achou o e-mail?</b> Olhe também na caixa de <b>spam</b> ou <b>lixo eletrônico</b> (no Gmail, veja
              também a aba Promoções). Se estiver lá, marque como &quot;não é spam&quot;.
            </p>
          </div>
        ) : (
          <button disabled={busy} className="rounded-xl bg-accent py-3 font-black text-white hover:bg-accent-dark disabled:opacity-60">
            {busy ? "Aguarde…" : mode === "entrar" ? "Entrar" : mode === "cadastrar" ? "Criar conta" : "Enviar link de nova senha"}
          </button>
        )}
        {mode === "entrar" && (
          <button type="button" onClick={() => { setMode("recuperar"); setError(""); }} className="justify-self-center text-xs text-foreground/60 underline">
            Esqueci minha senha
          </button>
        )}
        {mode === "recuperar" && (
          <button type="button" onClick={() => { setMode("entrar"); setSent(false); setError(""); }} className="justify-self-center text-xs text-foreground/60 underline">
            Voltar para o login
          </button>
        )}
      </form>
    </div>
  );
}
