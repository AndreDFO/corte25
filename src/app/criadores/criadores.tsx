"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BlocoKey, Plano, RoteiroItem } from "@/lib/roteiro";
import { loadPlano, savePlano } from "@/lib/roteiro-store";

// Área "Criadores": a pessoa escreve o produto e/ou cola o link e recebe o plano completo de gravação
// no modelo do site (3 ganchos, 3 corpos, 3 CTAs), com teleprompter e botão que leva ao gerador.

const BLOCOS: { key: BlocoKey; titulo: string; letra: string; cor: string; dica: string }[] = [
  { key: "ganchos", titulo: "Ganchos", letra: "G", cor: "var(--color-brand-ink)", dica: "Os primeiros segundos" },
  { key: "corpos", titulo: "Corpos", letra: "C", cor: "var(--color-muted)", dica: "O produto em uso" },
  { key: "ctas", titulo: "CTAs", letra: "CTA", cor: "var(--color-accent-ink)", dica: "Chamada para o carrinho" },
];

type Info = { logado: boolean; plano: "anon" | "conta" | "vip"; restantes: number; limite: number };

function planoTexto(p: Plano) {
  const linhas = [`PLANO DE GRAVAÇÃO · ${p.produto}`, p.resumo, ""];
  if (p.publico) linhas.push(`Público: ${p.publico}`, "");
  if (p.pontosFortes.length) linhas.push("Pontos fortes:", ...p.pontosFortes.map((x) => `- ${x}`), "");
  for (const b of BLOCOS) {
    linhas.push(b.titulo.toUpperCase());
    p[b.key].forEach((it, i) =>
      linhas.push(
        `${b.letra}${i + 1} · ${it.angulo} · ${it.duracao} s`,
        `Fale: ${it.fala}`,
        `Na tela: ${it.textoNaTela}`,
        `Enquadramento: ${it.enquadramento}`,
        `Câmera: ${it.camera}`,
        ...it.dicas.map((d) => `Dica: ${d}`),
        `2º take: ${it.variacao}`,
        "",
      ),
    );
  }
  linhas.push(`Legenda: ${p.legenda}`, `Hashtags: ${p.hashtags.map((h) => `#${h}`).join(" ")}`, `Som: ${p.som}`);
  return linhas.join("\n");
}

export default function Criadores() {
  const router = useRouter();
  const [produto, setProduto] = useState("");
  const [link, setLink] = useState("");
  const [plano, setPlano] = useState<Plano | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<BlocoKey>("ganchos");
  const [prompter, setPrompter] = useState<{ k: BlocoKey; i: number } | null>(null);
  const [copiado, setCopiado] = useState("");
  const result = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Lê o último plano guardado no navegador (só existe no navegador, por isso depois de montar a tela).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlano(loadPlano());
    fetch("/api/roteiro", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setInfo(j))
      .catch(() => {});
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (produto.trim().length < 3 && !link.trim()) return setErro("Escreva o produto que você quer vender ou cole o link dele.");
    setLoading(true);
    try {
      const r = await fetch("/api/roteiro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ produto, link }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.plano) throw new Error(j.error || "Não deu para criar o plano agora. Tente de novo.");
      setPlano(j.plano);
      savePlano(j.plano);
      setAba("ganchos");
      setInfo((i) => (i ? { ...i, restantes: j.restantes } : i));
      setTimeout(() => result.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copiar(texto: string, qual: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(""), 1800);
    } catch {}
  }

  function irGravar() {
    if (plano) savePlano(plano);
    router.push("/#criar");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-5 lg:py-7">
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
        <section>
          <p className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-white shadow-sm">🎬 Área dos criadores</span>
            <span className="text-xs font-semibold text-foreground/50">grátis</span>
          </p>
          <h1 className="text-[28px] font-black leading-[1.05] tracking-tight sm:text-[38px]">
            Não sabe o que gravar?{" "}
            <span className="inline-block -rotate-1 rounded-xl bg-brand px-2 text-on-brand shadow-[3px_3px_0_0_var(--accent)]">A gente monta o plano.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-foreground/70 sm:text-base">
            Diga o produto ou cole o link. Você recebe o roteiro de 3 ganchos, 3 corpos e 3 CTAs, com o que falar, enquadramento, ângulo da câmera e tempo de cada take.
          </p>
          <ul className="mt-3 hidden grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-foreground/80 lg:grid">
            {["O que falar + 2º take diferente", "Enquadramento e câmera", "Público, pontos fortes e dúvidas", "Checklist: cenário, luz e roupa", "Legenda, hashtags e som", "Teleprompter para ler a fala"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-xs font-black text-on-brand">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </section>

        <form onSubmit={criar} className="grid gap-2.5 rounded-2xl bg-surface p-4 shadow-lg ring-1 ring-foreground/10">
          <label className="grid gap-1 text-sm font-bold">
            Qual produto você quer vender?
            <textarea
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              rows={2}
              maxLength={600}
              placeholder="Ex.: garrafa térmica de 1 litro, mantém gelado o dia todo, cor rosa"
              className="resize-none rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm font-normal outline-none focus:border-brand"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            <span>
              Link do produto <span className="font-normal text-foreground/50">(opcional: TikTok Shop, Shopee, Mercado Livre...)</span>
            </span>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              inputMode="url"
              placeholder="Cole o link aqui"
              className="rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm font-normal outline-none focus:border-brand"
            />
          </label>
          <button
            disabled={loading}
            className="rounded-xl bg-accent px-5 py-3 text-base font-black text-white shadow-[4px_4px_0_0_var(--brand)] transition hover:translate-y-[-1px] disabled:opacity-60"
          >
            {loading ? "Montando seu plano... (uns 30 s)" : "Criar meu plano de gravação"}
          </button>
          {erro && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700">
              {erro}{" "}
              {info && !info.logado && /Entre/.test(erro) && (
                <Link href="/entrar?volta=/criadores" className="underline">
                  Entrar
                </Link>
              )}
            </p>
          )}
          <p className="text-center text-xs text-foreground/50">
            {info ? `Você ainda pode criar ${info.restantes} plano${info.restantes === 1 ? "" : "s"} hoje.` : "Grátis, com limite por dia."}{" "}
            {info && !info.logado && (
              <>
                <Link href="/entrar?volta=/criadores" className="font-semibold underline">
                  Entre
                </Link>{" "}
                para ter 5 por dia.
              </>
            )}
            {" "}Se o link não abrir, usamos só o que você escreveu.
          </p>
        </form>
      </div>

      {plano && (
        <div ref={result} className="mt-6 scroll-mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground/50">Seu plano de gravação</p>
              <h2 className="text-2xl font-black leading-tight">{plano.produto}</h2>
              {plano.resumo && <p className="text-sm text-foreground/70">{plano.resumo}</p>}
              {plano.fonte === "modelo" && <p className="text-xs text-foreground/50">Plano básico (a IA não respondeu agora). Tente de novo mais tarde para um plano sob medida.</p>}
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <button onClick={irGravar} className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-on-brand shadow-[3px_3px_0_0_var(--accent)] hover:bg-brand-dark sm:w-auto">
                🎥 Gravar e montar os vídeos →
              </button>
              <button onClick={() => copiar(planoTexto(plano), "tudo")} className="flex-1 rounded-xl border border-foreground/20 px-3 py-2.5 text-sm font-bold hover:bg-foreground/5 sm:flex-none">
                {copiado === "tudo" ? "Copiado ✓" : "Copiar plano"}
              </button>
              <button onClick={() => setPrompter({ k: "ganchos", i: 0 })} className="flex-1 rounded-xl border border-foreground/20 px-3 py-2.5 text-sm font-bold hover:bg-foreground/5 sm:flex-none">
                📜 Teleprompter
              </button>
            </div>
          </div>

          {/* Celular: um bloco por vez (abas). PC: os 3 blocos lado a lado. */}
          <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-foreground/5 p-1 lg:hidden">
            {BLOCOS.map((b) => (
              <button
                key={b.key}
                onClick={() => setAba(b.key)}
                className={`rounded-lg py-2 text-sm font-bold ${aba === b.key ? "bg-surface shadow-sm" : "text-foreground/60"}`}
                style={aba === b.key ? { color: b.cor } : undefined}
              >
                {b.titulo}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {BLOCOS.map((b) => (
              <section key={b.key} className={`${aba === b.key ? "grid" : "hidden"} content-start gap-2 lg:grid`}>
                <h3 className="hidden items-baseline gap-2 text-base font-black lg:flex" style={{ color: b.cor }}>
                  {b.titulo} <span className="text-xs font-semibold text-foreground/50">{b.dica}</span>
                </h3>
                {plano[b.key].map((it, i) => (
                  <Take key={i} it={it} cor={b.cor} rotulo={`${b.letra}${i + 1}`} onPrompter={() => setPrompter({ k: b.key, i })} />
                ))}
              </section>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-foreground/50">
            Grave cada take separado. No gerador, o Corte25 mistura tudo: {plano.ganchos.length} × {plano.corpos.length} × {plano.ctas.length} = 27 vídeos diferentes.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(plano.publico || plano.pontosFortes.length > 0) && (
              <Card titulo="🎯 Para quem e o que mostrar">
                {plano.publico && <p>{plano.publico}</p>}
                {plano.pontosFortes.length > 0 && (
                  <ul className="mt-1.5 grid gap-1">
                    {plano.pontosFortes.map((x) => (
                      <li key={x} className="flex gap-1.5">
                        <span className="text-brand-ink">✓</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
            {plano.objecoes.length > 0 && (
              <Card titulo="🤔 Dúvidas que travam a compra">
                <ul className="grid gap-1.5">
                  {plano.objecoes.map((o) => (
                    <li key={o.duvida}>
                      <b>{o.duvida}</b>
                      <br />
                      <span className="text-foreground/70">{o.resposta}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card titulo="✅ Antes de gravar">
              <Check texto={`Cenário: ${plano.checklist.cenario}`} />
              <Check texto={`Luz: ${plano.checklist.luz}`} />
              <Check texto={`Roupa: ${plano.checklist.roupa}`} />
              {plano.checklist.objetos.map((o) => (
                <Check key={o} texto={o} />
              ))}
              <Check texto="Celular em pé (9:16) e lente limpa" />
            </Card>
            <Card titulo="📲 Para postar">
              <p>{plano.legenda}</p>
              <p className="mt-1 font-semibold text-accent-ink">{plano.hashtags.map((h) => `#${h}`).join(" ")}</p>
              <button
                onClick={() => copiar(`${plano.legenda}\n\n${plano.hashtags.map((h) => `#${h}`).join(" ")}`, "post")}
                className="mt-2 rounded-lg border border-foreground/20 px-2.5 py-1 text-xs font-bold hover:bg-foreground/5"
              >
                {copiado === "post" ? "Copiado ✓" : "Copiar legenda"}
              </button>
              <p className="mt-2 text-foreground/70">
                🎵 <b>Som:</b> {plano.som}
              </p>
            </Card>
          </div>

          <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl border border-brand/40 bg-brand/15 p-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-sm">
              <b>Gravou?</b> Suba cada take no bloco certo. Na página do gerador, cada bloco mostra a fala do próximo take.
            </p>
            <button onClick={irGravar} className="w-full shrink-0 rounded-xl bg-accent px-5 py-2.5 text-sm font-black text-white sm:w-auto">
              Ir para o gerador →
            </button>
          </div>
        </div>
      )}

      {plano && prompter && <Teleprompter plano={plano} start={prompter} onClose={() => setPrompter(null)} />}
    </div>
  );
}

function Take({ it, cor, rotulo, onPrompter }: { it: RoteiroItem; cor: string; rotulo: string; onPrompter: () => void }) {
  return (
    <article
      className="grid gap-1.5 rounded-xl border p-3 text-sm"
      style={{ borderColor: `color-mix(in srgb, ${cor} 40%, transparent)`, background: `color-mix(in srgb, ${cor} 6%, var(--surface))` }}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-md px-1.5 py-0.5 text-xs font-black text-white" style={{ background: cor }}>
          {rotulo}
        </span>
        <b className="min-w-0 flex-1 truncate">{it.angulo}</b>
        <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-bold">{it.duracao} s</span>
        <button onClick={onPrompter} title="Abrir no teleprompter" aria-label="Abrir no teleprompter" className="shrink-0 rounded-md px-1 text-base hover:bg-foreground/10">
          📜
        </button>
      </div>
      <p className="text-[15px] font-semibold leading-snug">“{it.fala}”</p>
      <p className="text-xs">
        <span className="rounded bg-foreground px-1.5 py-0.5 font-bold text-background">Na tela</span> {it.textoNaTela}
      </p>
      <p className="text-xs text-foreground/75">
        🎥 {it.enquadramento}
        <br />
        📱 {it.camera}
      </p>
      {it.dicas.length > 0 && <p className="text-xs text-foreground/60">💡 {it.dicas.join(" · ")}</p>}
      <details className="text-xs">
        <summary className="cursor-pointer font-bold text-accent-ink">2º take (outra forma de falar)</summary>
        <p className="mt-1 text-foreground/80">“{it.variacao}”</p>
      </details>
    </article>
  );
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-surface p-3 text-sm shadow-sm ring-1 ring-foreground/10">
      <h3 className="mb-1.5 font-black">{titulo}</h3>
      {children}
    </section>
  );
}

function Check({ texto }: { texto: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 py-0.5">
      <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" />
      <span>{texto}</span>
    </label>
  );
}

// Teleprompter: fala em letra grande, rolando sozinha. Serve para ler no PC ou num segundo celular enquanto grava.
function Teleprompter({ plano, start, onClose }: { plano: Plano; start: { k: BlocoKey; i: number }; onClose: () => void }) {
  const lista = BLOCOS.flatMap((b) => plano[b.key].map((it, i) => ({ it, rotulo: `${b.letra}${i + 1}`, titulo: b.titulo, cor: b.cor, k: b.key, i })));
  const [pos, setPos] = useState(Math.max(0, lista.findIndex((x) => x.k === start.k && x.i === start.i)));
  const [segundo, setSegundo] = useState(false);
  const [rolando, setRolando] = useState(false);
  const [vel, setVel] = useState(2);
  const box = useRef<HTMLDivElement>(null);
  const atual = lista[pos];

  useEffect(() => {
    box.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRolando(false);
  }, [pos, segundo]);
  useEffect(() => {
    if (!rolando) return;
    const t = setInterval(() => box.current?.scrollBy({ top: vel }), 40);
    return () => clearInterval(t);
  }, [rolando, vel]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setPos((p) => Math.min(lista.length - 1, p + 1));
      if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 1));
      if (e.key === " ") {
        e.preventDefault();
        setRolando((r) => !r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lista.length, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f1011] text-white" role="dialog" aria-label="Teleprompter">
      <div className="flex items-center gap-2 px-4 py-3 text-sm">
        <span className="rounded-md px-2 py-0.5 font-black text-[#101106]" style={{ background: atual.k === "ctas" ? "#8b7bff" : "#c8f135" }}>
          {atual.rotulo}
        </span>
        <span className="min-w-0 flex-1 truncate font-bold">
          {atual.titulo} · {atual.it.angulo} · {atual.it.duracao} s
        </span>
        <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1.5 font-bold">
          Fechar ✕
        </button>
      </div>
      <div ref={box} className="flex-1 overflow-y-auto px-6 pb-[60vh] pt-[12vh] sm:px-16" onClick={() => setRolando((r) => !r)}>
        <p className="mx-auto max-w-3xl text-center text-[34px] font-bold leading-snug sm:text-[52px]">{segundo ? atual.it.variacao : atual.it.fala}</p>
        <p className="mx-auto mt-6 max-w-3xl text-center text-base text-white/50">🎥 {atual.it.enquadramento} · 📱 {atual.it.camera}</p>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-t border-white/10 px-3 py-3 text-sm sm:px-6">
        <button disabled={pos === 0} onClick={() => setPos(pos - 1)} className="rounded-lg bg-white/10 px-3 py-2 font-bold disabled:opacity-30">
          ←
        </button>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => setRolando(!rolando)} className="rounded-lg bg-[#c8f135] px-4 py-2 font-black text-[#101106]">
            {rolando ? "⏸ Pausar" : "▶ Rolar"}
          </button>
          <button onClick={() => setVel((v) => Math.max(1, v - 1))} className="rounded-lg bg-white/10 px-2.5 py-2 font-bold" aria-label="mais devagar">
            −
          </button>
          <span className="w-14 text-center text-xs text-white/60">vel. {vel}</span>
          <button onClick={() => setVel((v) => Math.min(6, v + 1))} className="rounded-lg bg-white/10 px-2.5 py-2 font-bold" aria-label="mais rápido">
            +
          </button>
          <button onClick={() => setSegundo(!segundo)} className={`rounded-lg px-3 py-2 font-bold ${segundo ? "bg-[#8b7bff]" : "bg-white/10"}`}>
            2º take
          </button>
        </div>
        <button disabled={pos === lista.length - 1} onClick={() => setPos(pos + 1)} className="rounded-lg bg-white/10 px-3 py-2 font-bold disabled:opacity-30">
          →
        </button>
      </div>
    </div>
  );
}
