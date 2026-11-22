import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { isSafe, riskyReason, safeHashtags } from "./compliance";

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
Escreva em português do Brasil, linguagem natural de criador de conteúdo.
REGRAS DO TIKTOK SHOP (obrigatórias, quebrar qualquer uma pode banir a conta do vendedor):
- Nada de promessa absoluta ou superlativo: não use "garantido", "100%", "definitivo", "milagre", "o melhor", "número 1", "nunca mais", "sem risco".
- Nada de saúde, corpo ou resultado: não fale em curar, tratar, emagrecer, perder peso, rejuvenescer, "antes e depois", doenças ou resultados em X dias.
- Nada de urgência ou escassez falsa: não use "acabando", "últimas unidades", "só hoje", "corre", "vai esgotar".
- Não mande para fora do app: nada de WhatsApp, link na bio, Instagram, site, Shopee, Mercado Livre ou outras lojas.
- Não fale em grátis, brinde, sorteio, cupom ou frete grátis.
- Não invente preço, desconto, prazo de entrega ou avaliação. Use só o que estiver nos detalhes do produto.
- Não peça curtida, comentário, seguidor ou compartilhamento. Não use palavrão nem termo sensível.
- Não compare com marcas concorrentes.
Cada item precisa de um ângulo diferente: dor do dia a dia, curiosidade, opinião sincera, "achadinho", unboxing, tutorial rápido, POV, uso no dia a dia, presente, praticidade, etc.
- hook: aparece na tela nos 3 primeiros segundos. Máximo 45 caracteres. Sem emojis.
- cta: texto final na tela. Máximo 32 caracteres. Sem emojis. Ex.: "Toca no carrinho laranja".
- caption: legenda do post, até 150 caracteres, pode ter 1 ou 2 emojis.
- hashtags: 3 a 5, sem o símbolo #, minúsculas, sem espaços, sobre o produto e a categoria (nada de fyp, viral ou seguidores).`;

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
        // Itens com termo de risco são descartados e trocados por modelos prontos seguros.
        const all = response.parsed_output.items.map(clean).filter((i) => i.hook);
        const items = all.filter((i) => isSafe(i.hook, i.cta, i.caption));
        if (items.length < all.length) {
          for (const i of all.filter((x) => !items.includes(x)))
            console.warn(`[copy] item descartado (${riskyReason(`${i.hook} ${i.cta} ${i.caption}`)}): ${i.hook}`);
        }
        if (items.length >= count) return { items: items.slice(0, count), source: "claude" };
        if (items.length > 0) {
          const extra = templateCopy(product, count - items.length, items.length);
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
    hashtags: safeHashtags(i.hashtags.map((h) => h.replace(/[^\p{L}\p{N}_]/gu, "").toLowerCase()).filter(Boolean)).slice(0, 5),
  };
}

// Modelos prontos (usados sem chave da IA). Revisados contra as regras do TikTok Shop:
// sem promessa absoluta, sem saúde/resultado, sem urgência falsa, sem grátis e sem mandar para fora do app.
const HOOKS = [
  "Ninguém me contou sobre isso antes",
  "Achadinho que vale cada centavo",
  "Para de rolar, olha isso",
  "Eu não acreditei até testar",
  "O que eu queria ter comprado antes",
  "POV: você finalmente achou o {p}",
  "3 motivos para ter um {p}",
  "Isso aqui facilitou meu dia a dia",
  "Testei o {p} que todo mundo comenta",
  "Barato e funciona? Vem ver",
  "Todo mundo tá perguntando dele",
  "Olha como o {p} funciona na prática",
  "Antes de comprar {p}, veja isso",
  "Um detalhe que pouca gente repara",
  "Comprei pelo TikTok e chegou assim",
  "Vale a pena? Minha opinião sincera",
  "Esse é o meu favorito do ano",
  "Unboxing do {p} mais pedido",
  "Se você tem esse problema, assiste",
  "Uma das minhas compras favoritas",
  "Olha o que esse {p} faz",
  "Achei que era caro, olha só",
  "Só descobri agora e tô chocada",
  "Ideia de presente que agrada",
  "Testei por uma semana, olha",
];
const CTAS = [
  "Toca no carrinho laranja",
  "Link no carrinho",
  "Garanta o seu no carrinho",
  "Confere no carrinho",
  "Clica no carrinho",
];

export function templateCopy(product: string, count: number, offset = 0): CopyItem[] {
  const p = product.trim() || "produto";
  // Se o nome do produto tiver termo de risco, os textos não citam o nome.
  const nameOk = isSafe(p);
  const tag = p.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  const hooks = HOOKS.filter((h) => nameOk || !h.includes("{p}"));
  return Array.from({ length: count }, (_, k) => {
    const i = k + offset;
    const hook = hooks[i % hooks.length].replace("{p}", p);
    return {
      hook,
      cta: CTAS[i % CTAS.length],
      caption: nameOk ? `${hook} 😍 ${p} disponível no TikTok Shop.` : `${hook} 😍 Disponível no TikTok Shop.`,
      hashtags: safeHashtags(["tiktokshop", "achadinhos", nameOk && tag ? tag : "comprinhas", "dicadecompra"]),
    };
  });
}
