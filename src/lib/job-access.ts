import { currentUser } from "./auth";
import type { Job } from "./jobs";
import { supabaseAdmin, supabaseConfigured } from "./supabase-admin";

// Quem pode ver um lote: se ele foi gerado com login, só a conta dona. Lotes sem dono
// (teste grátis feito sem login) continuam abertos para quem tem o link.
export async function jobOwner(job: Job): Promise<string | null> {
  if (job.ownerId !== undefined) return job.ownerId;
  if (!supabaseConfigured()) return null;
  const { data } = await supabaseAdmin().from("job_owners").select("user_id").eq("job_id", job.id).maybeSingle();
  return data?.user_id ?? null;
}

export async function canAccessJob(job: Job): Promise<boolean> {
  const owner = await jobOwner(job);
  if (!owner) return true;
  const user = await currentUser().catch(() => null);
  return user?.id === owner;
}

export const forbidden = () =>
  Response.json(
    { error: "Este lote é de outra conta. Entre com a conta que gerou os vídeos.", code: "owner" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
