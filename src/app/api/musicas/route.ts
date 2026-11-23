import { connection } from "next/server";
import { currentUser } from "@/lib/auth";
import { vipAllowance } from "@/lib/vip";
import { SUGGESTIONS, searchOnline } from "@/lib/music-library";
import { ipKey, rateLimited } from "@/lib/support";

// Busca de música grátis (CC0/domínio público) no Openverse, na hora. Só para quem pode usar música (VIP ou cota VIP).
export async function GET(req: Request) {
  await connection();
  const q = new URL(req.url).searchParams.get("q") || "";
  if (!q) return Response.json({ suggestions: SUGGESTIONS });
  const user = await currentUser().catch(() => null);
  // VIP, cupom com música ou assinante com cota VIP do mês.
  // Teste grátis (teste=1): qualquer pessoa pode buscar, com limite por IP. O servidor do lote só
  // aceita a música no teste grátis ou para quem é VIP, então liberar a busca não libera o lote pago.
  const trial = new URL(req.url).searchParams.get("teste") === "1";
  const a = await vipAllowance(user).catch(() => null);
  const allowed = Boolean(a && (a.vip || a.features.includes("musica") || a.quota > 0));
  if (!allowed && !trial) return Response.json({ error: "A música é exclusiva do VIP." }, { status: 403 });
  if (!allowed && rateLimited("musicas:" + ipKey(req), 30, 3600_000))
    return Response.json({ error: "Muitas buscas seguidas. Espere um pouco e tente de novo." }, { status: 429 });
  try {
    return Response.json({ tracks: await searchOnline(q) });
  } catch (e) {
    console.log("[músicas] busca falhou:", (e as Error).message);
    return Response.json({ error: "A busca de músicas não respondeu. Tente de novo em instantes." }, { status: 502 });
  }
}
