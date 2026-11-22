import { connection } from "next/server";
import { currentUser } from "@/lib/auth";
import { balance } from "@/lib/credits";
import { isVip, vipAllowance } from "@/lib/vip";

// Saldo em vídeos de quem está logado (para o formulário da página inicial).
export async function GET() {
  await connection();
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ logged: false, videos: 0, vip: await isVip(null) }, { headers: { "Cache-Control": "no-store" } });
  const videos = await balance(user.id).catch(() => 0);
  const a = await vipAllowance(user).catch(() => ({ vip: false, features: [] as string[], quota: 0, subscriber: false }));
  return Response.json({ logged: true, videos, vip: a.vip, vipFeatures: a.features, vipQuota: a.vip ? null : a.quota, subscriber: a.subscriber }, { headers: { "Cache-Control": "no-store" } });
}
