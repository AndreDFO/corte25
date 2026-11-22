import { releaseTrial } from "./trials";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { Job, Variation, jobDir, loadJob, saveJob } from "./jobs";
import { generateCopy } from "./copy";
import { VIDEO_CTA_BG, VIDEO_CTA_TEXT } from "./theme";
import { Word, transcribeClip, whisperAvailable } from "./transcribe";
import { buildAss } from "./captions-ass";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const W = 1080;
const H = 1920;
const FPS = 30;
const CONCURRENCY = Math.max(1, Number(process.env.RENDER_CONCURRENCY || 2));
const FONT_SRC = path.join(process.cwd(), "assets", "fonts", "Inter-ExtraBold.otf");

interface ClipInfo {
  file: string;
  duration: number; // duração usada (já sem as partes sem som, se o corte estiver ligado)
  hasAudio: boolean;
  offset?: number; // segundos cortados no começo (corte das partes sem som)
}

function run(cmd: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, windowsHide: true });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => {
      err += d;
      if (err.length > 20000) err = err.slice(-10000);
    });
    p.on("error", (e) =>
      reject(new Error(`Não consegui executar "${cmd}". O FFmpeg está instalado? (${e.message})`)),
    );
    p.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} saiu com código ${code}: ${err.slice(-1500)}`)),
    );
  });
}

async function probe(file: string): Promise<ClipInfo> {
  const out = await run(FFPROBE, [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type",
    "-of", "json",
    file,
  ]);
  const j = JSON.parse(out);
  const streams: { codec_type: string }[] = j.streams || [];
  if (!streams.some((s) => s.codec_type === "video")) throw new Error(`${path.basename(file)} não tem vídeo`);
  return {
    file,
    duration: Number(j.format?.duration) || 0,
    hasAudio: streams.some((s) => s.codec_type === "audio"),
  };
}

// Gerador pseudoaleatório com semente: a mesma tarefa sempre gera as mesmas variações.
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function wrap(text: string, max = 18): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4).join("\n");
}

interface Segment {
  clip: ClipInfo;
  input: number;
  start: number;
  dur: number; // duração final no vídeo
  speed: number;
  zoom: number;
}

export interface Recipe {
  segments: Segment[];
  total: number;
  saturation: number;
  contrast: number;
  brightness: number;
  hookStyle: number;
  musicOffset: number;
  fade: number; // VIP: transição suave entre os blocos (segundos de sobreposição); 0 = corte seco
}

// Transição suave (VIP, chave na tela de geração): gancho, corpo e CTA se misturam por ~0,3 s
// (imagem com xfade e som com acrossfade) em vez do corte seco.
export const TRANSITION_SEC = 0.3;

export const DURATION_OPTIONS = [15, 20, 25, 30] as const;
export type DurationMode = "auto" | "15" | "20" | "25" | "30";

export interface Combo {
  hook: number;
  body: number;
  cta: number;
}

// Todas as combinações gancho × corpo × CTA, numa ordem em que vídeos seguidos mudam o máximo possível.
export function allCombos(nh: number, nb: number, nc: number, seed: string): Combo[] {
  const r = rng(seed + ":combos");
  const list: Combo[] = [];
  for (let h = 0; h < nh; h++) for (let b = 0; b < nb; b++) for (let c = 0; c < nc; c++) list.push({ hook: h, body: b, cta: c });
  // Começa pela "diagonal" (gancho 1 + corpo 1 + CTA 1, gancho 2 + corpo 2 + CTA 2, …) e depois o resto embaralhado.
  const diag = Array.from({ length: Math.max(nh, nb, nc) }, (_, i) => ({ hook: i % nh, body: i % nb, cta: i % nc }));
  const key = (c: Combo) => `${c.hook}-${c.body}-${c.cta}`;
  const seen = new Set<string>();
  const ordered: Combo[] = [];
  for (const c of [...diag, ...shuffle(list, r)]) {
    if (!seen.has(key(c))) {
      seen.add(key(c));
      ordered.push(c);
    }
  }
  return ordered;
}

export function buildRecipe(
  blocks: { hooks: ClipInfo[]; bodies: ClipInfo[]; ctas: ClipInfo[] },
  combo: Combo,
  seed: string,
  index: number,
  maxDur: number | null,
  transition = false,
): Recipe {
  const r = rng(`${seed}:${index}`);
  const hook = blocks.hooks[combo.hook];
  const body = blocks.bodies[combo.body];
  const cta = blocks.ctas[combo.cta];
  // Gancho e CTA entram inteiros (até 8 s cada). O corpo é cortado para caber na duração máxima.
  const hDur = Math.min(hook.duration, 8);
  const cDur = Math.min(cta.duration, 8);
  // Com transição, cada emenda sobrepõe "fade" segundos; o corpo ganha esse tempo para manter a duração escolhida.
  // Clipes muito curtos usam uma transição menor (no máximo 1/3 do clipe).
  const fade = transition ? Math.round(Math.min(TRANSITION_SEC, hDur / 3, body.duration / 3, cDur / 3) * 100) / 100 : 0;
  let bDur = body.duration;
  if (maxDur) bDur = Math.max(Math.min(2, body.duration), Math.min(body.duration, maxDur - hDur - cDur + 2 * fade));
  // Pequenas diferenças visuais em cada vídeo para não ficarem idênticos.
  const zoom = r() < 0.5 ? 1 : 1.04 + r() * 0.06;
  const segments: Segment[] = [
    { clip: hook, input: 0, start: hook.offset ?? 0, dur: hDur, speed: 1, zoom },
    { clip: body, input: 1, start: body.offset ?? 0, dur: bDur, speed: 1, zoom },
    { clip: cta, input: 2, start: cta.offset ?? 0, dur: cDur, speed: 1, zoom },
  ];
  return {
    segments,
    total: Math.round((hDur + bDur + cDur - 2 * fade) * 10) / 10,
    fade,
    saturation: 1 + r() * 0.15,
    contrast: 1 + r() * 0.05,
    brightness: (r() - 0.5) * 0.04,
    hookStyle: Math.floor(r() * 3),
    musicOffset: r() * 30,
  };
}

export function describeCombo(c: Combo): string {
  return `Gancho ${c.hook + 1} + Corpo ${c.body + 1} + CTA ${c.cta + 1}`;
}

const esc = (n: number) => n.toFixed(3);

async function renderVariation(
  job: Job,
  dir: string,
  v: Variation,
  rc: Recipe,
  musicFile: string | undefined,
  speech: Map<string, Word[]> | null = null,
): Promise<void> {
  // Legenda automática (VIP): a fala de cada clipe aparece 1 a 3 palavras por vez, a falada em verde-limão.
  let assFile = "";
  if (job.autoCaptions && speech) {
    const words: Word[] = [];
    let offset = 0;
    for (const s of rc.segments) {
      const cut = s.clip.offset ?? 0;
      for (const w of speech.get(s.clip.file) || []) {
        const ws = w.s - cut;
        if (ws < -0.05 || ws >= s.dur - 0.05) continue;
        words.push({ w: w.w, s: offset + Math.max(0, ws), e: offset + Math.min(w.e - cut, s.dur) });
      }
      offset += s.dur - rc.fade; // com transição, o próximo bloco começa "fade" segundos antes

    }
    if (words.length) {
      assFile = `legenda_${v.index}.ass`;
      await fs.writeFile(path.join(dir, assFile), buildAss(words, null));
    }
  }
  const hookFile = `hook_${v.index}.txt`;
  const ctaFile = `cta_${v.index}.txt`;
  await fs.writeFile(path.join(dir, hookFile), wrap(v.hook, 18));
  await fs.writeFile(path.join(dir, ctaFile), wrap(v.cta, 24));
  if (job.plan === "free") await fs.writeFile(path.join(dir, "marca.txt"), "Corte25 · versão de teste");

  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
  for (const s of rc.segments) {
    args.push("-ss", esc(s.start), "-t", esc(s.dur * s.speed + 0.1), "-i", path.relative(dir, s.clip.file));
  }
  let nextInput = rc.segments.length;
  const silentInputs: Record<number, number> = {};
  rc.segments.forEach((s, k) => {
    if (!s.clip.hasAudio) {
      args.push("-f", "lavfi", "-t", esc(s.dur + 0.1), "-i", "anullsrc=r=44100:cl=stereo");
      silentInputs[k] = nextInput++;
    }
  });
  let musicInput = -1;
  if (musicFile) {
    args.push("-stream_loop", "-1", "-ss", esc(rc.musicOffset), "-i", path.relative(dir, musicFile));
    musicInput = nextInput++;
  }

  const f: string[] = [];
  rc.segments.forEach((s, k) => {
    const zw = Math.round((W * s.zoom) / 2) * 2;
    const zh = Math.round((H * s.zoom) / 2) * 2;
    f.push(
      `[${k}:v]setpts=(PTS-STARTPTS)/${s.speed},fps=${FPS},` +
        `scale=${zw}:${zh}:force_original_aspect_ratio=increase,crop=${W}:${H},tpad=stop_mode=clone:stop_duration=0.5,` +
        `trim=duration=${esc(s.dur)},setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v${k}]`,
    );
    const aSrc = s.clip.hasAudio ? `[${k}:a]` : `[${silentInputs[k]}:a]`;
    const tempo = s.clip.hasAudio && s.speed !== 1 ? `atempo=${s.speed},` : "";
    f.push(
      `${aSrc}${tempo}aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
        `asetpts=PTS-STARTPTS,apad,atrim=duration=${esc(s.dur)}[a${k}]`,
    );
  });
  if (rc.fade > 0) {
    // Transição suave: cada bloco entra misturado com o anterior (imagem e som).
    let vPrev = "v0";
    let aPrev = "a0";
    let start = 0;
    for (let k = 1; k < rc.segments.length; k++) {
      start += rc.segments[k - 1].dur - rc.fade;
      const last = k === rc.segments.length - 1;
      const vOut = last ? "vc" : `vx${k}`;
      const aOut = last ? "ac" : `ax${k}`;
      f.push(`[${vPrev}][v${k}]xfade=transition=fade:duration=${esc(rc.fade)}:offset=${esc(start)}[${vOut}]`);
      f.push(`[${aPrev}][a${k}]acrossfade=d=${esc(rc.fade)}:c1=tri:c2=tri[${aOut}]`);
      vPrev = vOut;
      aPrev = aOut;
    }
  } else {
    const pairs = rc.segments.map((_, k) => `[v${k}][a${k}]`).join("");
    f.push(`${pairs}concat=n=${rc.segments.length}:v=1:a=1[vc][ac]`);
  }

  const T = rc.total;
  const hookY = ["h*0.14", "h*0.20", "(h-text_h)/2-h*0.12"][rc.hookStyle];
  const hookBox =
    rc.hookStyle === 1
      ? ":box=1:boxcolor=white@0.95:boxborderw=28:fontcolor=black"
      : ":fontcolor=white:borderw=9:bordercolor=black";
  // Textos gravados no vídeo (gancho no início e chamada no fim). Opcional: job.captions === false tira os dois.
  const texts =
    job.captions === false
      ? ""
      : `,drawtext=fontfile=font.otf:textfile=${hookFile}:fontsize=78:line_spacing=14:text_align=C` +
        `${hookBox}:x=(w-text_w)/2:y=${hookY}:enable='lt(t,${esc(Math.min(3.2, rc.segments[0].dur))})',` +
        `drawtext=fontfile=font.otf:textfile=${ctaFile}:fontsize=64:line_spacing=10:text_align=C` +
        `:fontcolor=${VIDEO_CTA_TEXT}:box=1:boxcolor=${VIDEO_CTA_BG}@0.95:boxborderw=26` +
        `:x=(w-text_w)/2:y=h*0.70:enable='gte(t,${esc(Math.max(0, T - Math.min(2.8, rc.segments[2].dur)))})'`;
  f.push(
    `[vc]eq=saturation=${esc(rc.saturation)}:contrast=${esc(rc.contrast)}:brightness=${esc(rc.brightness)}` +
      texts +
      (job.plan === "free"
        ? `,drawtext=fontfile=font.otf:textfile=marca.txt:fontsize=46:fontcolor=white@0.55` +
          `:borderw=3:bordercolor=black@0.4:x=(w-text_w)/2:y=h*0.58`
        : "") +
      (assFile ? `,subtitles=${assFile}:fontsdir=.` : "") +
      `[vout]`,
  );
  if (musicInput >= 0) {
    f.push(`[${musicInput}:a]volume=0.28,atrim=duration=${esc(T)},afade=t=out:st=${esc(Math.max(0, T - 1))}:d=1[am]`);
    f.push(`[ac][am]amix=inputs=2:duration=first:normalize=0[aout]`);
  } else {
    f.push(`[ac]anull[aout]`);
  }

  args.push(
    "-filter_complex", f.join(";"),
    "-map", "[vout]", "-map", "[aout]",
    "-t", esc(T),
    "-c:v", "libx264", "-preset", process.env.X264_PRESET || "veryfast", "-crf", "23",
    // Limite de bitrate: arquivos menores (bom para baixar no celular), qualidade boa para o TikTok.
    "-maxrate", "6M", "-bufsize", "12M", "-profile:v", "high", "-level", "4.1",
    "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
    "-movflags", "+faststart",
    "-metadata", `title=${job.product} ${v.index + 1}`,
    path.join("outputs", v.file),
  );
  await run(FFMPEG, args, dir);
}

