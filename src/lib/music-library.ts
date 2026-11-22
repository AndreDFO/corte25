import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./jobs";
import { TRACKS } from "./music";

// Biblioteca automática de músicas livres (pedido do Andre: grátis e sem trabalho manual).
// Fonte: API pública do Openverse (WordPress), só com licenças que liberam uso comercial
// SEM exigir crédito: CC0 e Public Domain Mark. O servidor atualiza sozinho 1x por semana.
// Se a busca falhar, continua valendo a biblioteca anterior (ou as 8 faixas próprias).
// 22/11: o filtro category=music devolvia ZERO faixas CC0 (só sobravam as 8 próprias, que o
// Andre achou infantis). Agora busca beats atuais (trap, house, lo-fi, reggaeton…) feitos por
// produtores no Freesound, com 30 s a 2 min, e descarta efeitos sonoros e músicas infantis.

export interface LibTrack {
  id: string; // "ov_<id do openverse>" ou o slug das faixas próprias
  title: string;
  style: string;
  seconds: number;
  creator?: string;
  license?: string; // cc0 | pdm | proprio
  source?: string; // página original da música
  file?: string; // nome do arquivo em DATA_DIR/musicas (faixas do Openverse)
}

const DIR = path.join(DATA_DIR, "musicas");
const INDEX = path.join(DIR, "biblioteca.json");
const WEEK = 7 * 24 * 3600_000;
const PER_STYLE = 5;
const MIN_S = 28;
const MAX_S = 240;
const MAX_BYTES = 12 * 1024 * 1024;

export const STYLES: { style: string; q: string[] }[] = [
  { style: "Trap / Hip-hop", q: ["trap beat", "hip hop beat"] },
  { style: "Eletrônica / House", q: ["deep house", "edm"] },
  { style: "Lo-fi / Chill", q: ["lofi beat", "chill beat"] },
  { style: "Funk / Disco", q: ["funk groove", "disco funk"] },
  { style: "Pop / Dance", q: ["dance pop", "synth pop"] },
  { style: "Latina / Tropical", q: ["reggaeton", "tropical house", "latin beat"] },
  { style: "Cinematográfica", q: ["cinematic", "epic music"] },
];

// Palavras que indicam efeito sonoro, pedaço solto de bateria ou música infantil: fica de fora.
const BLOCK =
  /\b(kids?|child|children|nursery|lullaby|cartoon|toy|baby|christmas|xmas|8[- ]?bit|chiptune|ukulele|whistl\w*|circus|sfx|fx|foley|riser|siren|kick|snare|hi-?hat|clap|one[- ]?shot|drums?|percussion|rumble|blade|bass ?only|pronunciation|fire|crackl\w*|fan|rain|wind|ambien\w*|noise|field recording|sound effect|notification|alarm|test|tone|horror|scary|creepy|preview)\b/i

const OWN: LibTrack[] = TRACKS.map((t) => ({ id: t.slug, title: t.title, style: "Corte25 (próprias)", seconds: 0, license: "proprio" }));

type Index = { updatedAt: string; tracks: LibTrack[] };

async function readIndex(): Promise<Index | null> {
  try {
    return JSON.parse(await fs.readFile(INDEX, "utf8")) as Index;
  } catch {
    return null;
  }
}

// Lista mostrada no formulário: as do Openverse. As 8 próprias só aparecem se a busca ainda não
// trouxe nada (Andre achou infantis). Elas continuam funcionando em lotes antigos (trackPath).
export async function listLibrary(): Promise<LibTrack[]> {
  const idx = await readIndex();
  return idx?.tracks.length ? idx.tracks : OWN;
}

// Caminho do arquivo de uma faixa (para prévia e para montar o vídeo). null = não existe.
export async function trackPath(id: string): Promise<string | null> {
  if (OWN.some((t) => t.id === id)) return path.join(process.cwd(), "public", "musicas", `${id}.mp3`);
  if (!/^ov_[a-f0-9-]{36}$/.test(id)) return null;
  const idx = await readIndex();
  const t = idx?.tracks.find((x) => x.id === id);
  if (!t?.file) return null;
  const p = path.join(DIR, t.file);
  return (await fs.stat(p).catch(() => null)) ? p : null;
}

interface OvAudio {
  id: string;
  title?: string;
  url?: string;
  creator?: string;
  license?: string;
  foreign_landing_url?: string;
  duration?: number | null; // ms
  filetype?: string | null;
  filesize?: number | null;
  source?: string;
  tags?: { name?: string }[] | null;
}

