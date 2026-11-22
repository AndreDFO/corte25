import { isAdmin } from "@/lib/admin";
import { testSiteEnabled } from "@/lib/extras";

// A tela de geração pergunta se a conta pode ver as melhorias em teste (só o administrador).
export async function GET() {
  const admin = testSiteEnabled() || (await isAdmin().catch(() => false));
  return Response.json({ admin }, { headers: { "Cache-Control": "no-store" } });
}
