import { NextResponse } from "next/server";
import { ADMIN_COOKIE, keyHash, keyMatches } from "@/lib/admin";

// Grava o acesso do dono neste navegador (cookie de 30 dias) e volta para /contatos.
// Aceita o formulário de /contatos (POST, campo "chave") ou /api/admin?chave=... (GET).
// O redirecionamento usa caminho relativo: atrás do Railway, req.url pode trazer o endereço interno.
// volta: "/admin" (área do administrador) ou "/contatos" (padrão).
function respond(req: Request, given: string, volta: string) {
  const ok = keyMatches(given.trim());
  const to = volta === "/admin" ? "/admin" : "/contatos";
  const res = new NextResponse(null, { status: 303, headers: { Location: ok ? to : `${to}?erro=1` } });
  if (ok)
    res.cookies.set(ADMIN_COOKIE, keyHash(given.trim()), {
      httpOnly: true,
      secure: (req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "")) === "https",
      sameSite: "lax",
      path: "/",
      maxAge: to === "/admin" ? 60 * 60 * 12 : 60 * 60 * 24 * 30,
    });
  return res;
}

export async function GET(req: Request) {
  return respond(req, new URL(req.url).searchParams.get("chave") || "", new URL(req.url).searchParams.get("volta") || "");
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  return respond(req, String(form?.get("chave") || ""), String(form?.get("volta") || ""));
}
