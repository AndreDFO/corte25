import { connection } from "next/server";
import { currentUser } from "@/lib/auth";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase-admin";
import {
  MAX_SCREENSHOT_CHARS,
  cleanMessages,
  ipKey,
  rateLimited,
  supportEnabled,
  supportReply,
} from "@/lib/support";

// Botão "Relatar problema".
// GET: diz se a pessoa está logada (para pedir contato só de quem não está).
// POST {acao:"conversar"}: uma resposta da IA (limite por IP para o custo ficar baixo).
// POST {acao:"enviar"}: salva o relato no Supabase (tabela bug_reports).

const HOUR = 3600_000;

function browserInfo(raw: unknown, req: Request) {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown, n = 300) => String(v ?? "").slice(0, n);
  return {
    url: s(b.url, 500),
    referrer: s(b.referrer, 300),
    screen: s(b.screen, 40),
    viewport: s(b.viewport, 40),
    language: s(b.language, 20),
    erros: Array.isArray(b.erros) ? b.erros.slice(-8).map((e) => s(e, 400)) : [],
    userAgent: s(req.headers.get("user-agent"), 400),
  };
}

export async function GET() {
  await connection();
  const user = await currentUser();
  return Response.json({ logado: Boolean(user), ia: supportEnabled() });
}

export async function POST(req: Request) {
  await connection();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Pedido inválido." }, { status: 400 });
  const key = ipKey(req);
  const info = browserInfo(body.info, req);

  if (body.acao === "conversar") {
    const messages = cleanMessages(body.mensagens);
    if (!messages) return Response.json({ error: "Conversa inválida." }, { status: 400 });
    if (!supportEnabled()) return Response.json({ semIa: true });
    if (rateLimited(`chat:${key}`, 40, HOUR) || rateLimited(`chatdia:${key}`, 120, 24 * HOUR))
      return Response.json({ limite: true });
    try {
      const ctx = `página aberta: ${info.url || "?"}; tela: ${info.viewport || "?"}; ${info.erros.length ? `erros no navegador: ${info.erros.join(" | ")}` : "sem erros registrados no navegador"}`;
      return Response.json(await supportReply(messages, ctx));
    } catch (err) {
      console.error("[relatos] falha ao chamar Claude:", err);
      return Response.json({ semIa: true });
    }
  }

  if (body.acao === "enviar") {
    if (!supabaseConfigured()) return Response.json({ error: "Relatos indisponíveis neste modo de teste." }, { status: 503 });
    if (rateLimited(`envio:${key}`, 6, 24 * HOUR))
      return Response.json({ error: "Você já enviou vários relatos hoje. Obrigado! A equipe vai analisar." }, { status: 429 });
    const transcript = cleanMessages(body.mensagens, false) || [];
    const firstUser = transcript.find((m) => m.role === "user")?.content || "";
    const summary = String(body.resumo || firstUser).trim().slice(0, 140);
    if (!summary) return Response.json({ error: "Conte o que aconteceu antes de enviar." }, { status: 400 });
    let screenshot: string | null = null;
    if (typeof body.print === "string" && body.print) {
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.print) || body.print.length > MAX_SCREENSHOT_CHARS)
        return Response.json({ error: "O print está grande demais. Tente outra imagem." }, { status: 400 });
      screenshot = body.print;
    }
    const user = await currentUser();
    const { data, error } = await supabaseAdmin()
      .from("bug_reports")
      .insert({
        summary,
        details: String(body.detalhes || "").slice(0, 4000) || null,
        page: String(body.pagina || "").slice(0, 200) || info.url || null,
        user_id: user?.id ?? null,
        email: user?.email ?? null,
        contact: String(body.contato || "").trim().slice(0, 120) || null,
        transcript,
        browser: info,
        screenshot,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[relatos] falha ao salvar:", error.message);
      return Response.json({ error: "Não consegui salvar agora. Tente de novo em instantes." }, { status: 500 });
    }
    return Response.json({ ok: true, id: data.id });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
