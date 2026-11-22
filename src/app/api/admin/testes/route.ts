import { connection } from "next/server";
import { isOwnerAdmin } from "@/lib/admin";
import { resetTrials } from "@/lib/trials";

// Botão do admin: libera o teste grátis de novo para todo mundo (zera os bloqueios).
export async function POST() {
  await connection();
  if (!(await isOwnerAdmin())) return Response.json({ error: "Acesso negado." }, { status: 403 });
  await resetTrials();
  return Response.json({ ok: true });
}
