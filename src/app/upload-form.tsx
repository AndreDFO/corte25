"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FREE_VIDEOS, FULL_PRICE, FULL_VIDEOS } from "@/lib/pricing";

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

export default function UploadForm() {
  const router = useRouter();
  const [videos, setVideos] = useState<File[]>([]);
  const [music, setMusic] = useState<File | null>(null);
  const [product, setProduct] = useState("");
  const [details, setDetails] = useState("");
  const [duration, setDuration] = useState("mix");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<"free" | "full">("free");
  const [payOpen, setPayOpen] = useState(false);

  function addVideos(list: FileList | null) {
    if (!list) return;
    const added = Array.from(list).filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name));
    setVideos((v) => [...v, ...added].slice(0, 10));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!product.trim()) return setError("Informe o nome do produto.");
    if (videos.length === 0) return setError("Adicione pelo menos 1 vídeo (o ideal são 5).");
    const fd = new FormData();
    fd.append("product", product);
    fd.append("details", details);
    fd.append("duration", duration);
    fd.append("plan", plan);
    fd.append("clientId", clientId());
    videos.forEach((v) => fd.append("videos", v));
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

  const totalMb = videos.reduce((s, v) => s + v.size, 0) / 1024 / 1024;
  const sending = progress !== null;

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 grid gap-5">
      <h2 className="text-xl font-bold">Criar vídeos</h2>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setPlan("free")}
          className={`rounded-xl border p-3 text-left ${plan === "free" ? "border-[#25F4EE] bg-[#25F4EE]/10" : "border-white/15 hover:bg-white/5"}`}
        >
          <span className="block font-bold">Teste grátis</span>
          <span className="block text-sm text-white/60">{FREE_VIDEOS} vídeos, com marca d&apos;água</span>
        </button>
        <button
          type="button"
          onClick={() => setPlan("full")}
          className={`rounded-xl border p-3 text-left ${plan === "full" ? "border-[#FE2C55] bg-[#FE2C55]/10" : "border-white/15 hover:bg-white/5"}`}
        >
          <span className="block font-bold">{FULL_VIDEOS} vídeos</span>
          <span className="block text-sm text-white/60">{FULL_PRICE}, sem marca d&apos;água</span>
        </button>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Nome do produto</span>
        <input
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="Ex.: Mini processador elétrico"
          className="rounded-lg bg-black/40 border border-white/15 px-3 py-2.5 outline-none focus:border-[#FE2C55]"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">
          Detalhes e oferta <span className="text-white/40">(opcional, melhora os hooks)</span>
        </span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          placeholder="Ex.: recarregável por USB, pica alho em 5 segundos, de R$ 89 por R$ 39, frete grátis"
          className="rounded-lg bg-black/40 border border-white/15 px-3 py-2.5 outline-none focus:border-[#FE2C55]"
        />
      </label>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Vídeos do produto (ideal: 5)</span>
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addVideos(e.dataTransfer.files);
          }}
          className="cursor-pointer rounded-xl border-2 border-dashed border-white/20 hover:border-[#25F4EE] p-6 text-center text-white/60"
        >
          <input type="file" accept="video/*" multiple hidden onChange={(e) => addVideos(e.target.files)} />
          Arraste os vídeos aqui ou <span className="text-[#25F4EE] font-semibold">clique para escolher</span>
        </label>
        {videos.length > 0 && (
          <ul className="grid gap-1 text-sm">
            {videos.map((v, i) => (
              <li key={i} className="flex justify-between gap-3 rounded-md bg-white/5 px-3 py-1.5">
                <span className="truncate">{v.name}</span>
                <button
                  type="button"
                  onClick={() => setVideos((all) => all.filter((_, j) => j !== i))}
                  className="text-white/50 hover:text-[#FE2C55]"
                >
                  remover
                </button>
              </li>
            ))}
            <li className="text-white/40 text-xs">
              {videos.length} vídeo(s), {totalMb.toFixed(1)} MB
            </li>
          </ul>
        )}
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Duração dos vídeos</span>
        <div className="grid grid-cols-5 gap-2">
          {[
            ["mix", "Misturar"],
            ["15", "15 s"],
            ["20", "20 s"],
            ["25", "25 s"],
            ["30", "30 s"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDuration(value)}
              className={`rounded-lg border py-2 text-sm font-semibold ${duration === value ? "border-[#FE2C55] bg-[#FE2C55]/15" : "border-white/15 hover:bg-white/5"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-white/40">
          {duration === "mix" ? "7 vídeos de 15 s e 6 de cada: 20 s, 25 s e 30 s." : `Os 25 vídeos com ${duration} segundos.`}
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

      {error && <p className="text-sm text-[#FE2C55]">{error}</p>}

      <button
        disabled={sending}
        className={`rounded-xl disabled:opacity-60 font-bold py-3 text-lg ${plan === "free" ? "bg-[#25F4EE] text-black hover:bg-[#1fd8d3]" : "bg-[#FE2C55] hover:bg-[#e0244a]"}`}
      >
        {sending
          ? `Enviando… ${progress}%`
          : plan === "free"
            ? `Gerar ${FREE_VIDEOS} vídeos grátis`
            : `🔒 Gerar ${FULL_VIDEOS} vídeos · ${FULL_PRICE}`}
      </button>
      {plan === "free" && (
        <p className="-mt-2 text-center text-xs text-white/40">1 teste grátis por pessoa.</p>
      )}

      {payOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5" onClick={() => setPayOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#15151b] p-6 grid gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold">
              {FULL_VIDEOS} vídeos por {FULL_PRICE}
            </h3>
            <p className="text-white/70 text-sm">
              Todos os vídeos sem marca d&apos;água, com hooks, legendas e download em ZIP.
            </p>
            <button disabled className="rounded-xl bg-[#FE2C55] font-bold py-3 opacity-60">
              Pagar com Pix ou cartão (em breve)
            </button>
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
