"use client";

import { useRouter } from "next/navigation";
import PlanPicker from "./plan-picker";
import { useEffect, useRef, useState } from "react";
import { rememberJob } from "@/lib/my-jobs";
import { BATCH_VIDEOS, FREE_MAX_PER_BLOCK, FREE_VIDEOS, MAX_PER_BLOCK, PACKAGES, SUBSCRIPTION_OPTIONS, VIDEO_CHOICES, VIDEOS_PER_LOT, bonusFor, clipsToReach, comboCount, MIX_RULE, mixOk } from "@/lib/pricing";

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

// "1 gancho e 2 CTAs": quantos vídeos a mais subir em cada bloco.
function describeAdd(add: [number, number, number]) {
  const names = [["gancho", "ganchos"], ["corpo", "corpos"], ["CTA", "CTAs"]];
  const parts = add.map((n, i) => (n ? `${n} ${names[i][n === 1 ? 0 : 1]}` : "")).filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : parts[0];
}

export default function UploadForm() {
  const router = useRouter();
  const [clips, setClips] = useState<Record<BlockKey, File[]>>({ hooks: [], bodies: [], ctas: [] });
  const [music, setMusic] = useState<File | null>(null);
  // Música: "" = sem música, "arquivo" = som de um vídeo/áudio da pessoa, "busca" = música grátis buscada na hora.
  const [track, setTrack] = useState("");
  type Found = { id: string; title: string; seconds: number; creator?: string; preview: string };
  const [picked, setPicked] = useState<Found | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    if (track !== "busca" || suggestions.length) return;
    fetch("/api/musicas")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.suggestions && setSuggestions(j.suggestions))
      .catch(() => {});
  }, [track, suggestions.length]);
  async function searchMusic(q: string) {
    q = q.trim();
    if (q.length < 2) return;
    setQuery(q);
    setSearching(true);
    setSearchErr("");
    try {
      const r = await fetch(`/api/musicas?q=${encodeURIComponent(q)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "A busca falhou.");
      setFound(j.tracks || []);
    } catch (e) {
      setFound(null);
      setSearchErr((e as Error).message);
    } finally {
      setSearching(false);
    }
  }
  const [playing, setPlaying] = useState("");
  const player = useRef<HTMLAudioElement | null>(null);
  function preview(t: Found) {
    if (!player.current) {
      player.current = new Audio();
      player.current.onended = () => setPlaying("");
    }
    const a = player.current;
    if (playing === t.id) {
      a.pause();
      setPlaying("");
      return;
    }
    a.src = t.preview;
    a.currentTime = 0;
    setPlaying(t.id);
    a.play().catch(() => setPlaying(""));
  }
  function chooseTrack(v: string) {
    player.current?.pause();
    setPlaying("");
    setTrack(v);
    if (v !== "arquivo") setMusic(null);
    if (v !== "busca") setPicked(null);
  }
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const [product, setProduct] = useState("");
  const [details, setDetails] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [duration, setDuration] = useState("auto");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  // Toda falha aparece na tela, perto do botão de gerar (pedido do Andre: nunca falhar calado).
  useEffect(() => {
    if (error) document.getElementById("erro-envio")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);
  const [plan, setPlan] = useState<"free" | "full">("free");
  const [payOpen, setPayOpen] = useState(false);
  // Quantos vídeos gerar no lote completo (desconta só isso do saldo; com 25 ganha +2 grátis).
  // "wantVideos" é o que a pessoa escolheu; "videos" é o que dá para gerar sem repetir (ver abaixo, depois de "total").
  const [wantVideos, setVideos] = useState<number>(BATCH_VIDEOS);
  // Saldo da conta (null = ainda carregando ou sem login ativo no site).
  const [saldo, setSaldo] = useState<{ logged: boolean; videos: number; vip?: boolean; vipFeatures?: string[]; vipQuota?: number | null } | null>(null);
  // Recursos VIP (música, textos no vídeo, cortar silêncio): bloqueados para quem não é VIP.
  // Assinante mensal sem VIP: libera no lote pago, valendo para os primeiros vídeos da cota do mês.
  const quota = saldo?.vip ? 0 : (saldo?.vipQuota ?? 0);
  const vip = Boolean(saldo?.vip) || (plan === "full" && quota > 0);
  // Cupom de recursos VIP libera cada recurso escolhido pelo admin.
  const can = (f: string) => vip || Boolean(saldo?.vipFeatures?.includes(f));
  const canMusic = can("musica");
  const canText = can("textos");
  const canTrim = can("silencio");
  const canAuto = can("legenda");
  const canFade = can("transicao");
  const vipHref = saldo?.logged ? "/conta#vip" : "/entrar?volta=/conta%23vip";
  const touched = useRef(false);
  useEffect(() => {
    // Roda toda vez que a tela inicial aparece (o Next guarda a tela ao navegar e volta com o estado antigo).
    touched.current = false;
    fetch("/api/conta/saldo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setSaldo(j);
        // Pedido do Andre: logado começa em "Usar meus créditos"; sem login, fica no grátis.
        if (j.logged) setPlan((p) => (touched.current ? p : "full"));
      })
      .catch(() => {});
  }, []);
  const [doneId, setDoneId] = useState("");
  // Textos gravados no vídeo (gancho e chamada final): opcional, pedido do Andre.
  const [captions, setCaptions] = useState(false);
  const [trimSilence, setTrimSilence] = useState(false);
  const [autoCaptions, setAutoCaptions] = useState(false);
  const [transition, setTransition] = useState(false);

  // Teste grátis: até 3 por bloco, para os 2 vídeos saírem misturados (pedido do Andre). Lote completo: até MAX_PER_BLOCK.
  const maxPer = plan === "free" ? FREE_MAX_PER_BLOCK : MAX_PER_BLOCK;
  function choosePlan(next: "free" | "full") {
    touched.current = true;
    setPlan(next);
    if (next === "free") setClips((c) => ({ hooks: c.hooks.slice(0, FREE_MAX_PER_BLOCK), bodies: c.bodies.slice(0, FREE_MAX_PER_BLOCK), ctas: c.ctas.slice(0, FREE_MAX_PER_BLOCK) }));
  }
  const total = comboCount(clips.hooks.length, clips.bodies.length, clips.ctas.length);
  const mixed = mixOk(clips.hooks.length, clips.bodies.length, clips.ctas.length);
  // Nunca gerar vídeo repetido (pedido do Andre, 22/11): cada vídeo é uma combinação diferente.
  // Só ficam liberadas as quantidades que cabem nas combinações; se a escolhida não cabe, usa a maior que cabe.
  const fits = (VIDEO_CHOICES as readonly number[]).filter((n) => n <= total);
  const videos = total === 0 ? wantVideos : ([...fits].reverse().find((n) => n <= wantVideos) ?? VIDEO_CHOICES[0]);
  const bonus = bonusFor(videos, total);
  const maxGen = fits.length ? fits[fits.length - 1] + bonusFor(fits[fits.length - 1], total) : 0;
  const counts: [number, number, number] = [clips.hooks.length, clips.bodies.length, clips.ctas.length];
  // O que falta subir: para a próxima quantidade travada e, gerando 25, para ganhar os +2 grátis.
  const nextLocked = (VIDEO_CHOICES as readonly number[]).find((n) => n > total);
  const needNext = nextLocked ? clipsToReach(counts, nextLocked, maxPer) : null;
  const needBonus = plan === "full" && videos >= BATCH_VIDEOS && bonus < 2 ? clipsToReach(counts, videos + 2, maxPer) : null;

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
    if (!mixed) return setError(MIX_RULE);
    if ((plan === "full" ? videos : FREE_VIDEOS) > total)
      return setError(`Seus vídeos dão só ${total} combinações diferentes. Suba mais vídeos ou escolha menos vídeos para não repetir.`);
    if (canMusic && track === "busca" && !picked) return setError("Escolha uma música da busca (botão Usar) ou mude para Sem música.");
    if (plan === "free" && whatsapp.replace(/\D/g, "").length < 10)
      return setError("Informe seu WhatsApp com DDD para fazer o teste grátis.");
    const fd = new FormData();
    fd.append("product", product);
    fd.append("details", details);
    fd.append("duration", duration);
    fd.append("captions", captions ? "1" : "0");
    if (trimSilence) fd.append("trimSilence", "1");
    if (autoCaptions) fd.append("autoCaptions", "1");
    if (transition) fd.append("transition", "1");
    fd.append("plan", plan);
    if (plan === "full") fd.append("videos", String(videos));
    if (plan === "free") fd.append("whatsapp", whatsapp);
    fd.append("clientId", clientId());
    (Object.keys(clips) as BlockKey[]).forEach((k) => clips[k].forEach((f) => fd.append(k, f)));
    if (track === "busca" && picked) fd.append("track", picked.id);
    else if (track === "arquivo" && music) fd.append("music", music);

    // Os vídeos abrem numa aba nova (pedido do Andre). A aba é aberta já no clique,
    // senão o navegador bloqueia como pop-up; ela recebe o endereço quando o envio termina.
    const tab = window.open("", "_blank");
    if (tab) {
      tab.document.title = "Corte25 · enviando…";
      tab.document.body.innerHTML =
        '<div style="font-family:system-ui;text-align:center;margin-top:25vh;padding:0 20px;color:#16170f"><p style="font-size:30px;font-weight:900;margin:0">⏳ Enviando seus clipes…</p><p style="font-size:19px;font-weight:700;color:#5b4fd6;margin:18px 0">Seus próximos vídeos de sucesso estão a caminho! 🚀</p><p style="font-size:14px;color:#777">Esta aba mostra os vídeos assim que o envio terminar.</p></div>';
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
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg bg-brand px-2 py-0.5 text-base font-black uppercase tracking-wide text-on-brand shadow-sm">Grátis</span>
            <span className="text-sm font-black">{FREE_VIDEOS} vídeos</span>
          </span>
          <span className="mt-0.5 block text-xs text-foreground/60">Teste sem pagar · com marca d&apos;água</span>
        </button>
        <button
          type="button"
          onClick={() => choosePlan("full")}
          className={`rounded-xl border px-3 py-2 text-left ${plan === "full" ? "border-brand bg-brand/10 ring-2 ring-brand/30" : "border-foreground/15 hover:bg-foreground/5"}`}
        >
          <span className="block text-sm font-bold leading-tight">Usar meus créditos de vídeos</span>
          <span className="mt-0.5 block text-xs text-foreground/60">
            Até {BATCH_VIDEOS} + {FREE_VIDEOS} grátis · sem marca d&apos;água
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
          <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-on-brand">{videos} vídeo{videos === 1 ? "" : "s"}</span>
        )}
        {(plan === "free" || bonus > 0) && (
          <>
            {plan === "full" && <span className="text-foreground/40">+</span>}
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
              {plan === "full" ? bonus : FREE_VIDEOS} grátis
            </span>
          </>
        )}
        {!mixed && (
          <span className="w-full text-center text-[11px] font-semibold text-brand-ink">
            Para gerar: pelo menos 2 vídeos em 2 blocos (gancho, corpo ou CTA) e 1 no outro. Assim os vídeos saem misturados, não iguais.
          </span>
        )}
        {mixed && (
          <span className="w-full text-center text-[11px] text-foreground/60">
            <b>{total} combinações diferentes</b>
            {plan === "full" && fits.length > 0 && (
              <> · dá para gerar até {maxGen} vídeo{maxGen === 1 ? "" : "s"} sem repetir</>
            )}
            {plan === "full" && needNext && nextLocked && (
              <>
                {" "}· suba mais {describeAdd(needNext)} para liberar {nextLocked}
              </>
            )}
            {needBonus && (
              <>
                {" "}· suba mais {describeAdd(needBonus)} para ganhar os +2 grátis
              </>
            )}
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
          <div className="grid grid-cols-6 gap-1">
            {VIDEO_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setVideos(n)}
                disabled={total > 0 && n > total}
                title={total > 0 && n > total ? `Seus vídeos dão ${total} combinações. Suba mais vídeos para gerar ${n} sem repetir.` : undefined}
                className={`rounded-lg border py-1.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-30 ${videos === n ? "border-brand bg-brand text-on-brand" : "border-foreground/15 hover:bg-foreground/5"} ${saldo?.logged && saldo.videos < n ? "opacity-40" : ""}`}
              >
                {total > 0 && n > total ? `🔒 ${n}` : n}
                {bonusFor(n, total || Infinity) > 0 && <span className="block text-[10px] font-semibold">+{bonusFor(n, total || Infinity)} grátis</span>}
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
        <div className="grid min-w-0 gap-1">
          <span className="truncate text-xs font-medium text-foreground/60">Música{!canMusic && " 🔒 VIP"}</span>
          <span className="flex min-w-0 gap-1">
            <select
              value={track}
              onChange={(e) => chooseTrack(e.target.value)}
              aria-label="Música de fundo"
              disabled={!canMusic}
              className="w-full min-w-0 rounded-lg bg-field border border-foreground/15 px-2 py-2 outline-none focus:border-brand disabled:opacity-50"
            >
              <option value="">Sem música</option>
              <option value="arquivo">Usar o som de um vídeo ou áudio meu…</option>
              <option value="busca">🔎 Buscar música grátis…</option>
            </select>
          </span>
        </div>
      </div>
      {track === "" && (
        <p className="-mt-1 text-[11px] text-foreground/55">
          🎵 Dica: sem música, você coloca um <b>som em alta do TikTok</b> na hora de postar.
        </p>
      )}
      {track === "arquivo" && (
        <label className="-mt-1 flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-foreground/15 bg-field px-2 py-2">
          <input type="file" accept="audio/*,video/*" hidden onChange={(e) => setMusic(e.target.files?.[0] || null)} />
          <span className="shrink-0 rounded-md bg-foreground/10 px-2 py-0.5 text-xs font-semibold">Escolher arquivo</span>
          <span className="truncate text-xs text-foreground/60">{music ? music.name : "Vídeo ou MP3: usamos só o som"}</span>
        </label>
      )}
      {track === "busca" && (
        <div className="-mt-1 grid gap-2 rounded-lg border border-foreground/15 bg-field p-2">
          {picked ? (
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <button type="button" onClick={() => preview(picked)} aria-label="Ouvir" className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent font-black text-white">
                {playing === picked.id ? "■" : "▶"}
              </button>
              <span className="min-w-0 flex-1 truncate">
                ✅ <b>{picked.title}</b> <span className="text-foreground/50">({mmss(picked.seconds)})</span>
              </span>
              <button type="button" onClick={() => setPicked(null)} className="shrink-0 underline">
                Trocar
              </button>
            </div>
          ) : (
            <>
              <span className="flex gap-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchMusic(query);
                    }
                  }}
                  placeholder="Ex.: trap beat, funk, lofi, reggaeton"
                  aria-label="Buscar música"
                  className="w-full min-w-0 rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm outline-none focus:border-brand"
                />
                <button type="button" onClick={() => searchMusic(query)} disabled={searching} className="shrink-0 rounded-md bg-accent px-3 text-xs font-bold text-white disabled:opacity-60">
                  {searching ? "Buscando…" : "Buscar"}
                </button>
              </span>
              {!found && suggestions.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {suggestions.map((q) => (
                    <button key={q} type="button" onClick={() => searchMusic(q)} className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-semibold hover:bg-foreground/20">
                      {q}
                    </button>
                  ))}
                </span>
              )}
              {searchErr && <p className="text-xs text-red-600">{searchErr}</p>}
              {found && found.length === 0 && <p className="text-xs text-foreground/60">Nada encontrado. Tente outra palavra (em inglês costuma achar mais).</p>}
              {found && found.length > 0 && (
                <ul className="grid max-h-56 gap-1 overflow-y-auto">
                  {found.map((t) => (
                    <li key={t.id} className="flex min-w-0 items-center gap-2 text-xs">
                      <button type="button" onClick={() => preview(t)} aria-label={playing === t.id ? "Parar" : "Ouvir"} className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-foreground/10 font-black">
                        {playing === t.id ? "■" : "▶"}
                      </button>
                      <span className="min-w-0 flex-1 truncate">
                        {t.title} <span className="text-foreground/50">({mmss(t.seconds)})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          player.current?.pause();
                          setPlaying("");
                          setPicked(t);
                        }}
                        className="shrink-0 rounded-md bg-brand px-2 py-1 font-bold text-on-brand"
                      >
                        Usar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="text-[11px] text-foreground/55">Músicas de uso comercial livre (CC0 / domínio público), sem precisar dar crédito.</p>
        </div>
      )}
      {track === "arquivo" && (
        <p className="-mt-1 text-[11px] text-foreground/55">
          ⏱️ Usar o som de um vídeo demora mais para gerar. ⚠️ Use só som que você pode usar (sua voz, seu jingle ou música liberada). Música famosa pode ser silenciada ou bloqueada pelo TikTok.
        </p>
      )}

      <label className={`flex w-fit items-center gap-2 text-xs text-foreground/70 ${canText ? "cursor-pointer" : "opacity-50"}`}>
        <input type="checkbox" disabled={!canText} checked={canText && captions} onChange={(e) => setCaptions(e.target.checked)} className="peer sr-only" />
        <span className="relative h-4 w-7 shrink-0 rounded-full bg-foreground/20 transition peer-checked:bg-brand after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-3" />
        <span>
          {!canText && "🔒 "}Textos no vídeo <span className="text-foreground/45">({captions ? "gancho e chamada escritos" : "desligado, vídeo limpo"})</span>
        </span>
      </label>

      <label className={`flex w-fit items-center gap-2 text-xs text-foreground/70 ${canTrim ? "cursor-pointer" : "opacity-50"}`}>
        <input type="checkbox" disabled={!canTrim} checked={canTrim && trimSilence} onChange={(e) => setTrimSilence(e.target.checked)} className="peer sr-only" />
        <span className="relative h-4 w-7 shrink-0 rounded-full bg-foreground/20 transition peer-checked:bg-brand after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-3" />
        <span>
          {!canTrim && "🔒 "}Cortar partes sem som{" "}
          <span className="text-foreground/45">({trimSilence ? "tira o silêncio do começo e do fim de cada clipe" : "desligado, clipes inteiros"})</span>
        </span>
      </label>

      <label className={`flex w-fit items-center gap-2 text-xs text-foreground/70 ${canAuto ? "cursor-pointer" : "opacity-50"}`}>
        <input type="checkbox" disabled={!canAuto} checked={canAuto && autoCaptions} onChange={(e) => setAutoCaptions(e.target.checked)} className="peer sr-only" />
        <span className="relative h-4 w-7 shrink-0 rounded-full bg-foreground/20 transition peer-checked:bg-brand after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-3" />
        <span>
          {!canAuto && "🔒 "}Legenda automática{" "}
          <span className="text-foreground/45">({autoCaptions ? "a fala aparece palavra por palavra · ⏱️ demora mais para gerar" : "desligada"})</span>
        </span>
      </label>

      <label className={`flex w-fit items-center gap-2 text-xs text-foreground/70 ${canFade ? "cursor-pointer" : "opacity-50"}`}>
        <input type="checkbox" disabled={!canFade} checked={canFade && transition} onChange={(e) => setTransition(e.target.checked)} className="peer sr-only" />
        <span className="relative h-4 w-7 shrink-0 rounded-full bg-foreground/20 transition peer-checked:bg-brand after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-3" />
        <span>
          {!canFade && "🔒 "}Transição suave{" "}
          <span className="text-foreground/45">({transition ? "gancho, corpo e CTA se misturam" : "desligada, corte seco"})</span>
        </span>
      </label>

      {!saldo?.vip && quota > 0 && plan === "full" && (
        <p className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
          ⭐ <b>Assinante:</b> você ainda tem <b>{quota} vídeo{quota === 1 ? "" : "s"} VIP</b> este mês. Os primeiros {quota} vídeos deste lote
          saem com música, textos, corte de silêncio e transição suave (com selo VIP).{" "}
          <a href={vipHref} className="font-bold underline">
            Seja VIP para todos
          </a>
        </p>
      )}
      {saldo && !(canMusic && canText && canTrim && canAuto && canFade) && (
        <a
          href={vipHref}
          className="flex items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs hover:bg-accent/15"
        >
          <span>
            <b>🔒 {[!canMusic && "Música", !canText && "textos no vídeo", !canTrim && "cortar silêncio", !canAuto && "legenda automática", !canFade && "transição suave"].filter(Boolean).join(", ").replace(/^./, (c) => c.toUpperCase()).replace(/, ([^,]*)$/, " e $1")}</b>{" "}
            {[canMusic, canText, canTrim, canAuto, canFade].filter((x) => !x).length > 1 ? "são exclusivos" : "é exclusivo"} do VIP.
          </span>
          <span className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 font-black text-white">Seja VIP · R$ 14,99/mês</span>
        </a>
      )}

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

      {error && (
        <p id="erro-envio" role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          ⚠️ {error}
        </p>
      )}
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
              : `Gerar ${videos} vídeo${videos === 1 ? "" : "s"}`}
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
              d&apos;água, com legendas e download direto na galeria do celular.
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
