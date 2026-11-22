import { canAccessJob, forbidden } from "@/lib/job-access";
import { loadJob, type Variation } from "@/lib/jobs";
import { MAX_AUDIO_BYTES, canNarrate, mixNarration, removeNarration } from "@/lib/narration";

const noStore = { "Cache-Control": "no-store" };
const err = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });

async function target(id: string, index: number): Promise<{ res: Response; v?: never } | { res?: never; v: Variation }> {
  if (!/^[a-f0-9]{16}$/.test(id)) return { res: err("não encontrado", 404) };
  const job = await loadJob(id);
  if (!job) return { res: err("Esses vídeos não estão mais disponíveis.", 404) };
  if (!(await canAccessJob(job))) return { res: forbidden() };
  const v = job.variations.find((x) => x.index === index);
  if (!v || v.status !== "done") return { res: err("Vídeo não encontrado.", 404) };
  if (!(await canNarrate(v))) return { res: err("A narração é exclusiva do plano VIP.", 403) };
  return { v };
}

// Recebe a voz gravada no navegador e troca o áudio do vídeo por ela.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("Envio inválido.", 400);
  }
  const t = await target(id, Number(form.get("index")));
  if (t.res) return t.res;
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 500) return err("Gravação vazia. Grave de novo.", 400);
  if (audio.size > MAX_AUDIO_BYTES) return err("Gravação grande demais.", 413);
  const type = audio.type || "";
  const ext = type.includes("mp4") || type.includes("aac") || type.includes("m4a") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  try {
    const v = await mixNarration(id, t.v, Buffer.from(await audio.arrayBuffer()), ext, Number(form.get("offset")) || 0);
    return Response.json({ ok: true, variation: v }, { headers: noStore });
  } catch (e) {
    console.error("[narração] falhou:", e);
    return err("Não consegui juntar a narração ao vídeo. Tente de novo.", 500);
  }
}

// Volta ao áudio original (apaga a narração).
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const t = await target(id, Number(new URL(req.url).searchParams.get("index")));
  if (t.res) return t.res;
  const v = await removeNarration(id, t.v);
  return Response.json({ ok: true, variation: v }, { headers: noStore });
}
