// Preços e limites. Troque aqui para mudar o que aparece no site.
export const MAX_PER_BLOCK = 5; // até 5 ganchos, 5 corpos e 5 CTAs
export const FREE_MAX_PER_BLOCK = 3; // teste grátis: até 3 por bloco, para os 2 vídeos saírem diferentes
export const BATCH_VIDEOS = 25; // vídeos por lote (1 crédito), sempre 25
export const FULL_PRICE = "1 crédito"; // (antigo) o que aparecia no botão do lote completo
// Saldo em vídeos (22/11): cada lote comprado vira 25 vídeos de saldo. A pessoa escolhe quantos
// gerar por vez; gerando 25 de uma vez, ganha mais 2 grátis.
export const VIDEOS_PER_LOT = BATCH_VIDEOS;
export const VIDEO_CHOICES = [1, 5, 10, 15, 20, 25] as const;
export const bonusFor = (n: number) => (n >= BATCH_VIDEOS ? 2 : 0);
// Pacotes avulsos (aprovado pelo Andre em 22/11). Para mudar preço, troque só "value" aqui.
const PACKAGE_LIST = [
  { credits: 1, value: 7.99, tag: "para testar" }, // Iniciante: 25 vídeos (+2 grátis)
  { credits: 3, value: 14.99 }, // 75 vídeos
  { credits: 10, value: 29.99 }, // 250 vídeos
  { credits: 40, value: 99.99, best: true }, // 1.000 vídeos
] as const;
const reais = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
export const PACKAGES: { credits: number; value: number; price: string; perBatch: string; best?: boolean; tag?: string }[] =
  PACKAGE_LIST.map((p) => ({
    ...p,
    price: reais(p.value),
    perBatch: `R$ ${(Math.round((p.value / (p.credits * 25)) * 100) / 100).toFixed(2).replace(".", ",")} por vídeo`,
  }));
// Assinaturas mensais (vídeos por mês = lotes × 25). Para mudar preço, troque só "value" aqui.
// 550 e 850 vídeos: pedido do Andre (22/11); preços sugeridos, confirmar com ele.
export const SUBSCRIPTIONS = [
  { id: "assinatura", credits: 15, value: 39.99 }, // 375 vídeos
  { id: "assinatura-550", credits: 22, value: 54.99 }, // 550 vídeos
  { id: "assinatura-850", credits: 34, value: 79.99 }, // 850 vídeos
  { id: "assinatura-1150", credits: 46, value: 99.99 }, // 1.150 vídeos (aprovado 22/11)
] as const;
export const perVideo = (value: number, credits: number) =>
  `R$ ${(Math.round((value / (credits * 25)) * 100) / 100).toFixed(2).replace(".", ",")} por vídeo`;
const subLabel = (s: (typeof SUBSCRIPTIONS)[number]) => ({
  credits: s.credits,
  price: `R$ ${s.value.toFixed(2).replace(".", ",")}`,
  perBatch: perVideo(s.value, s.credits),
});
// A assinatura de entrada (375 vídeos), usada nos textos curtos.
export const SUBSCRIPTION = subLabel(SUBSCRIPTIONS[0]);
export const SUBSCRIPTION_OPTIONS = SUBSCRIPTIONS.map((s) => ({ id: s.id, ...subLabel(s) }));
// perBatch agora mostra o preço por vídeo (valor ÷ (lotes × 25)), arredondado.
// Comissão do afiliado (decidido em 22/11/2026). Entra junto com login e pagamento.
export const AFFILIATE_PERCENT = 15;
// Desconto para quem compra pela indicação de um afiliado, só na primeira compra (decidido em 22/11/2026).
// A comissão do afiliado (15%) é calculada sobre o valor já com desconto.
export const REFERRAL_DISCOUNT = 10;
// O afiliado recebe a comissão só nas 3 primeiras compras pagas de cada indicado (decidido em 22/11/2026).
export const AFFILIATE_MAX_PURCHASES = 3;
// Depois das 3 primeiras compras, o afiliado continua ganhando 3% para sempre (inclusive mensalidades). Aprovado 22/11.
export const AFFILIATE_LATER_PERCENT = 3;
export const discounted = (value: number, percent: number) => Math.round(value * (100 - percent)) / 100;
export const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
export const FREE_VIDEOS = 2;
// Plano VIP (aprovado 22/11): extra mensal que libera textos, cortar silêncio, música, narração, legenda automática e transição suave.
export const VIP_PRICE = 14.99;
export const VIP_DAYS = 31; // cada mensalidade paga vale 31 dias
// Quem tem qualquer assinatura mensal (sem VIP) ganha 3 vídeos por mês com os recursos VIP (pedido do Andre, 22/11).
export const SUBSCRIBER_VIP_VIDEOS = 3;

