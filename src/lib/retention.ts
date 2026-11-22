import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR, type Job } from "./jobs";

// Os vídeos ficam guardados por 24 horas (regra do Andre). Depois a pasta da tarefa é apagada.
export const RETENTION_HOURS = Number(process.env.RETENTION_HOURS) || 24;
const RETENTION_MS = RETENTION_HOURS * 3600_000;

export function expiresAt(job: Pick<Job, "createdAt">) {
  return new Date(new Date(job.createdAt).getTime() + RETENTION_MS).toISOString();
}

export function isExpired(job: Pick<Job, "createdAt">) {
  return Date.now() > new Date(job.createdAt).getTime() + RETENTION_MS;
}

export async function sweepExpired() {
  const root = path.join(DATA_DIR, "jobs");
  let ids: string[];
  try {
    ids = await fs.readdir(root);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const id of ids) {
    if (!/^[a-f0-9]{16}$/.test(id)) continue;
    const dir = path.join(root, id);
    let created: number;
    try {
      const job = JSON.parse(await fs.readFile(path.join(dir, "job.json"), "utf8")) as Job;
      created = new Date(job.createdAt).getTime();
    } catch {
      created = (await fs.stat(dir).catch(() => null))?.mtimeMs ?? Date.now();
    }
    if (Date.now() - created > RETENTION_MS) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      removed++;
    }
  }
  if (removed) console.log(`[retenção] ${removed} tarefa(s) com mais de ${RETENTION_HOURS}h apagada(s)`);
  return removed;
}

const g = globalThis as unknown as { __corte25Sweeper?: NodeJS.Timeout };
export function startSweeper() {
  if (g.__corte25Sweeper) return;
  sweepExpired();
  g.__corte25Sweeper = setInterval(sweepExpired, 10 * 60_000);
  g.__corte25Sweeper.unref?.();
}
