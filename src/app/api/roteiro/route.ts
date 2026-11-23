import { connection } from "next/server";
import { currentUser } from "@/lib/auth";
import { vipAllowance } from "@/lib/vip";
import { supabaseConfigured } from "@/lib/supabase-admin";
import { ipKey, rateLimited } from "@/lib/support";
import { MAX_PRODUCT_CHARS, generatePlano } from "@/lib/roteiro";

// Área "Criadores": gera o plano de gravação (roteiro 3x3x3 e o resto) com a IA.
// Grátis, mas SÓ COM LOGIN (escolha do Andre, 23/11), com limites para o custo da IA (cada plano custa centavos):
// com login: 5 por dia; VIP ou assinante: 30 por dia. Sem Supabase (modo de teste local) libera 2 por dia por IP.
// Mais um teto por IP (10/dia) e um teto geral do site por dia (ROTEIRO_LIMITE_DIA, padrão 500).
const DAY = 24 * 3600_000;
const LIMITS = { anon: 2, conta: 5, vip: 30 };
// Exige conta só quando o login existe (no PC de teste, sem Supabase, não dá para entrar).
const loginRequired = () => supabaseConfigured();
const PER_IP = 10;

type Tier = keyof typeof LIMITS;

// Usos guardados na memória do servidor (o site roda numa instância só; zera ao publicar nova versão).
const uses = new Map<string, number[]>();
function used(key: string) {
  const now = Date.now();
  const list = (uses.get(key) || []).filter((t) => now - t < DAY);
  uses.set(key, list);
  return list.length;
}
function mark(key: string) {
  uses.set(key, [...(uses.get(key) || []), Date.now()]);
}

async function who(req: Request) {
  const user = await currentUser().catch(() => null);
  let tier: Tier = "anon";
  if (user) {
    const a = await vipAllowance(user).catch(() => null);
    tier = a?.vip || a?.subscriber ? "vip" : "conta";
  }
  const ip = ipKey(req);
  const key = user ? `u:${user.id}` : `ip:${ip}`;
  return { user, tier, key, ip, left: Math.max(0, Math.min(LIMITS[tier] - used(key), PER_IP - used(`ipall:${ip}`))) };
}

export async function GET(req: Request) {
  await connection();
  const w = await who(req);
  return Response.json({ logado: Boolean(w.user), precisaLogin: !w.user && loginRequired(), plano: w.tier, restantes: w.left, limite: LIMITS[w.tier] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  await connection();
  const body = await req.json().catch(() => null);
  const product = String(body?.produto ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_PRODUCT_CHARS);
  let link = String(body?.link ?? "").trim().slice(0, 600);
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
  if (link) {
    try {
      new URL(link);
    } catch {
      return Response.json({ error: "Esse link não parece válido. Confira ou apague e escreva só o produto." }, { status: 400 });
    }
  }
  if (product.length < 3 && !link) return Response.json({ error: "Escreva o produto que você quer vender ou cole o link dele." }, { status: 400 });

  const w = await who(req);
  if (!w.user && loginRequired())
    return Response.json({ error: "Entre na sua conta (é grátis) para criar seu plano de gravação.", login: true }, { status: 401 });
  if (w.left <= 0) {
    const msg =
      w.tier === "anon"
        ? "Você já usou os 2 planos de teste de hoje."
        : w.tier === "conta"
          ? "Você já usou os 5 planos de hoje. Amanhã libera de novo, ou assine/seja VIP para criar até 30 por dia."
          : "Você chegou ao limite de 30 planos de hoje. Amanhã libera de novo.";
    return Response.json({ error: msg, limite: true }, { status: 429 });
  }
  if (rateLimited("roteiro:site", Number(process.env.ROTEIRO_LIMITE_DIA) || 500, DAY))
    return Response.json({ error: "Muita gente criando roteiros agora. Tente de novo daqui a pouco." }, { status: 429 });
  // Evita cliques repetidos em sequência.
  if (rateLimited(`roteiro:rajada:${w.ip}`, 3, 60_000))
    return Response.json({ error: "Calma, um plano por vez. Tente de novo em 1 minuto." }, { status: 429 });

  mark(w.key);
  mark(`ipall:${w.ip}`);
  const estilo = body?.estilo === "sem_rosto" ? "sem_rosto" : "rosto";
  const plano = await generatePlano(product, link, estilo);
  return Response.json({ plano, restantes: Math.max(0, w.left - 1) });
}
