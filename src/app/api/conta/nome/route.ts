import { connection } from "next/server";
import { currentUser, updateProfile } from "@/lib/auth";

// Salva o nome da conta (aparece no topo do site como "Olá, nome").
export async function POST(req: Request) {
  await connection();
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (name.length < 2) return Response.json({ error: "Digite seu nome." }, { status: 400 });
  await updateProfile(user.id, { name });
  return Response.json({ ok: true, name });
}
