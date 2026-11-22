import { connection } from "next/server";
import { currentUser } from "@/lib/auth";
import { balance } from "@/lib/credits";

// Saldo em vídeos de quem está logado (para o formulário da página inicial).
export async function GET() {
  await connection();
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ logged: false, videos: 0 }, { headers: { "Cache-Control": "no-store" } });
  const videos = await balance(user.id).catch(() => 0);
  return Response.json({ logged: true, videos }, { headers: { "Cache-Control": "no-store" } });
}
