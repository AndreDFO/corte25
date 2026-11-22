import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { isAdminEmail } from "./admin";
import { jobDir, loadJob, saveJob, type Variation } from "./jobs";

// Narração pelo microfone: a pessoa grava a voz enquanto o vídeo roda sem som e o servidor
// troca o áudio original pela narração (novo arquivo video_XX_narrado.mp4, apagado junto
// com o lote depois de 24 h).
// EM TESTE: só a conta admin (ADMIN_EMAILS) vê. Para liberar a todos: NARRACAO=todos no Railway.

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export async function canNarrate() {
  if ((process.env.NARRACAO || "").toLowerCase() === "todos") return true;
  return isAdminEmail().catch(() => false);
}

export const narratedName = (file: string) => file.replace(/\.mp4$/, "_narrado.mp4");

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => {
      err += d;
      if (err.length > 20000) err = err.slice(-10000);
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} saiu com código ${code}: ${err.slice(-1500)}`))));
  });
}

// Uma gravação por vez em cada lote, para não salvar o job.json ao mesmo tempo.
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(id, next);
  next.finally(() => locks.get(id) === next && locks.delete(id)).catch(() => {});
  return next;
}

async function setNarrated(id: string, index: number, value: string | undefined): Promise<Variation | null> {
  const job = await loadJob(id);
  const v = job?.variations.find((x) => x.index === index);
  if (!job || !v) return null;
  if (value) v.narrated = value;
  else delete v.narrated;
  await saveJob(job);
  return v;
}

// offsetMs: quanto tempo a gravação já tinha começado quando o vídeo começou a tocar.
export function mixNarration(id: string, v: Variation, audio: Buffer, ext: string, offsetMs: number) {
  return withLock(id, async () => {
    const out = path.join(jobDir(id), "outputs");
    const video = path.join(out, v.file);
    const voice = path.join(out, `narracao_${String(v.index + 1).padStart(2, "0")}.${ext}`);
    const final = path.join(out, narratedName(v.file));
    const tmp = `${final}.${process.pid}.tmp.mp4`;
    await fs.writeFile(voice, audio);
    try {
      const dur = Number((await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video])).trim());
      const off = Math.max(-3000, Math.min(5000, Math.round(offsetMs || 0)));
      const align = off >= 0 ? `atrim=start=${(off / 1000).toFixed(3)},asetpts=PTS-STARTPTS` : `adelay=${-off}:all=1`;
      await run(FFMPEG, [
        "-y", "-hide_banner", "-loglevel", "error",
        "-i", video,
        "-i", voice,
        "-filter_complex", `[1:a]aresample=48000,${align},highpass=f=80,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,apad[a]`,
        "-map", "0:v:0", "-map", "[a]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ac", "2",
        ...(dur > 0 ? ["-t", dur.toFixed(3)] : ["-shortest"]),
        "-movflags", "+faststart",
        "-f", "mp4", tmp,
      ]);
      await fs.rename(tmp, final);
    } finally {
      await fs.rm(voice, { force: true }).catch(() => {});
      await fs.rm(tmp, { force: true }).catch(() => {});
    }
    return setNarrated(id, v.index, new Date().toISOString());
  });
}

export function removeNarration(id: string, v: Variation) {
  return withLock(id, async () => {
    await fs.rm(path.join(jobDir(id), "outputs", narratedName(v.file)), { force: true });
    return setNarrated(id, v.index, undefined);
  });
}
