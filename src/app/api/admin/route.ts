import { NextResponse } from "next/server";
import { ADMIN_COOKIE, keyHash, keyMatches } from "@/lib/admin";

// /api/admin?chave=... grava o acesso do dono neste navegador e abre /contatos.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const given = url.searchParams.get("chave") || "";
  if (!keyMatches(given)) return new Response("chave inválida", { status: 403 });
  const res = NextResponse.redirect(new URL("/contatos", url));
  res.cookies.set(ADMIN_COOKIE, keyHash(given), {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
