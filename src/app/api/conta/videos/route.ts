import { connection } from "next/server";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Lotes da conta (qualquer aparelho), das últimas 48 h: a página "Meus vídeos" junta com a lista do navegador.
export async function GET() {
  await connection();
  const user = await currentUser().catch(() => null);
  if (!user) return Response.json({ logged: false, ids: [] }, { headers: { "Cache-Control": "no-store" } });
  const since = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data } = await supabaseAdmin()
    .from("job_owners")
    .select("job_id")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);
  return Response.json({ logged: true, ids: (data ?? []).map((r) => r.job_id) }, { headers: { "Cache-Control": "no-store" } });
}
