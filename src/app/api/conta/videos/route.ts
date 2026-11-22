import { connection } from "next/server";
import { currentUser } from "@/lib/auth";
import { loadJob } from "@/lib/jobs";
import { expiresAt, RETENTION_HOURS } from "@/lib/retention";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

// "Meus vídeos" numa ida só: antes a página abria cada lote um por um (/api/jobs/<id>), e cada um
// consultava o login de novo no Supabase. Com muitos lotes ficava lenta, principalmente no celular.
// Agora o servidor confere o login uma vez, lê os lotes juntos e devolve só o resumo da lista.
// Com login: os lotes da conta (de qualquer aparelho). Sem login: os ids deste navegador (?ids=a,b,c),
// tirando os que são de alguma conta.
const ID = /^[a-f0-9]{16}$/;
const headers = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  await connection();
  const user = await currentUser().catch(() => null);
  let ids: string[];
  if (user) {
    const since = new Date(Date.now() - RETENTION_HOURS * 3600_000).toISOString();
    const { data } = await supabaseAdmin()
      .from("job_owners")
      .select("job_id")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);
    ids = (data ?? []).map((r) => r.job_id);
  } else {
    const q = new URL(req.url).searchParams.get("ids") || "";
    ids = [...new Set(q.split(",").filter((x) => ID.test(x)))].slice(0, 50);
  }

  const jobs = await Promise.all(ids.map((id) => (ID.test(id) ? loadJob(id) : null)));
  let visible = jobs.filter((j) => j !== null);
  if (user) visible = visible.filter((j) => !j.ownerId || j.ownerId === user.id);
  else {
    // Sem login só aparecem lotes sem dono (teste grátis feito sem conta).
    visible = visible.filter((j) => !j.ownerId);
    const unknown = visible.filter((j) => j.ownerId === undefined).map((j) => j.id);
    if (unknown.length && supabaseConfigured()) {
      const { data } = await supabaseAdmin().from("job_owners").select("job_id").in("job_id", unknown);
      const owned = new Set((data ?? []).map((r) => r.job_id));
      visible = visible.filter((j) => !owned.has(j.id));
    }
  }

  const keep = new Set(visible.map((j) => j.id));
  const rows = visible
    .map((j) => ({
      id: j.id,
      product: j.product,
      plan: j.plan,
      createdAt: j.createdAt,
      expiresAt: expiresAt(j),
      done: j.variations.filter((v) => v.status === "done").length,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Response.json({ logged: !!user, rows, gone: ids.filter((id) => !keep.has(id)) }, { headers });
}
