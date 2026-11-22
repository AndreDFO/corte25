"use client";

import { useRouter } from "next/navigation";
import PlanPicker from "./plan-picker";
import { useEffect, useState } from "react";
import { rememberJob } from "@/lib/my-jobs";
import { BATCH_VIDEOS, FREE_VIDEOS, MAX_PER_BLOCK, PACKAGES, SUBSCRIPTION_OPTIONS, VIDEO_CHOICES, VIDEOS_PER_LOT, bonusFor, comboCount } from "@/lib/pricing";

function clientId() {
  try {
    let id = localStorage.getItem("corte25_cid");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("corte25_cid", id);
    }
    return id;
  } catch {
    return "";
  }
}

const isVideo = (f: File) => f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name);

type BlockKey = "hooks" | "bodies" | "ctas";
// Cada bloco leva para a sua dica em "Como gravar cada bloco" (src/app/dicas.tsx).
const TIP_ID: Record<BlockKey, string> = { hooks: "dica-ganchos", bodies: "dica-corpos", ctas: "dica-ctas" };
const BLOCKS: { key: BlockKey; title: string; one: string; hint: string; color: string }[] = [
  { key: "hooks", title: "Ganchos", one: "Gancho", hint: "Os primeiros segundos, que fazem parar de rolar", color: "var(--color-brand-ink)" },
  { key: "bodies", title: "Corpos", one: "Corpo", hint: "O produto em uso, benefícios, demonstração", color: "var(--color-muted)" },
  { key: "ctas", title: "CTAs", one: "CTA", hint: "O fechamento: chamada para o carrinho", color: "var(--color-accent-ink)" },
];

