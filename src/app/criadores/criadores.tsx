"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BlocoKey, Plano, RoteiroItem } from "@/lib/roteiro";
import { loadPlano, savePlano } from "@/lib/roteiro-store";
import DicasPostagem from "../dicas-postagem";
import { contaPalavras, limpaFala, quebraFala } from "@/lib/fala";
import { Contagem, Cronometro, RITMOS, TextoLeitura, useLeitura } from "../leitura";

// Área "Criadores": a pessoa escreve o produto e/ou cola o link e recebe o plano completo de gravação
// no modelo do site (3 ganchos, 3 corpos, 3 CTAs), com teleprompter e botão que leva ao gerador.

const BLOCOS: { key: BlocoKey; titulo: string; letra: string; cor: string; dica: string }[] = [
  { key: "ganchos", titulo: "Ganchos", letra: "G", cor: "var(--color-brand-ink)", dica: "Os primeiros segundos" },
  { key: "corpos", titulo: "Corpos", letra: "C", cor: "var(--color-muted)", dica: "O produto em uso" },
  { key: "ctas", titulo: "CTAs", letra: "CTA", cor: "var(--color-accent-ink)", dica: "Chamada para o carrinho" },
];

type Info = { logado: boolean; precisaLogin?: boolean; plano: "anon" | "conta" | "vip"; restantes: number; limite: number };

