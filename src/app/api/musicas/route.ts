import { connection } from "next/server";
import { currentUser } from "@/lib/auth";
import { vipAllowance } from "@/lib/vip";
import { SUGGESTIONS, searchOnline } from "@/lib/music-library";

// Busca de música grátis (CC0/domínio público) no Openverse, na hora. Só para quem pode usar música (VIP ou cota VIP).
export async function GET(req: Request) {
  await connection();
  const q = new URL(req.url).searchParams.get("q") || "";
  if (!q) return Response.json({ suggestions: SUGGESTIONS });
  const user = await currentUser().catch(() => null);
  // VIP, cupom com música ou assinante com cota VIP do mês.
  const a = await vipAllowance(user).catch(() => null);
  if (!a || !(a.vip || a.features.includes("musica") || a.quota > 0))
    return Response.json({ error: "A música é exclusiva do VIP." }, { status: 403 });
  try {
    return Response.json({ tracks: await searchOnline(q) });
  } catch (e) {
    console.log("[músicas] busca falhou:", (e as Error).message);
    return Response.json({ error: "A busca de músicas não respondeu. Tente de novo em instantes." }, { status: 502 });
  }
}
