import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

// "Usar o som de um vídeo meu" (pedido do Andre): a pessoa envia um vídeo ou um áudio e o
// servidor tira só o som com o FFmpeg (sem a imagem), em AAC, até MAX_SECONDS.
// Roda ANTES de descontar saldo ou o teste grátis: se o arquivo não tiver som, nada é cobrado.

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const MAX_SECONDS = 300;

export class NoAudioError extends Error {}

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => {
      err += d;
      if (err.length > 20000) err = err.slice(-10000);
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com código ${code}: ${err.slice(-800)}`))));
  });
}

// Devolve o som do arquivo como .m4a. NoAudioError = o vídeo não tem som (ou não é mídia).
export async function extractAudio(file: File): Promise<Buffer> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "corte25-som-"));
  const input = path.join(tmp, "entrada_" + crypto.randomBytes(4).toString("hex"));
  const output = path.join(tmp, "som.m4a");
  try {
    await fs.writeFile(input, Buffer.from(await file.arrayBuffer()));
    try {
      await run(["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-map", "0:a:0", "-vn", "-sn", "-dn", "-t", String(MAX_SECONDS), "-ac", "2", "-ar", "44100", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", output]);
    } catch (e) {
      throw new NoAudioError((e as Error).message);
    }
    const buf = await fs.readFile(output);
    if (buf.length < 2000) throw new NoAudioError("som vazio");
    return buf;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