async function search(q: string): Promise<OvAudio[]> {
  const u = new URL("https://api.openverse.org/v1/audio/");
  u.searchParams.set("q", q);
  u.searchParams.set("license", "cc0,pdm");
  u.searchParams.set("length", "short"); // 30 s a 2 min
  u.searchParams.set("page_size", "40");
  const res = await fetch(u, { headers: { "User-Agent": "Corte25/1.0 (biblioteca de musicas)" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const j = (await res.json()) as { results?: OvAudio[] };
  return j.results ?? [];
}

function good(a: OvAudio) {
  const s = (a.duration ?? 0) / 1000;
  const lic = (a.license || "").toLowerCase();
  const type = (a.filetype || a.url?.split(".").pop() || "").toLowerCase();
  return (
    /^[a-f0-9-]{36}$/.test(a.id) &&
    (lic === "cc0" || lic === "pdm") &&
    !!a.url?.startsWith("https://") &&
    s >= MIN_S &&
    s <= MAX_S &&
    ["mp3", "ogg", "wav", "flac", "m4a"].includes(type) &&
    !BLOCK.test(a.title || "") &&
    !(a.tags || []).some((t) => BLOCK.test(t.name || "")) &&
    (!a.filesize || a.filesize <= MAX_BYTES)
  );
}

async function download(a: OvAudio, file: string) {
  const res = await fetch(a.url!, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 20_000 || buf.length > MAX_BYTES) throw new Error("tamanho fora do limite");
  await fs.writeFile(path.join(DIR, file), buf);
}

let running: Promise<number> | null = null;

// Busca músicas novas por estilo e troca a biblioteca. Devolve quantas faixas ficaram.
export function refreshLibrary(): Promise<number> {
  if (!running) running = doRefresh().finally(() => (running = null));
  return running;
}

async function doRefresh(): Promise<number> {
  await fs.mkdir(DIR, { recursive: true });
  const old = await readIndex();
  const tracks: LibTrack[] = [];
  const seen = new Set<string>();
  for (const { style, q: queries } of STYLES) {
    const found: OvAudio[] = [];
    for (const q of queries) {
      try {
        found.push(...(await search(q)).filter(good));
      } catch (e) {
        console.log(`[músicas] busca "${q}" falhou:`, (e as Error).message);
      }
      await new Promise((r) => setTimeout(r, 2000)); // sem pressa: o Openverse limita buscas seguidas
    }
    if (!found.length) continue;
    // Varia a escolha a cada semana para a playlist mudar.
    found.sort(() => Math.random() - 0.5);
    let n = 0;
    for (const a of found) {
      if (n >= PER_STYLE) break;
      if (seen.has(a.id)) continue;
      const ext = (a.filetype || a.url!.split(".").pop() || "mp3").toLowerCase();
      const file = `ov_${a.id}.${ext}`;
      try {
        if (!(await fs.stat(path.join(DIR, file)).catch(() => null))) await download(a, file);
      } catch (e) {
        console.log(`[músicas] não baixou ${a.id}:`, (e as Error).message);
        continue;
      }
      seen.add(a.id);
      n++;
      tracks.push({
        id: `ov_${a.id}`,
        title: (a.title || "Sem nome").slice(0, 60),
        style,
        seconds: Math.round((a.duration ?? 0) / 1000),
        creator: a.creator?.slice(0, 60),
        license: a.license?.toLowerCase(),
        source: a.foreign_landing_url,
        file,
      });
    }
  }
  if (tracks.length === 0) {
    console.log("[músicas] nenhuma faixa nova; mantendo a biblioteca anterior");
    return old?.tracks.length ?? 0;
  }
  await fs.writeFile(INDEX, JSON.stringify({ updatedAt: new Date().toISOString(), tracks } satisfies Index, null, 1));
  // Apaga arquivos que saíram da lista (mas só depois de salvar a nova).
  const keep = new Set(tracks.map((t) => t.file));
  for (const f of await fs.readdir(DIR)) if (f.startsWith("ov_") && !keep.has(f)) await fs.rm(path.join(DIR, f), { force: true });
  console.log(`[músicas] biblioteca atualizada: ${tracks.length} faixas`);
  return tracks.length;
}

async function refreshIfOld() {
  const idx = await readIndex();
  if (idx && Date.now() - new Date(idx.updatedAt).getTime() < WEEK) return;
  await refreshLibrary().catch((e) => console.log("[músicas] erro:", (e as Error).message));
}

const g = globalThis as unknown as { __corte25Music?: NodeJS.Timeout };
export function startMusicRefresher() {
  if (g.__corte25Music) return;
  setTimeout(refreshIfOld, 30_000).unref?.();
  g.__corte25Music = setInterval(refreshIfOld, 6 * 3600_000);
  g.__corte25Music.unref?.();
}
