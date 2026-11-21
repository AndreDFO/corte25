import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { Job, Variation, jobDir, loadJob, saveJob } from "./jobs";
import { generateCopy } from "./copy";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const W = 1080;
const H = 1920;
const FPS = 30;
const CONCURRENCY = Math.max(1, Number(process.env.RENDER_CONCURRENCY || 2));
const FONT_SRC = path.join(process.cwd(), "assets", "fonts", "Inter-ExtraBold.otf");

interface ClipInfo {
  file: string;
  duration: number;
  hasAudio: boolean;
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
}

export const DURATION_OPTIONS = [15, 20, 25, 30] as const;
export type DurationMode = "mix" | "15" | "20" | "25" | "30";

// "mix": alterna 15, 20, 25 e 30 s (em 25 vídeos: 7 de 15 s e 6 de cada uma das outras).
export function targetDuration(mode: DurationMode, index: number): number {
  if (mode !== "mix" && (DURATION_OPTIONS as readonly number[]).includes(Number(mode))) return Number(mode);
  return DURATION_OPTIONS[index % DURATION_OPTIONS.length];
}

export function buildRecipe(clips: ClipInfo[], seed: string, index: number, target: number): Recipe {
  const r = rng(`${seed}:${index}`);
  // Cenas mais longas em vídeos mais longos.
  const [minSeg, maxSeg] = target <= 15 ? [1.5, 3.5] : target <= 20 ? [1.8, 4] : [2, 4.5];

  // Ordem das cenas: começa por um clipe diferente a cada variação e percorre os outros embaralhados.
  // Quando os vídeos enviados não bastam para preencher o tempo, volta a eles usando outros trechos.
  const first = clips[index % clips.length];
  let queue: ClipInfo[] = [first, ...shuffle(clips.filter((c) => c !== first), r)];
  const nextClip = (prev?: ClipInfo) => {
    if (queue.length === 0) queue = shuffle(clips, r);
    if (clips.length > 1 && queue[0] === prev) queue.push(queue.shift()!);
    return queue.shift()!;
  };

  const segments: Segment[] = [];
  let remaining = target;
  let prev: ClipInfo | undefined;
  while (remaining > 0.05) {
    const clip = nextClip(prev);
    prev = clip;
    const speed = clip.duration > 3 && r() < 0.3 ? 1.1 : 1.0;
    // A primeira cena é curta, no ritmo do hook.
    let dur = segments.length === 0 ? 1.5 + r() : minSeg + r() * (maxSeg - minSeg);
    dur = Math.min(dur, clip.duration / speed - 0.1);
    // Evita sobrar um pedacinho muito curto no fim.
    if (remaining - dur < 1) dur = Math.min(remaining, clip.duration / speed - 0.1);
    dur = Math.max(0.3, Math.min(dur, remaining));
    const start = Math.max(0, (clip.duration - dur * speed - 0.05) * r());
    segments.push({
      clip,
      input: segments.length,
      start,
      dur,
      speed,
      zoom: r() < 0.5 ? 1 : 1.06 + r() * 0.12,
    });
    remaining -= dur;
  }

  return {
    segments,
    total: target,
    saturation: 1 + r() * 0.25,
    contrast: 1 + r() * 0.08,
    brightness: (r() - 0.5) * 0.06,
    hookStyle: Math.floor(r() * 3),
    musicOffset: r() * 30,
  };
}

export function describeRecipe(rc: Recipe): string {
  const scenes = rc.segments
    .map((s) => `${path.basename(s.clip.file)}${s.speed !== 1 ? " (rápido)" : ""}${s.zoom !== 1 ? " (zoom)" : ""}`)
    .join(" → ");
  return `${rc.total}s, ${rc.segments.length} cenas: ${scenes}`;
}

const esc = (n: number) => n.toFixed(3);

async function renderVariation(
  job: Job,
  dir: string,
  v: Variation,
  rc: Recipe,
  musicFile: string | undefined,
): Promise<void> {
  const hookFile = `hook_${v.index}.txt`;
  const ctaFile = `cta_${v.index}.txt`;
  await fs.writeFile(path.join(dir, hookFile), wrap(v.hook, 18));
  await fs.writeFile(path.join(dir, ctaFile), wrap(v.cta, 24));
  if (job.plan === "free") await fs.writeFile(path.join(dir, "marca.txt"), "Corte25 · teste grátis");

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
  const pairs = rc.segments.map((_, k) => `[v${k}][a${k}]`).join("");
  f.push(`${pairs}concat=n=${rc.segments.length}:v=1:a=1[vc][ac]`);

  const T = rc.total;
  const hookY = ["h*0.14", "h*0.20", "(h-text_h)/2-h*0.12"][rc.hookStyle];
  const hookBox =
    rc.hookStyle === 1
      ? ":box=1:boxcolor=white@0.95:boxborderw=28:fontcolor=black"
      : ":fontcolor=white:borderw=9:bordercolor=black";
  f.push(
    `[vc]eq=saturation=${esc(rc.saturation)}:contrast=${esc(rc.contrast)}:brightness=${esc(rc.brightness)},` +
      `drawtext=fontfile=font.otf:textfile=${hookFile}:fontsize=78:line_spacing=14:text_align=C` +
      `${hookBox}:x=(w-text_w)/2:y=${hookY}:enable='lt(t,3.2)',` +
      `drawtext=fontfile=font.otf:textfile=${ctaFile}:fontsize=64:line_spacing=10:text_align=C` +
      `:fontcolor=white:box=1:boxcolor=0xFE2C55@0.95:boxborderw=26` +
      `:x=(w-text_w)/2:y=h*0.70:enable='gte(t,${esc(Math.max(0, T - 2.8))})'` +
      (job.plan === "free"
        ? `,drawtext=fontfile=font.otf:textfile=marca.txt:fontsize=46:fontcolor=white@0.55` +
          `:borderw=3:bordercolor=black@0.4:x=(w-text_w)/2:y=h*0.58`
        : "") +
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
    "-c:v", "libx264", "-preset", process.env.X264_PRESET || "veryfast", "-crf", "21",
    "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
    "-movflags", "+faststart",
    "-metadata", `title=${job.product} ${v.index + 1}`,
    path.join("outputs", v.file),
  );
  await run(FFMPEG, args, dir);
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

  const clips: ClipInfo[] = [];
  for (const f of job.inputs) clips.push(await probe(path.join(dir, "inputs", f)));
  const usable = clips.filter((c) => c.duration >= 1);
  if (usable.length === 0) throw new Error("Os vídeos enviados são curtos demais (mínimo 1 segundo).");

  job.status = "writing";
  job.message = "Criando hooks e legendas…";
  await saveJob(job);
  const { items, source } = await generateCopy(job.product, job.details, job.count);

  const mode = (job.durationMode || "mix") as DurationMode;
  const recipes = items.map((_, i) => buildRecipe(usable, id, i, targetDuration(mode, i)));
  job.copySource = source;
  job.variations = items.map((c, i) => ({
    index: i,
    file: `video_${String(i + 1).padStart(2, "0")}.mp4`,
    ...c,
    recipe: describeRecipe(recipes[i]),
    durationSec: recipes[i].total,
    status: "pending",
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
        await renderVariation(job, dir, v, recipes[i], music);
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
}
