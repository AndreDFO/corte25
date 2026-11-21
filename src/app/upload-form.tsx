"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FREE_VIDEOS, FULL_PRICE, MAX_PER_BATCH, MAX_PER_BLOCK, PACKAGES, comboCount } from "@/lib/pricing";

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
  { key: "hooks", title: "Ganchos", one: "Gancho", hint: "Os primeiros segundos, que fazem parar de rolar", color: "var(--color-brand)" },
  { key: "bodies", title: "Corpos", one: "Corpo", hint: "O produto em uso, benefícios, demonstração", color: "var(--color-muted)" },
  { key: "ctas", title: "CTAs", one: "CTA", hint: "O fechamento: chamada para o carrinho", color: "var(--color-accent)" },
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
  const fullCount = Math.min(total, MAX_PER_BATCH);
  const freeCount = Math.min(total, FREE_VIDEOS);

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
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 grid gap-5">
      <h2 className="text-xl font-bold">Criar vídeos</h2>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Nome do produto</span>
        <input
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="Ex.: Mini processador elétrico"
          className="rounded-lg bg-black/40 border border-white/15 px-3 py-2.5 outline-none focus:border-brand"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">
          Detalhes e oferta <span className="text-white/40">(opcional, melhora os textos)</span>
        </span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={2}
          placeholder="Ex.: recarregável por USB, pica alho em 5 segundos, de R$ 89 por R$ 39"
          className="rounded-lg bg-black/40 border border-white/15 px-3 py-2.5 outline-none focus:border-brand"
        />
      </label>

      <div className="grid gap-3">
        <span className="text-sm font-medium">
          Seus clipes <span className="text-white/40">(até {MAX_PER_BLOCK} de cada bloco)</span>
        </span>
        {BLOCKS.map((b) => (
          <div key={b.key} className="rounded-xl border p-3 grid gap-2" style={{ borderColor: `color-mix(in srgb, ${b.color} 35%, transparent)` }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold" style={{ color: b.color }}>
                {b.title} <span className="text-white/50 font-normal">({clips[b.key].length})</span>
              </span>
              <span className="text-xs text-white/40 text-right">{b.hint}</span>
            </div>
            {clips[b.key].map((f, i) => (
              <div key={i} className="flex justify-between gap-3 rounded-md bg-white/5 px-3 py-1.5 text-sm">
                <span className="truncate">
                  {b.one} {i + 1}: {f.name}
                </span>
                <button type="button" onClick={() => remove(b.key, i)} className="text-white/50 hover:text-brand">
                  remover
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
                className="cursor-pointer rounded-lg border border-dashed border-white/20 hover:border-white/50 py-2.5 text-center text-sm text-white/60"
              >
                <input type="file" accept="video/*" multiple hidden onChange={(e) => add(b.key, e.target.files)} />+
                Adicionar {b.key === "ctas" ? b.title : b.title.toLowerCase()}
              </label>
            )}
          </div>
        ))}
        <div className="rounded-xl bg-brand/10 border border-brand/30 px-4 py-3 text-center">
          <span className="text-white/60 text-sm">
            {clips.hooks.length} × {clips.bodies.length} × {clips.ctas.length} ={" "}
          </span>
          <span className="text-2xl font-extrabold">{total}</span>
          <span className="text-white/60 text-sm"> vídeos possíveis</span>
          {total > MAX_PER_BATCH && (
            <p className="text-xs text-white/40 mt-1">Cada lote gera até {MAX_PER_BATCH} vídeos.</p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Duração máxima de cada vídeo</span>
        <div className="grid grid-cols-5 gap-2">
          {[
            ["auto", "Livre"],
            ["15", "15 s"],
            ["20", "20 s"],
            ["25", "25 s"],
            ["30", "30 s"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDuration(value)}
              className={`rounded-lg border py-2 text-sm font-semibold ${duration === value ? "border-brand bg-brand/15" : "border-white/15 hover:bg-white/5"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-white/40">
          {duration === "auto"
            ? "Usa os clipes inteiros."
            : `Se passar de ${duration} s, o corpo é encurtado. Gancho e CTA ficam inteiros.`}
        </span>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium">
          Música de fundo <span className="text-white/40">(opcional, use uma que você tem direito de usar)</span>
        </span>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setMusic(e.target.files?.[0] || null)}
          className="text-sm text-white/70 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setPlan("free")}
          className={`rounded-xl border p-3 text-left ${plan === "free" ? "border-accent bg-accent/10" : "border-white/15 hover:bg-white/5"}`}
        >
          <span className="block font-bold">Teste grátis</span>
          <span className="block text-sm text-white/60">{FREE_VIDEOS} vídeos, com marca d&apos;água</span>
        </button>
        <button
          type="button"
          onClick={() => setPlan("full")}
          className={`rounded-xl border p-3 text-left ${plan === "full" ? "border-brand bg-brand/10" : "border-white/15 hover:bg-white/5"}`}
        >
          <span className="block font-bold">Lote completo</span>
          <span className="block text-sm text-white/60">
            {fullCount ? `${fullCount} vídeos` : "Todas as combinações"} · {FULL_PRICE}
          </span>
        </button>
      </div>

      {error && <p className="text-sm text-brand">{error}</p>}

      <button
        disabled={sending}
        className={`rounded-xl disabled:opacity-60 font-bold py-3 text-lg ${plan === "free" ? "bg-accent text-on-accent hover:bg-accent-dark" : "bg-brand text-on-brand hover:bg-brand-dark"}`}
      >
        {sending
          ? `Enviando… ${progress}%`
          : plan === "free"
            ? `Gerar ${freeCount === 1 ? "1 vídeo" : `${FREE_VIDEOS} vídeos`} grátis`
            : `🔒 Gerar ${fullCount ? `${fullCount} ` : ""}vídeos · ${FULL_PRICE}`}
      </button>
      {plan === "free" && <p className="-mt-2 text-center text-xs text-white/40">1 teste grátis por pessoa.</p>}

      {payOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5" onClick={() => setPayOpen(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-6 grid gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold">Compre créditos</h3>
            <p className="text-white/70 text-sm">
              Cada crédito gera um lote completo: todas as combinações dos seus ganchos, corpos e CTAs (até{" "}
              {MAX_PER_BATCH} vídeos), sem marca d&apos;água, com legendas e download em ZIP.
            </p>
            {PACKAGES.map((p) => (
              <button
                key={p.credits}
                type="button"
                disabled
                className={`rounded-xl border p-4 text-left opacity-80 ${p.best ? "border-brand bg-brand/10" : "border-white/15"}`}
              >
                <span className="flex items-baseline justify-between">
                  <span className="font-bold">{p.credits} lotes</span>
                  <span className="text-lg font-extrabold">{p.price}</span>
                </span>
                <span className="block text-xs text-white/50">
                  {p.perBatch}
                  {p.best ? " · mais econômico" : ""}
                </span>
              </button>
            ))}
            <p className="text-xs text-white/40">
              O pagamento ainda está sendo configurado. Enquanto isso, você pode usar o teste grátis.
            </p>
            <button type="button" onClick={() => setPayOpen(false)} className="text-sm text-white/60 hover:text-white">
              Fechar
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
