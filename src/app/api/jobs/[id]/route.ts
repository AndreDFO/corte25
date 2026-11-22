import { canAccessJob, forbidden } from "@/lib/job-access";
import { loadJob } from "@/lib/jobs";
import { expiresAt } from "@/lib/retention";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{16}$/.test(id)) return Response.json({ error: "não encontrado" }, { status: 404 });
  const job = await loadJob(id);
  if (!job) return Response.json({ error: "não encontrado" }, { status: 404 });
  if (!(await canAccessJob(job))) return forbidden();
  return Response.json({ ...job, expiresAt: expiresAt(job) }, { headers: { "Cache-Control": "no-store" } });
}
