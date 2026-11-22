// Transcrição da fala dos clipes com whisper.cpp (roda no próprio servidor, sem custo por vídeo).
// O Dockerfile instala o programa (whisper-cli) e o modelo. Sem eles (ex.: PC de teste), devolve null
// e o vídeo sai sem as legendas da fala.
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

export interface Word {
  w: string;
  s: number; // início em segundos, contado do começo do clipe
  e: number; // fim
}

const CLI = process.env.WHISPER_CLI || "whisper-cli";
const MODEL = process.env.WHISPER_MODEL || "/opt/whisper/ggml-small-q5_1.bin";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

// Tempo máximo por etapa (ffmpeg ou whisper) de cada clipe. Passou disso, o processo é encerrado
// e o clipe fica sem legenda: o lote nunca pode ficar travado em "Ouvindo a fala…" (22/11).
const STEP_TIMEOUT_MS = (Number(process.env.WHISPER_TIMEOUT_SEC) || 120) * 1000;

export class WhisperTimeout extends Error {}

function run(cmd: string, args: string[], timeoutMs = STEP_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    // stdout ignorado: um pipe não lido pode encher e travar o processo para sempre.
    const p = spawn(cmd, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      p.kill("SIGKILL");
      // Não espera o "close": um processo filho pode segurar o pipe aberto.
      reject(new WhisperTimeout(`${path.basename(cmd)} passou de ${Math.round(timeoutMs / 1000)} s e foi encerrado`));
    }, timeoutMs);
    timer.unref?.();
    let err = "";
    p.stderr.on("data", (d) => {
      err += d;
      if (err.length > 8000) err = err.slice(-4000);
    });
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("close", (c, sig) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (c === 0) resolve();
      else reject(new Error(`${path.basename(cmd)} saiu com código ${c ?? sig}: ${err.slice(-800)}`));
    });
  });
}

export async function whisperAvailable() {
  try {
    await fs.access(MODEL);
    return true;
  } catch {
    return false;
  }
}

// Frases que o Whisper costuma "inventar" em trecho sem fala ou só com música.
const HALLUCINATION = /(amara\.org|legendas? (pela|por)|inscreva-se|obrigad[oa] por assistir|tchau,? tchau|\[m[uú]sica\]|♪)/i;

export function parseWhisperJson(raw: string): Word[] {
  const j = JSON.parse(raw);
  const segs: { offsets: { from: number; to: number }; text: string }[] = j.transcription || [];
  const full = segs.map((s) => s.text).join("");
  if (HALLUCINATION.test(full)) return [];
  const words: Word[] = [];
  for (const s of segs) {
    const t = s.text.trim();
    if (!t || /^\[.*\]$|^\(.*\)$/.test(t)) continue;
    const from = s.offsets.from / 1000;
    const to = s.offsets.to / 1000;
    // Pontuação solta vai junto da palavra anterior.
    if (!/[\p{L}\p{N}]/u.test(t)) {
      if (words.length) words[words.length - 1].w += t;
      continue;
    }
    words.push({ w: t, s: from, e: Math.max(to, from + 0.08) });
  }
  return words;
}

// Transcreve um clipe uma vez só (guarda <clipe>.words.json ao lado dele).
export async function transcribeClip(file: string, hasAudio: boolean): Promise<Word[]> {
  const cache = `${file}.words.json`;
  try {
    return JSON.parse(await fs.readFile(cache, "utf8"));
  } catch {}
  let words: Word[] = [];
  if (hasAudio) {
    const wav = `${file}.16k.wav`;
    const out = `${file}.whisper`;
    await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", file, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
    const threads = String(Math.max(1, Number(process.env.WHISPER_THREADS || 4)));
    // -ml 1 -sow: um segmento por palavra, com o tempo de cada uma.
    await run(CLI, ["-m", MODEL, "-f", wav, "-l", "pt", "-t", threads, "-ml", "1", "-sow", "-oj", "-of", out, "-np"]);
    words = parseWhisperJson(await fs.readFile(`${out}.json`, "utf8"));
    await fs.rm(wav, { force: true });
    await fs.rm(`${out}.json`, { force: true });
  }
  await fs.writeFile(cache, JSON.stringify(words));
  return words;
}
