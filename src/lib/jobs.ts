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
}

export interface Job {
  id: string;
  createdAt: string;
  product: string;
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
    return JSON.parse(raw) as Job;
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