// Recursos VIP que um cupom pode liberar um a um. "todos" = VIP completo (inclui recursos futuros).
export const VIP_FEATURE_LIST = [
  { id: "textos", label: "Textos no vídeo" },
  { id: "silencio", label: "Cortar partes sem som" },
  { id: "musica", label: "Música" },
  { id: "narracao", label: "Narração" },
  { id: "legenda", label: "Legenda automática" },
  { id: "transicao", label: "Transição suave" },
] as const;
export type VipFeature = (typeof VIP_FEATURE_LIST)[number]["id"];
export const ALL_VIP_FEATURES = VIP_FEATURE_LIST.map((f) => f.id) as VipFeature[];
export function describeVipFeatures(list: readonly string[] | null | undefined) {
  if (!list?.length || list.includes("todos")) return "VIP completo";
  return VIP_FEATURE_LIST.filter((f) => list.includes(f.id)).map((f) => f.label.toLowerCase()).join(", ");
}
export const FREE_TRIALS_PER_PERSON = 1;

// Mistura mínima (pedido do Andre, 22/11): pelo menos 2 blocos com 2 vídeos ou mais (vale no grátis e no pago),
// senão os vídeos saem quase iguais. Cada bloco continua precisando de pelo menos 1 vídeo.
export const mixOk = (h: number, b: number, c: number) => h > 0 && b > 0 && c > 0 && [h, b, c].filter((n) => n >= 2).length >= 2;
export const MIX_RULE = "Coloque pelo menos 1 vídeo em cada bloco e 2 vídeos ou mais em pelo menos 2 blocos (gancho, corpo ou CTA).";

export function comboCount(h: number, b: number, c: number) {
  return h * b * c;
}

// Vídeos por parte do ZIP (download no celular): ZIP de 300 MB costuma falhar no download ou ao abrir.
export const ZIP_PART = 9;

// Catálogo para cobrança (valores em reais). O id vai no pagamento do Asaas (externalReference).
export const CATALOG = {
  "pacote-1": { credits: 1, value: PACKAGE_LIST[0].value, label: "25 vídeos (Iniciante)", recurring: false },
  "pacote-3": { credits: 3, value: PACKAGE_LIST[1].value, label: "75 vídeos (3 lotes)", recurring: false },
  "pacote-10": { credits: 10, value: PACKAGE_LIST[2].value, label: "250 vídeos (10 lotes)", recurring: false },
  "pacote-40": { credits: 40, value: PACKAGE_LIST[3].value, label: "1.000 vídeos (40 lotes)", recurring: false },
  assinatura: { credits: 15, value: SUBSCRIPTIONS[0].value, label: "Assinatura mensal · 375 vídeos", recurring: true },
  "assinatura-550": { credits: 22, value: SUBSCRIPTIONS[1].value, label: "Assinatura mensal · 550 vídeos", recurring: true },
  "assinatura-850": { credits: 34, value: SUBSCRIPTIONS[2].value, label: "Assinatura mensal · 850 vídeos", recurring: true },
  "assinatura-1150": { credits: 46, value: SUBSCRIPTIONS[3].value, label: "Assinatura mensal · 1.150 vídeos", recurring: true },
  vip: { credits: 1, value: 14.99, label: "VIP mensal · 25 vídeos + 2 grátis", recurring: true }, // VIP inclui 25 vídeos (+2 grátis ao gerar 25) por mês (22/11)
  // Assinatura mensal + VIP numa cobrança só (pedido do Andre, 22/11). Valor = plano + VIP; vídeos = plano + os 25 do VIP.
  "assinatura-vip": { credits: 16, value: 54.98, label: "Assinatura mensal · 375 + 25 vídeos + VIP", recurring: true },
  "assinatura-550-vip": { credits: 23, value: 69.98, label: "Assinatura mensal · 550 + 25 vídeos + VIP", recurring: true },
  "assinatura-850-vip": { credits: 35, value: 94.98, label: "Assinatura mensal · 850 + 25 vídeos + VIP", recurring: true },
  "assinatura-1150-vip": { credits: 47, value: 114.98, label: "Assinatura mensal · 1.150 + 25 vídeos + VIP", recurring: true },
} as const;
// Produtos que dão VIP: o VIP avulso e as assinaturas "+ VIP".
export const VIP_PRODUCTS = ["vip", ...SUBSCRIPTIONS.map((s) => `${s.id}-vip`)] as string[];
export const includesVip = (product: string) => VIP_PRODUCTS.includes(product);
export type ProductId = keyof typeof CATALOG;
