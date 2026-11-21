import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export interface CopyItem {
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
}

const CopySchema = z.object({
  items: z.array(
    z.object({
      hook: z.string(),
      caption: z.string(),
      cta: z.string(),
      hashtags: z.array(z.string()),
    }),
  ),
});

const SYSTEM = `Você é um copywriter especialista em vídeos curtos que vendem no TikTok Shop Brasil.
Escreva em português do Brasil, linguagem natural de criador de conteúdo, sem promessas falsas nem alegações de saúde ou resultado garantido (isso viola as regras do TikTok Shop).
Cada item precisa de um ângulo diferente: dor, curiosidade, prova social, comparação, preço/oferta, antes e depois, "achadinho", unboxing, tutorial rápido, POV, urgência leve, etc.
- hook: aparece na tela nos 3 primeiros segundos. Máximo 45 caracteres. Sem emojis.
- cta: texto final na tela. Máximo 32 caracteres. Sem emojis. Ex.: "Toca no carrinho laranja".
- caption: legenda do post, até 150 caracteres, pode ter 1 ou 2 emojis.
- hashtags: 3 a 5, sem o símbolo #, minúsculas, sem espaços.`;

export async function generateCopy(
  product: string,
  details: string,
  count: number,
): Promise<{ items: CopyItem[]; source: "claude" | "template" }> {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    try {
      const client = new Anthropic();
      const response = await client.messages.parse({
        model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
        max_tokens: 16000,
        system: SYSTEM,
        output_config: { effort: "low", format: zodOutputFormat(CopySchema) },
        messages: [
          {
            role: "user",
            content: `Produto: ${product}\nDetalhes do produto e da oferta: ${details || "(não informado)"}\n\nCrie exatamente ${count} itens, todos com ângulos e hooks diferentes entre si.`,
          },
        ],
      });
      if (response.stop_reason !== "refusal" && response.parsed_output) {
        const items = response.parsed_output.items.map(clean).filter((i) => i.hook);
        if (items.length >= count) return { items: items.slice(0, count), source: "claude" };
        if (items.length > 0) {
          const extra = templateCopy(product, count - items.length);
          return { items: [...items, ...extra], source: "claude" };
        }
      }
      console.warn("[copy] resposta sem itens válidos, usando modelos prontos");
    } catch (err) {
      console.error("[copy] falha ao chamar Claude, usando modelos prontos:", err);
    }
  }
  return { items: templateCopy(product, count), source: "template" };
}

function clean(i: CopyItem): CopyItem {
  return {
    hook: i.hook.trim().slice(0, 60),
    cta: i.cta.trim().slice(0, 40),
    caption: i.caption.trim().slice(0, 220),
    hashtags: i.hashtags.map((h) => h.replace(/[#\s]/g, "").toLowerCase()).filter(Boolean).slice(0, 5),
  };
}

const HOOKS = [
  "Ninguém me contou sobre isso antes",
  "Achadinho que vale cada centavo",
  "Para de rolar, olha isso",
  "Eu não acreditei até testar",
  "O que eu queria ter comprado antes",
  "POV: você finalmente achou o {p}",
  "3 motivos para ter um {p}",
  "Isso aqui resolveu minha vida",
  "Testei o {p} viral do TikTok",
  "Barato e funciona? Vem ver",
  "Todo mundo tá perguntando dele",
  "Antes e depois de usar o {p}",
  "Não compre {p} sem ver isso",
  "O segredo que ninguém fala",
  "Comprei pelo TikTok e chegou assim",
  "Vale a pena? Minha opinião sincera",
  "Esse é o meu favorito do ano",
  "Unboxing do {p} mais pedido",
  "Se você tem esse problema, assiste",
  "Melhor compra do mês, sem dúvida",
  "Olha o que esse {p} faz",
  "Meu marido achou que era caro",
  "Só descobri agora e tô chocada",
  "Presente perfeito e baratinho",
  "Corre que ainda tem estoque",
];
const CTAS = [
  "Toca no carrinho laranja",
  "Link no carrinho",
  "Garanta o seu agora",
  "Corre que tá acabando",
  "Clica no carrinho",
];

export function templateCopy(product: string, count: number): CopyItem[] {
  const p = product.trim() || "produto";
  const tag = p.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  return Array.from({ length: count }, (_, i) => {
    const hook = HOOKS[i % HOOKS.length].replace("{p}", p);
    return {
      hook,
      cta: CTAS[i % CTAS.length],
      caption: `${hook} 😍 ${p} com entrega rápida pelo TikTok Shop.`,
      hashtags: ["tiktokshop", "achadinhos", tag || "oferta", "viral"],
    };
  });
}
