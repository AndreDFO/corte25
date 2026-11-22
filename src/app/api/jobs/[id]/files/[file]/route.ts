import { canAccessJob, forbidden } from "@/lib/job-access";
import { createReadStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { jobDir, loadJob } from "@/lib/jobs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await ctx.params;
  if (!/^[a-f0-9]{16}$/.test(id) || !/^video_\d{2}\.mp4$/.test(file))
    return new Response("não encontrado", { status: 404 });
  const job = await loadJob(id);
  if (!job) return new Response("não encontrado", { status: 404 });
  if (!(await canAccessJob(job))) return forbidden();
  const full = path.join(jobDir(id), "outputs", file);
  let size: number;
  try {
    size = (await fs.stat(full)).size;
  } catch {
    return new Response("não encontrado", { status: 404 });
  }
  const download = new URL(req.url).searchParams.has("download");
  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };
  if (download) headers["Content-Disposition"] = `attachment; filename="${file}"`;

  const range = req.headers.get("range");
  const m = range?.match(/bytes=(\d*)-(\d*)/);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
