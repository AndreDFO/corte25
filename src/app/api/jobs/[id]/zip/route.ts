import path from "path";
import { PassThrough, Readable } from "stream";
import { ZipArchive } from "archiver";
import { jobDir, loadJob } from "@/lib/jobs";
import { captionsText } from "@/lib/captions";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{16}$/.test(id)) return new Response("não encontrado", { status: 404 });
  const job = await loadJob(id);
  if (!job) return new Response("não encontrado", { status: 404 });

  const pass = new PassThrough();
  const zip = new ZipArchive({ zlib: { level: 0 } });
  zip.on("error", (e: Error) => pass.destroy(e));
  zip.pipe(pass);
  for (const v of job.variations.filter((v) => v.status === "done")) {
    zip.file(path.join(jobDir(id), "outputs", v.file), { name: v.file });
  }
  zip.append(captionsText(job), { name: "legendas.txt" });
  zip.finalize();

  return new Response(Readable.toWeb(pass) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="videos_${id}.zip"`,
    },
  });
}