function planoTexto(p: Plano) {
  const linhas = [`PLANO DE GRAVAÇÃO · ${p.produto}`, p.resumo, ""];
  if (p.publico) linhas.push(`Público: ${p.publico}`, "");
  if (p.pontosFortes.length) linhas.push("Pontos fortes:", ...p.pontosFortes.map((x) => `- ${x}`), "");
  for (const b of BLOCOS) {
    linhas.push(b.titulo.toUpperCase());
    p[b.key].forEach((it, i) =>
      linhas.push(
        `${b.letra}${i + 1} · ${it.angulo} · ~${it.duracao} s (${contaPalavras(it.fala)} palavras)`,
        `Fale: ${limpaFala(it.fala)}`,
        `Na tela: ${it.textoNaTela}`,
        `Enquadramento: ${it.enquadramento}`,
        `Câmera: ${it.camera}`,
        ...it.dicas.map((d) => `Dica: ${d}`),
        `2º take: ${limpaFala(it.variacao)}`,
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
  // Aparecendo no vídeo ou sem aparecer (só produto + narração), pedido do Andre 23/11.
  const [estilo, setEstilo] = useState<"rosto" | "sem_rosto">("rosto");
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
    try {
      const r = JSON.parse(sessionStorage.getItem("corte25_roteiro_rascunho") || "null");
      if (r) {
        setProduto(String(r.produto || ""));
        setLink(String(r.link || ""));
        if (r.estilo === "sem_rosto") setEstilo("sem_rosto");
        sessionStorage.removeItem("corte25_roteiro_rascunho");
      }
    } catch {}
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (info?.precisaLogin) {
      // Só com login (pedido do Andre): guarda o que já foi digitado e volta para cá depois de entrar.
      try {
        sessionStorage.setItem("corte25_roteiro_rascunho", JSON.stringify({ produto, link, estilo }));
      } catch {}
      return router.push("/entrar?volta=/criadores");
    }
    if (produto.trim().length < 3 && !link.trim()) return setErro("Escreva o produto que você quer vender ou cole o link dele.");
    setLoading(true);
    try {
      const r = await fetch("/api/roteiro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ produto, link, estilo }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 && j.login) return router.push("/entrar?volta=/criadores");
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
          <div className="grid gap-1 text-sm font-bold">
            Como você vai gravar?
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["rosto", "🙋 Aparecendo", "Você fala para a câmera"],
                  ["sem_rosto", "🤲 Sem aparecer", "Só o produto e sua voz"],
                ] as const
              ).map(([v, t, d]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEstilo(v)}
                  aria-pressed={estilo === v}
                  className={`rounded-xl border px-3 py-2 text-left ${estilo === v ? "border-accent bg-accent/10 ring-2 ring-accent/30" : "border-foreground/15 hover:bg-foreground/5"}`}
                >
                  <span className="block text-sm font-black">{t}</span>
                  <span className="block text-xs font-normal text-foreground/60">{d}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            disabled={loading}
            className="rounded-xl bg-accent px-5 py-3 text-base font-black text-white shadow-[4px_4px_0_0_var(--brand)] transition hover:translate-y-[-1px] disabled:opacity-60"
          >
            {loading ? "Montando seu plano... (uns 30 s)" : info?.precisaLogin ? "Entrar e criar meu plano" : "Criar meu plano de gravação"}
          </button>
          {erro && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700">
              {erro}{" "}
            </p>
          )}
          <p className="text-center text-xs text-foreground/50">
            {info?.precisaLogin ? (
              <>
                Grátis para quem tem conta (5 planos por dia).{" "}
                <Link href="/entrar?volta=/criadores" className="font-semibold underline">
                  Entrar ou criar conta
                </Link>
                .
              </>
            ) : info ? (
              `Você ainda pode criar ${info.restantes} plano${info.restantes === 1 ? "" : "s"} hoje.`
            ) : (
              "Grátis, com limite por dia."
            )}{" "}
            Se o link não abrir, usamos só o que você escreveu.
          </p>
        </form>
      </div>

      {plano && (
        <div ref={result} className="mt-6 scroll-mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground/50">
                Seu plano de gravação
                <span className="rounded-full bg-accent/15 px-2 py-0.5 normal-case tracking-normal text-accent-ink">
                  {plano.estilo === "sem_rosto" ? "🤲 Sem aparecer · narração" : "🙋 Aparecendo no vídeo"}
                </span>
              </p>
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

          {/* Para quem, pontos fortes e dúvidas: logo no começo, para a pessoa ler antes do roteiro. */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(plano.publico || plano.pontosFortes.length > 0) && (
              <Card titulo="🎯 Público e pontos fortes">
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
              <Card titulo="🤔 Dúvidas do público (responda no vídeo)">
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

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
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

          <DicasPostagem aberto className="mt-3" />

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
        <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-bold" title={`${contaPalavras(it.fala)} palavras, falando no ritmo normal`}>
          ~{it.duracao} s · {contaPalavras(it.fala)} pal.
        </span>
        <button onClick={onPrompter} title="Abrir no teleprompter" aria-label="Abrir no teleprompter" className="shrink-0 rounded-md px-1 text-base hover:bg-foreground/10">
          📜
        </button>
      </div>
      <p className="text-[15px] font-semibold leading-snug">
        “<FalaMarcada s={it.fala} />”
      </p>
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
        <p className="mt-1 text-foreground/80">
          “<FalaMarcada s={it.variacao} />”
        </p>
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

// Fala com as marcas: ênfase em destaque e pausa como um traço discreto.
function FalaMarcada({ s }: { s: string }) {
  return (
    <>
      {quebraFala(s).map((w, i) => (
        <span key={i}>
          {i > 0 && " "}
          {w.enfase ? <span className="rounded bg-brand/40 px-0.5">{w.t}</span> : w.t}
          {w.pausa && <span className="text-foreground/30"> /</span>}
        </span>
      ))}
    </>
  );
}

// Teleprompter (refeito 23/11 a pedido do Andre): letra grande, contagem regressiva 3-2-1,
// a palavra da vez acende no ritmo da fala (pausas marcadas com /, ênfase em verde), cronômetro
// com o tempo do take, velocidade e tamanho da letra ajustáveis e modo espelhado.
function Teleprompter({ plano, start, onClose }: { plano: Plano; start: { k: BlocoKey; i: number }; onClose: () => void }) {
  const lista = BLOCOS.flatMap((b) => plano[b.key].map((it, i) => ({ it, rotulo: `${b.letra}${i + 1}`, k: b.key, i })));
  const [pos, setPos] = useState(Math.max(0, lista.findIndex((x) => x.k === start.k && x.i === start.i)));
  const [segundo, setSegundo] = useState(false);
  const [ritmo, setRitmo] = useState(1);
  const [fonte, setFonte] = useState(1);
  const [espelho, setEspelho] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const atual = lista[pos];
  const texto = segundo ? atual.it.variacao : atual.it.fala;
  const L = useLeitura(texto, RITMOS[ritmo].wps);
  const { parar } = L;
  const ir = (p: number) => {
    parar();
    setPos(Math.max(0, Math.min(lista.length - 1, p)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") ir(pos + 1);
      if (e.key === "ArrowLeft") ir(pos - 1);
      if (e.key === " ") {
        e.preventDefault();
        if (L.estado === "lendo" || L.estado === "contagem") L.parar();
        else L.iniciar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tamanhos = ["text-[30px] sm:text-[44px]", "text-[38px] sm:text-[56px]", "text-[48px] sm:text-[72px]"];
  const rodando = L.estado === "lendo" || L.estado === "contagem";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f1011] text-white" role="dialog" aria-label="Teleprompter">
      <div className="flex items-center gap-2 px-3 py-2.5 text-sm sm:px-5">
        <span className="rounded-md px-2 py-0.5 font-black text-[#101106]" style={{ background: atual.k === "ctas" ? "#8b7bff" : "#c8f135" }}>
          {atual.rotulo}
        </span>
        <span className="min-w-0 flex-1 truncate font-bold">
          {atual.it.angulo}
          <span className="font-normal text-white/50"> · {contaPalavras(texto)} palavras</span>
        </span>
        <Cronometro ms={L.ms} alvo={L.alvo} />
        <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1.5 font-bold" aria-label="Fechar">
          ✕
        </button>
      </div>
      <div className="h-1 bg-white/10">
        <div className="h-full bg-[#c8f135] transition-all" style={{ width: `${L.palavras.length ? (Math.max(0, L.idx) / L.palavras.length) * 100 : 0}%` }} />
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div ref={box} className="absolute inset-0 overflow-y-auto px-5 pb-[50vh] pt-[8vh] sm:px-16" style={espelho ? { transform: "scaleX(-1)" } : undefined}>
          <TextoLeitura palavras={L.palavras} idx={L.idx} estado={L.estado} scroller={box} className={`mx-auto max-w-4xl text-center ${tamanhos[fonte]}`} />
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-white/45 sm:text-base">
            🎥 {atual.it.enquadramento} · 📱 {atual.it.camera}
          </p>
        </div>
        {L.estado === "contagem" && <Contagem conta={L.conta} />}
      </div>

      <div className="grid gap-2 border-t border-white/10 px-3 py-3 text-sm sm:px-6">
        <div className="flex items-center justify-center gap-2">
          <button disabled={pos === 0} onClick={() => ir(pos - 1)} className="rounded-lg bg-white/10 px-3 py-2.5 font-bold disabled:opacity-30" aria-label="Take anterior">
            ←
          </button>
          {rodando ? (
            <button onClick={L.parar} className="min-w-40 rounded-xl bg-white px-5 py-2.5 text-base font-black text-[#101106]">
              ■ Parar
            </button>
          ) : (
            <button onClick={L.iniciar} className="min-w-40 rounded-xl bg-[#c8f135] px-5 py-2.5 text-base font-black text-[#101106]">
              {L.estado === "fim" ? "↻ De novo" : "▶ Começar"}
            </button>
          )}
          <button disabled={pos === lista.length - 1} onClick={() => ir(pos + 1)} className="rounded-lg bg-white/10 px-3 py-2.5 font-bold disabled:opacity-30" aria-label="Próximo take">
            →
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
          <div className="flex rounded-lg bg-white/10 p-0.5">
            {RITMOS.map((r, i) => (
              <button key={r.nome} onClick={() => setRitmo(i)} className={`rounded-md px-2.5 py-1.5 font-bold ${ritmo === i ? "bg-[#8b7bff]" : "text-white/70"}`}>
                {r.nome}
              </button>
            ))}
          </div>
          <button onClick={() => setFonte((f) => (f + 1) % 3)} className="rounded-lg bg-white/10 px-2.5 py-2 font-bold" aria-label="Tamanho da letra">
            A{["", "+", "++"][fonte]}
          </button>
          <button
            onClick={() => {
              parar();
              setSegundo(!segundo);
            }}
            className={`rounded-lg px-2.5 py-2 font-bold ${segundo ? "bg-[#8b7bff]" : "bg-white/10"}`}
          >
            2º take
          </button>
          <button onClick={() => setEspelho(!espelho)} className={`rounded-lg px-2.5 py-2 font-bold ${espelho ? "bg-[#8b7bff]" : "bg-white/10"}`}>
            Espelhar
          </button>
        </div>
        <p className="text-center text-[11px] text-white/40">
          <span className="text-[#c8f135]">Verde</span> = fale com ênfase · <span className="text-[#8b7bff]">/</span> = respire ou pause
        </p>
      </div>
    </div>
  );
}