// Corte das partes sem som (opcional, chave na tela de geração): acha onde o som começa e termina
// em cada clipe pelo volume (silencedetect do FFmpeg) e deixa uma folga para não comer a fala.
// Devolve null quando não há o que cortar (clipe sem áudio, com música o tempo todo, ou corte pequeno).
const TRIM_BEFORE = 0.2;
const TRIM_AFTER = 0.35;
async function soundBounds(c: ClipInfo): Promise<{ start: number; end: number } | null> {
  if (!c.hasAudio) return null;
  const dur = c.duration;
  const log = await new Promise<string>((resolve) => {
    const p = spawn(
      FFMPEG,
      ["-hide_banner", "-nostats", "-i", c.file, "-vn", "-af", "silencedetect=noise=-38dB:d=0.25", "-f", "null", "-"],
      { windowsHide: true },
    );
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", () => resolve(""));
    p.on("close", () => resolve(err));
  });
  const starts = [...log.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  if (!starts.length) return null;
  let start = 0;
  let end = dur;
  // Silêncio desde o 0: o som começa quando ele termina.
  if (starts[0] <= 0.05 && ends.length) start = Math.max(0, ends[0] - TRIM_BEFORE);
  // Silêncio que vai até o fim: o som termina quando ele começa.
  const lastStart = starts[starts.length - 1];
  if ((ends.length < starts.length || ends[ends.length - 1] >= dur - 0.05) && lastStart > start)
    end = Math.min(dur, lastStart + TRIM_AFTER);
  // Só corta se tirar pelo menos 0,15 s e sobrar pelo menos 1 s.
  if (end - start < 1 || dur - (end - start) < 0.15) return null;
  return { start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 };
}

const running = new Set<string>();

export function startJob(id: string) {
  if (running.has(id)) return;
  running.add(id);
  processJob(id)
    .catch(async (err) => {
      console.error(`[job ${id}]`, err);
      const job = await loadJob(id);
      if (job) {
        job.status = "error";
        job.message = String(err?.message || err);
        await saveJob(job);
        if (job.trialKeys?.length) await releaseTrial(job.trialKeys).catch(() => {});
      }
    })
    .finally(() => running.delete(id));
}

async function processJob(id: string) {
  const job = await loadJob(id);
  if (!job) throw new Error("tarefa não encontrada");
  const dir = jobDir(id);
  await fs.mkdir(path.join(dir, "outputs"), { recursive: true });
  await fs.copyFile(FONT_SRC, path.join(dir, "font.otf"));

  const probeAll = async (files: string[]) => {
    const out: ClipInfo[] = [];
    for (const f of files) {
      const c = await probe(path.join(dir, "inputs", f));
      if (c.duration < 0.5) throw new Error(`O clipe ${f} é curto demais.`);
      out.push(c);
    }
    return out;
  };
  const blocks = {
    hooks: await probeAll(job.blocks.hooks),
    bodies: await probeAll(job.blocks.bodies),
    ctas: await probeAll(job.blocks.ctas),
  };
  // Recursos VIP só nos primeiros job.vipLimit vídeos (cota do assinante); sem limite, em todos.
  const vipFor = (i: number) => job.vipLimit === undefined || i < job.vipLimit;
  // Recursos liberados por cupom (job.vipKeep) valem em todos, mesmo fora da cota.
  const keep = (f: NonNullable<Job["vipKeep"]>[number], i: number) => vipFor(i) || Boolean(job.vipKeep?.includes(f));
  // Cópia sem o corte de silêncio, para os vídeos fora da cota VIP.
  const plain = { hooks: blocks.hooks.map((c) => ({ ...c })), bodies: blocks.bodies.map((c) => ({ ...c })), ctas: blocks.ctas.map((c) => ({ ...c })) };
  // Legenda automática (VIP): ouve a fala de cada clipe uma vez, antes do corte do silêncio.
  let speech: Map<string, Word[]> | null = null;
  if (job.autoCaptions) {
    if (await whisperAvailable()) {
      job.message = "Ouvindo a fala dos vídeos para a legenda…";
      await saveJob(job);
      speech = new Map();
      for (const c of [...blocks.hooks, ...blocks.bodies, ...blocks.ctas]) {
        const words = await transcribeClip(c.file, c.hasAudio).catch((e) => {
          console.error(`[legenda] ${path.basename(c.file)}:`, e);
          return [] as Word[];
        });
        speech.set(c.file, words);
      }
    } else {
      console.warn("[legenda] servidor sem whisper; vídeos saem sem a legenda automática");
    }
  }
  if (job.trimSilence) {
    job.message = "Cortando as partes sem som…";
    await saveJob(job);
    for (const c of [...blocks.hooks, ...blocks.bodies, ...blocks.ctas]) {
      const r = await soundBounds(c).catch(() => null);
      if (!r) continue;
      c.offset = r.start;
      c.duration = r.end - r.start;
    }
  }
  // Sempre entrega job.count vídeos. Se houver menos combinações que isso, elas se repetem
  // com outro texto de gancho, outra legenda e pequenas mudanças visuais.
  // O lote pago entrega 25 + 2 de bônus (27): com 3 × 3 × 3, todas as combinações sem repetir.
  // O teste grátis entrega só as 2 primeiras.
  const unique = allCombos(blocks.hooks.length, blocks.bodies.length, blocks.ctas.length, "corte25");
  const combos = Array.from({ length: job.count }, (_, i) => unique[i % unique.length]);

  job.status = "writing";
  job.message = "Criando hooks e legendas…";
  await saveJob(job);
  const { items, source } = await generateCopy(job.productGiven === false ? "" : job.product, job.details, combos.length);

  const maxDur = job.durationMode && job.durationMode !== "auto" ? Number(job.durationMode) : null;
  const recipes = combos.map((c, i) => buildRecipe(keep("silencio", i) ? blocks : plain, c, id, i, maxDur, Boolean(job.transition) && keep("transicao", i)));
  job.copySource = source;
  job.variations = combos.map((c, i) => ({
    index: i,
    file: `video_${String(i + 1).padStart(2, "0")}.mp4`,
    ...items[i],
    recipe: describeCombo(c),
    durationSec: recipes[i].total,
    status: "pending",
    ...(job.vipLimit !== undefined && i < job.vipLimit ? { vip: true } : {}),
  }));
  job.status = "rendering";
  job.message = "Montando os vídeos…";
  await saveJob(job);

  const music = job.music ? path.join(dir, "inputs", job.music) : undefined;
  let cursor = 0;
  const update = async (i: number, patch: Partial<Variation>) => {
    const fresh = (await loadJob(id))!;
    Object.assign(job.variations[i], patch);
    fresh.variations = job.variations;
    await saveJob(fresh);
  };
  // Salva o progresso em série para não sobrescrever o job.json em paralelo.
  let chain = Promise.resolve();
  const queueUpdate = (i: number, patch: Partial<Variation>) => (chain = chain.then(() => update(i, patch)));

  const worker = async () => {
    while (cursor < job.variations.length) {
      const i = cursor++;
      const v = job.variations[i];
      await queueUpdate(i, { status: "rendering" });
      try {
        await renderVariation(
          { ...job, captions: keep("textos", i) && job.captions, autoCaptions: keep("legenda", i) && job.autoCaptions },
          dir,
          v,
          recipes[i],
          keep("musica", i) ? music : undefined,
          keep("legenda", i) ? speech : null,
        );
        await queueUpdate(i, { status: "done" });
      } catch (err) {
        console.error(`[job ${id}] vídeo ${i + 1}:`, err);
        await queueUpdate(i, { status: "error", error: String((err as Error).message).slice(0, 500) });
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await chain;

  const final = (await loadJob(id))!;
  const ok = final.variations.filter((v) => v.status === "done").length;
  final.status = ok > 0 ? "done" : "error";
  final.message = ok === final.variations.length ? "Pronto!" : `${ok} de ${final.variations.length} vídeos gerados.`;
  await saveJob(final);
  // Teste grátis sem nenhum vídeo pronto: devolve o teste para a pessoa tentar de novo.
  if (ok === 0 && final.trialKeys?.length) await releaseTrial(final.trialKeys).catch(() => {});
}
