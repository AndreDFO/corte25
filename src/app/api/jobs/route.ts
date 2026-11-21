import { promises as fs } from "fs";
import path from "path";
import { Job, jobDir, newJobId, safeName, saveJob } from "@/lib/jobs";
import { startJob } from "@/lib/engine";
import { BATCH_VIDEOS, FREE_VIDEOS, MAX_PER_BLOCK } from "@/lib/pricing";
import { claimTrial, trialKeys } from "@/lib/trials";

const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 300);

const files = (form: FormData, name: string) =>
  form.getAll(name).filter((v): v is File => v instanceof File && v.size > 0);

export async function POST(req: Request) {
  const form = await req.formData();
  const product = String(form.get("product") || "").trim().slice(0, 120);
  const details = String(form.get("details") || "").trim().slice(0, 1500);
  const hooks = files(form, "hooks");
  const bodies = files(form, "bodies");
  const ctas = files(form, "ctas");
  const music = form.get("music");
  const dm = String(form.get("duration") || "auto");
  const durationMode = (["auto", "15", "20", "25", "30"].includes(dm) ? dm : "auto") as Job["durationMode"];

  if (!product) return Response.json({ error: "Informe o nome do produto." }, { status: 400 });
  if (!hooks.length || !bodies.length || !ctas.length)
    return Response.json({ error: "Envie pelo menos 1 gancho, 1 corpo e 1 CTA." }, { status: 400 });
  if ([hooks, bodies, ctas].some((l) => l.length > MAX_PER_BLOCK))
    return Response.json({ error: `Envie no máximo ${MAX_PER_BLOCK} clipes em cada bloco.` }, { status: 400 });
  const all = [...hooks, ...bodies, ...ctas, ...(music instanceof File && music.size > 0 ? [music] : [])];
  for (const v of all) {
    if (v.size > MAX_FILE_MB * 1024 * 1024)
      return Response.json({ error: `${v.name} passa de ${MAX_FILE_MB} MB.` }, { status: 400 });
  }

  const plan = form.get("plan") === "full" ? "full" : "free";
  if (plan === "full" && process.env.UNLOCK_FULL !== "true") {
    return Response.json(
      { error: "O pagamento ainda não está disponível. Use o teste grátis por enquanto." },
      { status: 402 },
    );
  }
  if (plan === "free") {
    const ok = await claimTrial(trialKeys(req, String(form.get("clientId") || "") || null));
    if (!ok)
      return Response.json(
        { error: "Você já usou seu teste grátis. Para gerar todas as combinações, escolha o lote completo.", code: "trial_used" },
        { status: 403 },
      );
  }

  const id = newJobId();
  const dir = jobDir(id);
  await fs.mkdir(path.join(dir, "inputs"), { recursive: true });

  const save = async (list: File[], prefix: string) => {
    const names: string[] = [];
    for (const [i, v] of list.entries()) {
      const name = `${prefix}${i + 1}_${safeName(v.name)}`;
      await fs.writeFile(path.join(dir, "inputs", name), Buffer.from(await v.arrayBuffer()));
      names.push(name);
    }
    return names;
  };
  const blocks = {
    hooks: await save(hooks, "gancho"),
    bodies: await save(bodies, "corpo"),
    ctas: await save(ctas, "cta"),
  };
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
    inputs: [...blocks.hooks, ...blocks.bodies, ...blocks.ctas],
    blocks,
    music: musicName,
    plan,
    count: plan === "full" ? BATCH_VIDEOS : FREE_VIDEOS,
    durationMode,
    status: "queued",
    message: "Na fila…",
    variations: [],
  };
  await saveJob(job);
  startJob(id);
  return Response.json({ id });
}