export default function UploadForm() {
  const router = useRouter();
  const [clips, setClips] = useState<Record<BlockKey, File[]>>({ hooks: [], bodies: [], ctas: [] });
  const [music, setMusic] = useState<File | null>(null);
  const [product, setProduct] = useState("");
  const [details, setDetails] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [duration, setDuration] = useState("auto");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<"free" | "full">("free");
  const [payOpen, setPayOpen] = useState(false);
  // Quantos vídeos gerar no lote completo (desconta só isso do saldo; com 25 ganha +2 grátis).
  const [videos, setVideos] = useState<number>(BATCH_VIDEOS);
  const bonus = bonusFor(videos);
  // Saldo da conta (null = ainda carregando ou sem login ativo no site).
  const [saldo, setSaldo] = useState<{ logged: boolean; videos: number } | null>(null);
  useEffect(() => {
    fetch("/api/conta/saldo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setSaldo(j))
      .catch(() => {});
  }, []);
  const [doneId, setDoneId] = useState("");

  // Teste grátis: 1 gancho, 1 corpo e 1 CTA (pedido do Andre). Lote completo: até MAX_PER_BLOCK.
  const maxPer = plan === "free" ? 1 : MAX_PER_BLOCK;
  function choosePlan(next: "free" | "full") {
    setPlan(next);
    if (next === "free") setClips((c) => ({ hooks: c.hooks.slice(0, 1), bodies: c.bodies.slice(0, 1), ctas: c.ctas.slice(0, 1) }));
  }
  const total = comboCount(clips.hooks.length, clips.bodies.length, clips.ctas.length);

  function add(key: BlockKey, list: FileList | null) {
    if (!list) return;
    const added = Array.from(list).filter(isVideo);
    setClips((c) => ({ ...c, [key]: [...c[key], ...added].slice(0, maxPer) }));
  }

  function remove(key: BlockKey, i: number) {
    setClips((c) => ({ ...c, [key]: c[key].filter((_, j) => j !== i) }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDoneId("");
    if (total === 0) return setError("Adicione pelo menos 1 gancho, 1 corpo e 1 CTA.");
    if (plan === "free" && whatsapp.replace(/\D/g, "").length < 10)
      return setError("Informe seu WhatsApp com DDD para fazer o teste grátis.");
    const fd = new FormData();
    fd.append("product", product);
    fd.append("details", details);
    fd.append("duration", duration);
    fd.append("plan", plan);
    if (plan === "full") fd.append("videos", String(videos));
    if (plan === "free") fd.append("whatsapp", whatsapp);
    fd.append("clientId", clientId());
    (Object.keys(clips) as BlockKey[]).forEach((k) => clips[k].forEach((f) => fd.append(k, f)));
    if (music) fd.append("music", music);

    // Os vídeos abrem numa aba nova (pedido do Andre). A aba é aberta já no clique,
    // senão o navegador bloqueia como pop-up; ela recebe o endereço quando o envio termina.
    const tab = window.open("", "_blank");
    if (tab) {
      tab.document.title = "Corte25 · enviando…";
      tab.document.body.innerHTML =
        '<p style="font:600 18px system-ui;text-align:center;margin-top:30vh;color:#16170f">Enviando seus clipes…<br><small style="font-weight:400;color:#777">Esta aba mostra os vídeos assim que o envio terminar.</small></p>';
    }
    const closeTab = () => tab && !tab.closed && tab.close();

    // XMLHttpRequest para mostrar o progresso do envio.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/jobs");
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      try {
        let res = {} as { id: string; error?: string };
        try {
          res = JSON.parse(xhr.responseText);
        } catch {
          if (xhr.status === 413) throw new Error("Os vídeos ficaram grandes demais. Envie clipes menores.");
          throw new Error(`O servidor não respondeu direito (erro ${xhr.status}). Tente de novo em instantes.`);
        }
        if (xhr.status === 401) {
          closeTab();
          window.location.href = "/entrar?volta=/%23criar";
          return;
        }
        if (xhr.status === 402) {
          closeTab();
          setProgress(null);
          setPayOpen(true);
          return;
        }
        if (xhr.status >= 400) throw new Error(res.error || "Erro no envio");
        rememberJob({ id: res.id, product, createdAt: new Date().toISOString() });
        if (tab && !tab.closed) {
          tab.location.href = `/tarefa/${res.id}`;
          setProgress(null);
          setDoneId(res.id);
        } else router.push(`/tarefa/${res.id}`);
      } catch (err) {
        closeTab();
        setError((err as Error).message);
        setProgress(null);
      }
    };
    xhr.onerror = () => {
      closeTab();
      setError("Falha de conexão no envio.");
      setProgress(null);
    };
    setProgress(0);
    xhr.send(fd);
  }

  const sending = progress !== null;

  return (
    <form
      id="criar"
      onSubmit={submit}
      className="scroll-mt-20 rounded-3xl bg-surface p-5 grid gap-3.5 shadow-[0_20px_60px_-20px_rgba(60,40,160,0.35)] ring-1 ring-foreground/10 border-t-8 border-brand"
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => choosePlan("free")}
          className={`rounded-xl border px-3 py-2 text-left ${plan === "free" ? "border-accent bg-accent/10 ring-2 ring-accent/30" : "border-foreground/15 hover:bg-foreground/5"}`}
        >
          <span className="flex items-center gap-1.5 text-sm font-bold">
            Teste grátis
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-black uppercase text-white">Sem pagar</span>
          </span>
          <span className="block text-xs text-foreground/60">{FREE_VIDEOS} vídeos com marca d&apos;água</span>
        </button>
        <button
          type="button"
          onClick={() => choosePlan("full")}
          className={`rounded-xl border px-3 py-2 text-left ${plan === "full" ? "border-brand bg-brand/10 ring-2 ring-brand/30" : "border-foreground/15 hover:bg-foreground/5"}`}
        >
          <span className="block text-sm font-bold">Lote completo</span>
          <span className="block text-xs text-foreground/60">
            Até {BATCH_VIDEOS} + {FREE_VIDEOS} grátis · usa seu saldo
          </span>
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <input
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="Nome do produto (opcional)"
          aria-label="Nome do produto (opcional)"
          className="rounded-lg bg-field border border-foreground/15 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <input
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Oferta (opcional): de R$ 89 por R$ 39"
          aria-label="Detalhes e oferta"
          className="rounded-lg bg-field border border-foreground/15 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {BLOCKS.map((b) => (
          <div
            key={b.key}
            className="min-w-0 rounded-xl border p-2 max-[380px]:px-1.5 grid grid-cols-[minmax(0,1fr)] gap-1.5 content-start"
            style={{
              borderColor: `color-mix(in srgb, ${b.color} 45%, transparent)`,
              background: `color-mix(in srgb, ${b.color} 8%, transparent)`,
            }}
            title={b.hint}
          >
            <span className="whitespace-nowrap text-[13px] font-bold tracking-tight max-[380px]:text-xs sm:text-sm" style={{ color: b.color }}>
              {b.title} <span className="text-[11px] font-normal text-foreground/50 sm:text-xs">{clips[b.key].length}/{maxPer}</span>
            </span>
            <a href={`#${TIP_ID[b.key]}`} className="-mt-1 text-[10px] font-semibold text-foreground/50 underline hover:text-foreground">
              ver dicas ↓
            </a>
            {clips[b.key].map((f, i) => (
              <div key={i} className="flex min-w-0 items-center gap-1 rounded-md bg-foreground/5 px-2 py-1 text-xs">
                <span className="min-w-0 flex-1 truncate" title={f.name}>
                  ✓ <span className="hidden sm:inline">{b.one} </span>{i + 1}
                </span>
                <button
                  type="button"
                  aria-label="remover"
                  onClick={() => remove(b.key, i)}
                  className="shrink-0 text-foreground/40 hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            ))}
            {clips[b.key].length < maxPer && (
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  add(b.key, e.dataTransfer.files);
                }}
                className="cursor-pointer rounded-lg border border-dashed border-foreground/25 hover:border-foreground/50 py-2 text-center text-xs font-semibold text-foreground/60"
              >
                <input type="file" accept="video/*" multiple={maxPer > 1} hidden onChange={(e) => add(b.key, e.target.files)} />+
                Adicionar
              </label>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl bg-brand/15 border border-brand/40 px-3 py-2 text-sm">
        <span className="text-foreground/60">
          {clips.hooks.length} × {clips.bodies.length} × {clips.ctas.length} →
        </span>
        {plan === "full" && (
          <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-on-brand">{videos} vídeos</span>
        )}
        {(plan === "free" || bonus > 0) && (
          <>
            {plan === "full" && <span className="text-foreground/40">+</span>}
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
              {plan === "full" ? bonus : FREE_VIDEOS} grátis
            </span>
          </>
        )}
        {plan === "free" && (
          <span className="w-full text-center text-[11px] font-semibold text-foreground/60">
            No teste grátis basta 1 gancho, 1 corpo e 1 CTA. Os 2 vídeos saem com textos e legendas diferentes.
          </span>
        )}
        {plan === "full" && total > 0 && total < videos + bonus && (
          <span className="w-full text-center text-[11px] text-foreground/50">
            Com menos de 3 clipes por bloco, algumas combinações se repetem com textos diferentes.
          </span>
        )}
      </div>

      {plan === "full" && (
        <div className="grid gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-xs font-medium text-foreground/60">Quantos vídeos gerar agora</span>
            {saldo?.logged ? (
              <span className="text-sm font-bold">
                Seu saldo: <span className="text-brand-ink">{saldo.videos} vídeos</span>
                {saldo.videos < videos && (
                  <a href="/conta#comprar" className="ml-2 text-xs font-semibold underline">
                    comprar mais
                  </a>
                )}
              </span>
            ) : saldo ? (
              <a href="/entrar?volta=/%23criar" className="text-xs font-semibold underline">
                Entre na sua conta para ver seu saldo
              </a>
            ) : null}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {VIDEO_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setVideos(n)}
                className={`rounded-lg border py-1.5 text-sm font-bold ${videos === n ? "border-brand bg-brand text-on-brand" : "border-foreground/15 hover:bg-foreground/5"} ${saldo?.logged && saldo.videos < n ? "opacity-40" : ""}`}
              >
                {n}
                {bonusFor(n) > 0 && <span className="block text-[10px] font-semibold">+{bonusFor(n)} grátis</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 text-sm">
        <label className="grid min-w-0 gap-1">
          <span className="truncate text-xs font-medium text-foreground/60">Duração máxima</span>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full min-w-0 rounded-lg bg-field border border-foreground/15 px-2 py-2 outline-none focus:border-brand"
          >
            <option value="auto">Livre</option>
            <option value="15">15 segundos</option>
            <option value="20">20 segundos</option>
            <option value="25">25 segundos</option>
            <option value="30">30 segundos</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1">
          <span className="truncate text-xs font-medium text-foreground/60">Música (opcional)</span>
          <span className="flex min-w-0 items-center gap-2 rounded-lg bg-field border border-foreground/15 px-2 py-2 cursor-pointer">
            <input type="file" accept="audio/*" hidden onChange={(e) => setMusic(e.target.files?.[0] || null)} />
            <span className="shrink-0 rounded-md bg-foreground/10 px-2 py-0.5 text-xs font-semibold">Escolher</span>
            <span className="truncate text-xs text-foreground/60">{music ? music.name : "nenhuma"}</span>
          </span>
        </label>
      </div>

      {plan === "free" && (
        <label className="grid gap-1">
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Seu WhatsApp com DDD: (11) 91234-5678"
            aria-label="WhatsApp"
            className="rounded-lg bg-field border border-foreground/15 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <span className="text-[11px] text-foreground/50">
            Usamos só para avisar sobre seus vídeos e novidades do Corte25. Você pode pedir para sair quando quiser.
          </span>
        </label>
      )}

      {error && <p className="text-sm text-brand-ink">{error}</p>}
      {doneId && (
        <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm">
          Enviado! Seus vídeos estão sendo gerados numa aba nova.{" "}
          <a href={`/tarefa/${doneId}`} target="_blank" rel="noopener" className="font-bold text-accent-ink underline">
            Abrir os vídeos
          </a>
        </p>
      )}

      <button
        disabled={sending}
        className={`rounded-xl disabled:opacity-60 font-black py-3 text-lg ${plan === "free" ? "bg-accent text-white hover:bg-accent-dark" : "bg-brand text-on-brand hover:bg-brand-dark"}`}
      >
        {sending
          ? `Enviando… ${progress}%`
          : plan === "free"
            ? `Gerar ${FREE_VIDEOS} vídeos grátis`
            : bonus
              ? `Gerar ${videos} + ${bonus} vídeos grátis`
              : `Gerar ${videos} vídeos`}
      </button>
      {plan === "free" && (
        <p className="-mt-2 text-center text-[11px] text-foreground/40">1 teste grátis por pessoa · sem cartão</p>
      )}

      {payOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5" onClick={() => setPayOpen(false)}>
          <div
            className="w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-2xl border border-foreground/10 bg-surface p-5 grid gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold">Compre créditos</h3>
            <p className="text-foreground/70 text-sm">
              Cada lote vale {VIDEOS_PER_LOT} vídeos de saldo. Você escolhe quantos gerar por vez e, gerando {BATCH_VIDEOS} de uma vez, ganha mais {FREE_VIDEOS} grátis. Tudo combinando seus ganchos, corpos e CTAs, sem marca
              d&apos;água, com legendas e download em ZIP.
            </p>
            <PlanPicker
              avulsos={PACKAGES.map((x) => ({
                id: `pacote-${x.credits}`,
                videos: x.credits * 25,
                price: x.price,
                per: x.perBatch,
                tag: x.tag || (x.best ? "economia" : undefined),
              }))}
              mensais={SUBSCRIPTION_OPTIONS.map((x, i) => ({
                id: x.id,
                videos: x.credits * 25,
                price: x.price,
                per: x.perBatch,
                highlight: i === 0,
                tag: i === 0 ? "popular" : undefined,
              }))}
            />
            <p className="text-xs text-foreground/40">
              Pagamento por Pix, cartão ou boleto, pelo Asaas. Os créditos entram na sua conta assim que o pagamento é confirmado.
            </p>
            <button type="button" onClick={() => setPayOpen(false)} className="text-sm text-foreground/60 hover:text-foreground">
              Fechar
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
