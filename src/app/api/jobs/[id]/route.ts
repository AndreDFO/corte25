import fs from "node:fs/promises";
import { currentUser } from "@/lib/auth";
import { canAccessJob, forbidden, jobOwner } from "@/lib/job-access";
import { jobDir, loadJob } from "@/lib/jobs";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";
import { expiresAt } from "@/lib/retention";
import { canNarrate } from "@/lib/narration";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{16}$/.test(id)) return Response.json({ error: "não encontrado" }, { status: 404 });
  const job = await loadJob(id);
  if (!job) return Response.json({ error: "não encontrado" }, { status: 404 });
  if (!(await canAccessJob(job))) return forbidden();
  return Response.json({ ...job, expiresAt: expiresAt(job), canNarrate: await canNarrate() }, { headers: { "Cache-Control": "no-store" } });
}

// Excluir um lote para sempre (pedido do Andre). Só a conta dona pode; lotes sem dono
// (teste sem login) não são apagados no servidor: a tela só tira da lista do navegador.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{16}$/.test(id)) return Response.json({ error: "não encontrado" }, { status: 404 });
  const job = await loadJob(id);
  if (!job) return Response.json({ ok: true, removed: false });
  const owner = await jobOwner(job);
  if (!owner) return Response.json({ ok: true, removed: false });
  const user = await currentUser().catch(() => null);
  if (user?.id !== owner) return forbidden();
  if (job.status !== "done" && job.status !== "error")
    return Response.json({ error: "Espere os vídeos terminarem de ser feitos para excluir." }, { status: 409 });
  await fs.rm(jobDir(id), { recursive: true, force: true });
  if (supabaseConfigured()) await supabaseAdmin().from("job_owners").delete().eq("job_id", id);
  return Response.json({ ok: true, removed: true }, { headers: { "Cache-Control": "no-store" } });
}
