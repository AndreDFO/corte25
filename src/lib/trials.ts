import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { DATA_DIR } from "./jobs";
import { FREE_TRIALS_PER_PERSON } from "./pricing";

// Conta os testes grátis por pessoa (endereço IP + identificador salvo no navegador).
// É uma trava simples até existir login; quem apagar cookies e trocar de rede consegue repetir.
const FILE = path.join(DATA_DIR, "trials.json");
let lock = Promise.resolve();

type Store = Record<string, number>;

async function read(): Promise<Store> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}

function hash(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 24);
}

export function trialKeys(req: Request, clientId: string | null): string[] {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  const keys: string[] = [];
  if (ip) keys.push("ip:" + hash(ip));
  if (clientId) keys.push("cid:" + hash(clientId));
  if (keys.length === 0) keys.push("local");
  return keys;
}

export function trialsLimitDisabled() {
  return process.env.FREE_TRIAL_LIMIT === "off";
}

// Reserva um teste grátis. Devolve false se a pessoa já usou o limite.
export function claimTrial(keys: string[]): Promise<boolean> {
  const run = lock.then(async () => {
    if (trialsLimitDisabled()) return true;
    const store = await read();
    if (keys.some((k) => (store[k] || 0) >= FREE_TRIALS_PER_PERSON)) return false;
    for (const k of keys) store[k] = (store[k] || 0) + 1;
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(store));
    return true;
  });
  lock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// Devolve o teste grátis quando o lote não chegou a sair (erro ao criar ou nenhum vídeo gerado).
export function releaseTrial(keys: string[]): Promise<void> {
  const run = lock.then(async () => {
    if (trialsLimitDisabled() || !keys.length) return;
    const store = await read();
    for (const k of keys) if (store[k]) store[k] = Math.max(0, store[k] - 1);
    await fs.writeFile(FILE, JSON.stringify(store));
  });
  lock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// Botão do admin: zera todos os bloqueios do teste grátis (rede, navegador, WhatsApp e conta).
export function resetTrials(): Promise<void> {
  const run = lock.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, "{}");
  });
  lock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
