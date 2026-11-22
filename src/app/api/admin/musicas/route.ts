import { connection } from "next/server";
import { isOwnerAdmin } from "@/lib/admin";
import { refreshLibrary } from "@/lib/music-library";

// Botão do admin: atualizar a biblioteca de músicas agora (normalmente é 1x por semana sozinho).
export async function POST() {
  await connection();
  if (!(await isOwnerAdmin())) return Response.json({ error: "Acesso negado." }, { status: 403 });
  const n = await refreshLibrary().catch(() => -1);
  if (n < 0) return Response.json({ error: "Não deu para buscar agora. Tente mais tarde." }, { status: 502 });
  return Response.json({ ok: true, tracks: n });
}
