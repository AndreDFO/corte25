import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase-admin";

const URL_ = SUPABASE_URL;
const ANON = SUPABASE_ANON_KEY;

// 1) Guarda o código de afiliado (?ref=) por 30 dias. 2) Renova a sessão de login.
export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const ref = req.nextUrl.searchParams.get("ref");
  const setRef = (r: NextResponse) => {
    if (ref && /^[a-z0-9_-]{3,32}$/i.test(ref) && !req.cookies.get("corte25_ref"))
      r.cookies.set("corte25_ref", ref.toLowerCase(), { maxAge: 30 * 864e2, path: "/", sameSite: "lax" });
    return r;
  };
  if (!URL_ || !ANON) return setRef(res);

  const sb = createServerClient(URL_, ANON, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  await sb.auth.getUser();
  return setRef(res);
}

export const config = {
  // Páginas e APIs de conta. Ficam de fora: arquivos estáticos, o envio e os vídeos (/api/jobs:
  // passando pelo proxy, o envio é cortado em 10 MB e falha) e o webhook do Asaas.
  matcher: ["/((?!_next/|favicon.ico|api/jobs|api/asaas).*)"],
};
