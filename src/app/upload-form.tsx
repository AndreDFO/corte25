"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UploadForm() {
  const router = useRouter();
  const [videos, setVideos] = useState<File[]>([]);
  const [music, setMusic] = useState<File | null>(null);
  const [product, setProduct] = useState("");
  const [details, setDetails] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

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
    videos.forEach((v) => fd.append("videos", v));
    if (music) fd.append("music", music);

    // XMLHttpRequest para mostrar o progresso do envio.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/jobs");
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
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
      <h2 className="text-xl font-bold">Criar 25 vídeos</h2>

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
        className="rounded-xl bg-[#FE2C55] hover:bg-[#e0244a] disabled:opacity-60 font-bold py-3 text-lg"
      >
        {sending ? `Enviando… ${progress}%` : "Gerar 25 vídeos"}
      </button>
    </form>
  );
}
