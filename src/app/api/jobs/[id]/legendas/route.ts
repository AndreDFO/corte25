import { canAccessJob, forbidden } from "@/lib/job-access";
import { loadJob } from "@/lib/jobs";
import { captionsText } from "@/lib/captions";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{16}$/.test(id)) return new Response("não encontrado", { status: 404 });
  const job = await loadJob(id);
  if (!job) return new Response("não encontrado", { status: 404 });
  if (!(await canAccessJob(job))) return forbidden();
  return new Response(captionsText(job), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="legendas_${id}.txt"`,
    },
  });
}
