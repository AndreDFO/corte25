import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

export type VariationStatus = "pending" | "rendering" | "done" | "error";

export interface Variation {
  index: number;
  file: string;
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
  recipe: string;
  durationSec: number;
  status: VariationStatus;
  error?: string;
  narrated?: string; // data da narração gravada pelo microfone (arquivo video_XX_narrado.mp4)
  noCaption?: boolean; // pediu legenda automática e saiu sem ela (o saldo desse vídeo foi devolvido)
  vip?: boolean; // vídeo feito com recursos VIP pela cota do assinante (mostra o selo VIP)
}

export interface Job {
  // Recursos VIP só nos primeiros N vídeos (cota de 3/mês do assinante). Sem isso: todos os vídeos.
  vipLimit?: number;
  charged?: number; // vídeos descontados do saldo (sem o bônus); os que falharem voltam ao saldo
  resumed?: boolean; // já foi recomeçado uma vez depois de um reinício do servidor
  trialKeys?: string[]; // teste grátis: chaves usadas, para devolver o teste se nenhum vídeo sair
  vipKeep?: ("textos" | "silencio" | "musica" | "legenda" | "transicao")[]; // recursos de cupom: valem em todos os vídeos, mesmo fora do vipLimit
  id: string;
  createdAt: string;
  product: string;
  captions?: boolean; // false = vídeo sem textos gravados (gancho e chamada); a legenda para postar continua
  trimSilence?: boolean; // true = corta o começo e o fim sem som de cada clipe (desligado por padrão)
  transition?: boolean; // VIP: transição suave entre gancho, corpo e CTA (desligada por padrão = corte seco)
  autoCaptions?: boolean; // VIP: legenda automática da fala, palavra por palavra (desligada por padrão)
  productGiven?: boolean; // false = sem nome (o "product" é só a data); os textos não citam o nome
  details: string;
  inputs: string[];
  blocks: { hooks: string[]; bodies: string[]; ctas: string[] };
  music?: string;
  plan: "free" | "full";
  count: number;
  durationMode?: "auto" | "15" | "20" | "25" | "30";
  status: "queued" | "writing" | "rendering" | "done" | "error";
  copySource?: "claude" | "template";
  message?: string;
  variations: Variation[];
  ownerId?: string | null; // conta que gerou (null = sem login); só ela vê o lote
}

export function newJobId() {
  return crypto.randomBytes(8).toString("hex");
}

export function jobDir(id: string) {
  if (!/^[a-f0-9]{16}$/.test(id)) throw new Error("id inválido");
  return path.join(DATA_DIR, "jobs", id);
}

export async function saveJob(job: Job) {
  const dir = jobDir(job.id);
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, "job.json.tmp");
  await fs.writeFile(tmp, JSON.stringify(job, null, 2));
  await fs.rename(tmp, path.join(dir, "job.json"));
}

export async function loadJob(id: string): Promise<Job | null> {
  try {
    const raw = await fs.readFile(path.join(jobDir(id), "job.json"), "utf8");
    const job = JSON.parse(raw) as Job;
    // Guardado por RETENTION_HOURS (24 h); depois disso a tarefa some, mesmo antes da limpeza apagar a pasta.
    const hours = Number(process.env.RETENTION_HOURS) || 24;
    if (Date.now() > new Date(job.createdAt).getTime() + hours * 3600_000) return null;
    return job;
  } catch {
    return null;
  }
}

export function safeName(name: string) {
  const ext = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".mp4";
  const base = path
    .basename(name, path.extname(name))
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 40);
  return `${base || "video"}${ext}`;
}
