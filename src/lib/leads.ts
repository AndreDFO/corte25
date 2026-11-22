import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR } from "./jobs";

// WhatsApp de quem fez o teste grátis, para o contato no dia seguinte.
// Fica só no servidor (data/leads.json), nunca vai para a página nem para a API pública.
const FILE = path.join(DATA_DIR, "leads.json");
let lock = Promise.resolve();

export interface Lead {
  whatsapp: string;
  product: string;
  jobId: string;
  createdAt: string;
}

// Aceita (11) 91234-5678, 11912345678, +55 11 91234-5678. Devolve 55DDDNÚMERO ou null.
export function normalizeWhatsapp(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  if (d.length === 11 && d[2] !== "9") return null;
  if (Number(d.slice(0, 2)) < 11) return null;
  return "55" + d;
}

export function saveLead(lead: Lead) {
  const run = lock.then(async () => {
    let list: Lead[] = [];
    try {
      list = JSON.parse(await fs.readFile(FILE, "utf8"));
    } catch {}
    list.push(lead);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE + ".tmp", JSON.stringify(list, null, 2));
    await fs.rename(FILE + ".tmp", FILE);
  });
  lock = run.catch(() => {});
  return run;
}

export async function listLeads(): Promise<Lead[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}
