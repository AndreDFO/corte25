// Lista dos lotes deste navegador (enquanto não existe login). Depois vira a lista da conta.
const KEY = "corte25_jobs";

export interface MyJob {
  id: string;
  product: string;
  createdAt: string;
}

export function readMyJobs(): MyJob[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as MyJob[];
  } catch {
    return [];
  }
}

export function rememberJob(j: MyJob) {
  try {
    const list = readMyJobs().filter((x) => x.id !== j.id);
    list.unshift(j);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  } catch {}
}

export function forgetJobs(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(readMyJobs().filter((x) => !ids.includes(x.id))));
  } catch {}
}

export function timeLeft(expiresAt: string, now = Date.now()) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "expirado";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}
