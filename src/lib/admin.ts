import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { currentUser } from "./auth";

// Acesso do dono às páginas internas (ex.: /contatos):
// - com o login ativo, entrar com um e-mail listado em ADMIN_EMAILS; ou
// - abrir /api/admin?chave=<ADMIN_KEY> uma vez neste navegador (cookie de 30 dias).
export const ADMIN_COOKIE = "corte25_admin";
export const keyHash = (k: string) => createHash("sha256").update(`corte25-admin:${k}`).digest("hex");

export function keyMatches(given: string) {
  const key = process.env.ADMIN_KEY;
  if (!key || key.length < 12) return false;
  const a = Buffer.from(keyHash(given));
  const b = Buffer.from(keyHash(key));
  return timingSafeEqual(a, b);
}

export async function isAdmin() {
  const key = process.env.ADMIN_KEY;
  const store = await cookies();
  if (key && key.length >= 12 && store.get(ADMIN_COOKIE)?.value === keyHash(key)) return true;
  const emails = (process.env.ADMIN_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (!emails.length) return false;
  const user = await currentUser();
  return Boolean(user?.email && emails.includes(user.email.toLowerCase()));
}
