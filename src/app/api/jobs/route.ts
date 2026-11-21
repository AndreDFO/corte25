import { promises as fs } from "fs";
import path from "path";
import { Job, jobDir, newJobId, safeName, saveJob } from "@/lib/jobs";
import { startJob } from "@/lib/engine";

const MAX_VIDEOS = 10;
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 300);

export async function POST(req: Request) {
  const form = await req.formData();
  const product = String(form.get("product") || "").trim().slice(0, 120);
  const details = String(form.get("details") || "").trim().slice(0, 1500);
  const videos = form.getAll("videos").filter((v): v is File => v instanceof File && v.size > 0);
  const music = form.get("music");

  if (!product) return Response.json({ error: "Informe o nome do produto." }, { status: 400 });
  if (videos.length === 0) return Response.json({ error: "Envie pelo menos 1 vídeo." }, { status: 400 });
  if (videos.length > MAX_VIDEOS)
    return Response.json({ error: `Envie no máximo ${MAX_VIDEOS} vídeos.` }, { status: 400 });
  for (const v of [...videos, ...(music instanceof File && music.size > 0 ? [music] : [])]) {
    if (v.size > MAX_FILE_MB * 1024 * 1024)
      return Response.json({ error: `${v.name} passa de ${MAX_FILE_MB} MB.` }, { status: 400 });
  }

  const id = newJobId();
  const dir = jobDir(id);
  await fs.mkdir(path.join(dir, "inputs"), { recursive: true });

  const inputs: string[] = [];
  for (const [i, v] of videos.entries()) {
    const name = `${String(i + 1).padStart(2, "0")}_${safeName(v.name)}`;
    await fs.writeFile(path.join(dir, "inputs", name), Buffer.from(await v.arrayBuffer()));
    inputs.push(name);
  }
  let musicName: string | undefined;
  if (music instanceof File && music.size > 0) {
    musicName = `musica_${safeName(music.name)}`;
    await fs.writeFile(path.join(dir, "inputs", musicName), Buffer.from(await music.arrayBuffer()));
  }

  const job: Job = {
    id,
    createdAt: new Date().toISOString(),
    product,
    details,
    inputs,
    music: musicName,
    status: "queued",
    message: "Na fila…",
    variations: [],
  };
  await saveJob(job);
  startJob(id);
  return Response.json({ id });
}
