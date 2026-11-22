import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Job, jobDir, newJobId, safeName, saveJob } from "@/lib/jobs";
import { startJob } from "@/lib/engine";
import { trackPath } from "@/lib/music-library";
import { spendVipQuota, vipAllowance } from "@/lib/vip";
import { BATCH_VIDEOS, FREE_MAX_PER_BLOCK, FREE_VIDEOS, MAX_PER_BLOCK, VIDEO_CHOICES, bonusFor } from "@/lib/pricing";
import { claimTrial, trialKeys } from "@/lib/trials";
import { normalizeWhatsapp, saveLead } from "@/lib/leads";
import { currentUser } from "@/lib/auth";
import { consumeVideos } from "@/lib/credits";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";

const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 300);

const files = (form: FormData, name: string) =>
  form.getAll(name).filter((v): v is File => v instanceof File && v.size > 0);

export async function POST(req: Request) {
  const form = await req.formData();
  // Nome do produto é opcional (pedido do Andre): sem nome, o lote fica com a data e a hora em que foi gerado.
  const typed = String(form.get("product") || "").trim().slice(0, 120);
  const product =
    typed ||
    `Vídeos de ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).replace(",", " às")}`;
  const details = String(form.get("details") || "").trim().slice(0, 1500);
  const hooks = files(form, "hooks");
  const bodies = files(form, "bodies");
  const ctas = files(form, "ctas");
  const music = form.get("music");
  const dm = String(form.get("duration") || "auto");
  const durationMode = (["auto", "15", "20", "25", "30"].includes(dm) ? dm : "auto") as Job["durationMode"];

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
  if (plan === "free" && [hooks, bodies, ctas].some((l) => l.length > FREE_MAX_PER_BLOCK))
    return Response.json({ error: `No teste grátis envie até ${FREE_MAX_PER_BLOCK} vídeos em cada bloco.` }, { status: 400 });
  // Com login ativo (Supabase configurado), o lote completo gasta 1 crédito da conta.
  // Sem login (PC de teste), vale a trava antiga: só libera com UNLOCK_FULL=true.
  const online = supabaseConfigured();
  const user = online ? await currentUser() : null;
  if (plan === "full" && online && !user)
    return Response.json({ error: "Entre na sua conta para gerar o lote completo.", code: "login" }, { status: 401 });
  if (plan === "full" && !online && process.env.UNLOCK_FULL !== "true") {
    return Response.json(
      { error: "O pagamento ainda não está disponível. Use o teste grátis por enquanto." },
      { status: 402 },
    );
  }
  // Recursos VIP (textos, cortar silêncio, música, narração, legenda automática): só para VIP.
  // A trava é aqui no servidor; a tela só mostra o cadeado.
  // Assinante mensal sem VIP: os primeiros vídeos da cota do mês (3) saem com os recursos VIP.
  const allowance = await vipAllowance(user);
  const wantsVip =
    form.get("captions") === "1" || form.get("trimSilence") === "1" || form.get("autoCaptions") === "1" || Boolean(form.get("track")) || (music instanceof File && music.size > 0);
  const quotaVideos = !allowance.vip && plan === "full" && wantsVip ? allowance.quota : 0;
  const vip = allowance.vip || quotaVideos > 0;
  const whatsapp = plan === "free" ? normalizeWhatsapp(String(form.get("whatsapp") || "")) : null;
  if (plan === "free" && !whatsapp)
    return Response.json({ error: "Informe um WhatsApp válido com DDD para fazer o teste grátis." }, { status: 400 });
  if (plan === "free") {
    // 1 teste por pessoa: conta por rede, por navegador e por número de WhatsApp.
    const keys = [...trialKeys(req, String(form.get("clientId") || "") || null), "wa:" + crypto.createHash("sha256").update(whatsapp!).digest("hex").slice(0, 24)];
    if (user) keys.push("user:" + user.id);
    const ok = await claimTrial(keys);
    if (!ok)
      return Response.json(
        { error: "Você já usou seu teste grátis. Para gerar todas as combinações, escolha o lote completo.", code: "trial_used" },
        { status: 403 },
      );
  }

  // Quantos vídeos gerar (lote completo): 5 a 25, desconta só isso do saldo. Com 25, ganha +2 grátis.
  const asked = Number(form.get("videos") || BATCH_VIDEOS);
  const videos = (VIDEO_CHOICES as readonly number[]).includes(asked) ? asked : BATCH_VIDEOS;
  const id = newJobId();
  if (plan === "full" && user) {
    const ok = await consumeVideos(user.id, id, videos).catch((e) => {
      console.error("[saldo]", e);
      return false;
    });
    if (!ok)
      return Response.json(
        { error: `Seu saldo não tem ${videos} vídeos. Compre um pacote ou escolha menos vídeos.`, code: "no_credits" },
        { status: 402 },
      );
  }
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
  const track = String(form.get("track") || "");
  const trackFile = vip && track && track !== "arquivo" ? await trackPath(track) : null;
  if (trackFile) {
    // Música da biblioteca (Openverse CC0/domínio público ou as faixas próprias).
    musicName = `musica_${track}${path.extname(trackFile)}`;
    await fs.copyFile(trackFile, path.join(dir, "inputs", musicName));
  } else if (vip && music instanceof File && music.size > 0) {
    musicName = `musica_${safeName(music.name)}`;
    await fs.writeFile(path.join(dir, "inputs", musicName), Buffer.from(await music.arrayBuffer()));
  }

  const job: Job = {
    id,
    createdAt: new Date().toISOString(),
    product,
    productGiven: Boolean(typed),
    captions: vip && form.get("captions") === "1",
    ...(vip && form.get("trimSilence") === "1" ? { trimSilence: true } : {}),
    ...(vip && form.get("autoCaptions") === "1" ? { autoCaptions: true } : {}),
    details,
    inputs: [...blocks.hooks, ...blocks.bodies, ...blocks.ctas],
    blocks,
    music: musicName,
    plan,
    count: plan === "full" ? videos + bonusFor(videos) : FREE_VIDEOS,
    ...(quotaVideos > 0 ? { vipLimit: Math.min(quotaVideos, videos + bonusFor(videos)) } : {}),
    durationMode,
    status: "queued",
    message: "Na fila…",
    variations: [],
    ownerId: user?.id ?? null,
  };
  await saveJob(job);
  if (user && job.vipLimit) await spendVipQuota(user.id, id, job.vipLimit).catch((e) => console.warn("[vip] cota", e));
  // Liga o lote à conta (o lote pago já é ligado ao descontar o saldo): aparece em "Meus vídeos" em qualquer aparelho.
  if (user && plan === "free")
    await supabaseAdmin().from("job_owners").insert({ job_id: id, user_id: user.id }).then(() => {}, () => {});
  if (whatsapp) await saveLead({ whatsapp, product, jobId: id, createdAt: job.createdAt }).catch(() => {});
  startJob(id);
  return Response.json({ id });
}
