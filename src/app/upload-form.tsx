"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BATCH_VIDEOS, FREE_VIDEOS, FULL_PRICE, MAX_PER_BLOCK, PACKAGES, comboCount } from "@/lib/pricing";

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
  const [duration, setDuration] = useState("auto");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<"free" | "full">("free");
  const [payOpen, setPayOpen] = useState(false);

  const total = comboCount(clips.hooks.length, clips.bodies.length, clips.ctas.length);

  function add(key: BlockKey, list: FileList | null) {
    if (!list) return;
    const added = Array.from(list).filter(isVideo);
    setClips((c) => ({ ...c, [key]: [...c[key], ...added].slice(0, MAX_PER_BLOCK) }));
  }

  function remove(key: BlockKey, i: number) {
    setClips((c) => ({ ...c, [key]: c[key].filter((_, j) => j !== i) }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!product.trim()) return setError("Informe o nome do produto.");
    if (total === 0) return setError("Adicione pelo menos 1 gancho, 1 corpo e 1 CTA.");
    const fd = new FormData();
    fd.append("product", product);
    fd.append("details", details);
    fd.append("duration", duration);
    fd.append("plan", plan);
    fd.append("clientId", clientId());
    (Object.keys(clips) as BlockKey[]).forEach((k) => clips[k].forEach((f) => fd.append(k, f)));
    if (music) fd.append("music", music);

    // XMLHttpRequest para mostrar o progresso do envio.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/jobs");
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status === 402) {
          setProgress(null);
          setPayOpen(true);
          return;
        }
        if (xhr.status >= 400) throw new Error(res.error || "Erro no envio");
        router.push(`/tarefa/${res.id}`);
      } catch (err) {
        setError((err as Error).message);
        setProgress(null);
      }
    };
    xhr.onerror = () => {
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
          onClick={() => setPlan("free")}
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
          onClick={() => setPlan("full")}
          className={`rounded-xl border px-3 py-2 text-left ${plan === "full" ? "border-brand bg-brand/10 ring-2 ring-brand/30" : "border-foreground/15 hover:bg-foreground/5"}`}
        >
          <span className="block text-sm font-bold">Lote completo</span>
          <span className="block text-xs text-foreground/60">
            {BATCH_VIDEOS} + {FREE_VIDEOS} grátis · {FULL_PRICE}
          </span>
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <input
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="Nome do produto"
          aria-label="Nome do produto"
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
            className="min-w-0 rounded-xl border p-2 grid grid-cols-[minmax(0,1fr)] gap-1.5 content-start"
            style={{
              borderColor: `color-mix(in srgb, ${b.color} 45%, transparent)`,
              background: `color-mix(in srgb, ${b.color} 8%, transparent)`,
            }}
            title={b.hint}
          >
            <span className="text-sm font-bold" style={{ color: b.color }}>
              {b.title} <span className="text-foreground/50 font-normal">{clips[b.key].length}/{MAX_PER_BLOCK}</span>
            </span>
            <a href={`#dica-${b.key}`} className="-mt-1 text-[10px] font-semibold text-foreground/50 underline hover:text-foreground">
              ver dicas
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
            {clips[b.key].length < MAX_PER_BLOCK && (
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  add(b.key, e.dataTransfer.files);
                }}
                className="cursor-pointer rounded-lg border border-dashed border-foreground/25 hover:border-foreground/50 py-2 text-center text-xs font-semibold text-foreground/60"
              >
                <input type="file" accept="video/*" multiple hidden onChange={(e) => add(b.key, e.target.files)} />+
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
        <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-on-brand">{BATCH_VIDEOS} vídeos</span>
        <span className="text-foreground/40">+</span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">{FREE_VIDEOS} grátis</span>
        {total > 0 && total < FREE_VIDEOS + BATCH_VIDEOS && (
          <span className="w-full text-center text-[11px] text-foreground/50">
            Com menos de 3 clipes por bloco, algumas combinações se repetem com textos diferentes.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="grid gap-1">
          <span className="text-xs font-medium text-foreground/60">Duração máxima</span>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="rounded-lg bg-field border border-foreground/15 px-2 py-2 outline-none focus:border-brand"
          >
            <option value="auto">Livre (clipes inteiros)</option>
            <option value="15">15 segundos</option>
            <option value="20">20 segundos</option>
            <option value="25">25 segundos</option>
            <option value="30">30 segundos</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-foreground/60">Música de fundo (opcional)</span>
          <span className="flex items-center gap-2 rounded-lg bg-field border border-foreground/15 px-2 py-2 cursor-pointer">
            <input type="file" accept="audio/*" hidden onChange={(e) => setMusic(e.target.files?.[0] || null)} />
            <span className="rounded-md bg-foreground/10 px-2 py-0.5 text-xs font-semibold">Escolher</span>
            <span className="truncate text-xs text-foreground/60">{music ? music.name : "nenhuma"}</span>
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-brand-ink">{error}</p>}

      <button
        disabled={sending}
        className={`rounded-xl disabled:opacity-60 font-black py-3 text-lg ${plan === "free" ? "bg-accent text-white hover:bg-accent-dark" : "bg-brand text-on-brand hover:bg-brand-dark"}`}
      >
        {sending
          ? `Enviando… ${progress}%`
          : plan === "free"
            ? `Gerar ${FREE_VIDEOS} vídeos grátis`
            : `🔒 Gerar ${BATCH_VIDEOS} + ${FREE_VIDEOS} vídeos · ${FULL_PRICE}`}
      </button>
      {plan === "free" && (
        <p className="-mt-2 text-center text-[11px] text-foreground/40">1 teste grátis por pessoa · sem cartão</p>
      )}

      {payOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5" onClick={() => setPayOpen(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-foreground/10 bg-surface p-6 grid gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold">Compre créditos</h3>
            <p className="text-foreground/70 text-sm">
              Cada crédito gera um lote de {BATCH_VIDEOS} vídeos + {FREE_VIDEOS} de bônus, combinando seus ganchos, corpos e CTAs, sem marca
              d&apos;água, com legendas e download em ZIP.
            </p>
            {PACKAGES.map((p) => (
              <button
                key={p.credits}
                type="button"
                disabled
                className={`rounded-xl border p-4 text-left opacity-80 ${p.best ? "border-brand bg-brand/10" : "border-foreground/15"}`}
              >
                <span className="flex items-baseline justify-between">
                  <span className="font-bold">{p.credits} lotes</span>
                  <span className="text-lg font-extrabold">{p.price}</span>
                </span>
                <span className="block text-xs text-foreground/50">
                  {p.perBatch}
                  {p.best ? " · mais econômico" : ""}
                </span>
              </button>
            ))}
            <p className="text-xs text-foreground/40">
              O pagamento ainda está sendo configurado. Enquanto isso, você pode usar o teste grátis.
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
