import { canAccessJob, forbidden } from "@/lib/job-access";
import { createWriteStream, openAsBlob, promises as fs } from "fs";
import path from "path";
import { finished } from "stream/promises";
import { ZipArchive } from "archiver";
import { jobDir, loadJob, type Job } from "@/lib/jobs";
import { captionsText } from "@/lib/captions";
import { ZIP_PART } from "@/lib/pricing";

// Monta o ZIP inteiro em disco antes de enviar. Assim o download tem tamanho conhecido
// (Content-Length), o celular mostra o progresso e um download cortado não vira um ZIP "quebrado".
const building = new Map<string, Promise<string>>();


async function buildZip(job: Job, part: number): Promise<string> {
  const dir = jobDir(job.id);
  const base = part ? `videos-parte${part}` : "videos";
  const final = path.join(dir, `${base}.zip`);
  const all = job.variations.filter((v) => v.status === "done");
  const done = part ? all.slice((part - 1) * ZIP_PART, part * ZIP_PART) : all;
  const stamp = done.map((v) => v.file).join(",");
  const stampFile = path.join(dir, `${base}.zip.txt`);
  try {
    if ((await fs.readFile(stampFile, "utf8")) === stamp) {
      await fs.stat(final);
      return final;
    }
  } catch {}

  const tmp = path.join(dir, `${base}.zip.${process.pid}.tmp`);
  const out = createWriteStream(tmp);
  const zip = new ZipArchive({ zlib: { level: 0 } });
  zip.pipe(out);
  for (const v of done) zip.file(path.join(dir, "outputs", v.file), { name: v.file });
  zip.append(captionsText(job), { name: "legendas.txt" });
  await zip.finalize();
  await finished(out);
  await fs.rename(tmp, final);
  await fs.writeFile(stampFile, stamp);
  return final;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{16}$/.test(id)) return new Response("não encontrado", { status: 404 });
  const job = await loadJob(id);
  if (!job) return new Response("não encontrado", { status: 404 });
  if (!(await canAccessJob(job))) return forbidden();
  if (job.status !== "done" && job.status !== "error")
    return new Response("os vídeos ainda estão sendo gerados", { status: 409 });

  const done = job.variations.filter((v) => v.status === "done").length;
  const part = Number(new URL(req.url).searchParams.get("parte") || 0);
  if (!Number.isInteger(part) || part < 0 || (part > 0 && (part - 1) * ZIP_PART >= done))
    return new Response("parte inválida", { status: 404 });
  const key = `${id}:${part}`;

  let file: string;
  try {
    let p = building.get(key);
    if (!p) {
      p = buildZip(job, part).finally(() => building.delete(key));
      building.set(key, p);
    }
    file = await p;
  } catch (err) {
    console.error("[zip] falha ao montar o ZIP:", err);
    return new Response("falha ao montar o ZIP", { status: 500 });
  }

  // Blob tem tamanho conhecido: o servidor envia Content-Length (com stream ele manda "chunked").
  const blob = await openAsBlob(file);
  return new Response(blob, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(blob.size),
      "Content-Disposition": `attachment; filename="corte25_${id}${part ? `_parte${part}` : ""}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
