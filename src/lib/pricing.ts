// Preços e limites. Troque aqui para mudar o que aparece no site.
export const MAX_PER_BLOCK = 5; // até 5 ganchos, 5 corpos e 5 CTAs
export const BATCH_VIDEOS = 25; // vídeos por lote (1 crédito), sempre 25
export const FULL_PRICE = "1 crédito"; // (antigo) o que aparecia no botão do lote completo
// Saldo em vídeos (22/11): cada lote comprado vira 25 vídeos de saldo. A pessoa escolhe quantos
// gerar por vez; gerando 25 de uma vez, ganha mais 2 grátis.
export const VIDEOS_PER_LOT = BATCH_VIDEOS;
export const VIDEO_CHOICES = [5, 10, 15, 20, 25] as const;
export const bonusFor = (n: number) => (n >= BATCH_VIDEOS ? 2 : 0);
export const PACKAGES: { credits: number; price: string; perBatch: string; best?: boolean; tag?: string }[] = [
  { credits: 3, price: "R$ 14,90", perBatch: "R$ 0,20 por vídeo", tag: "para começar" },
  { credits: 10, price: "R$ 29,90", perBatch: "R$ 0,12 por vídeo" },
  { credits: 40, price: "R$ 89,99", perBatch: "R$ 0,09 por vídeo", best: true },
];
// Assinatura mensal: 15 lotes por mês.
export const SUBSCRIPTION = { credits: 15, price: "R$ 39,90", perBatch: "R$ 0,11 por vídeo" };
// perBatch agora mostra o preço por vídeo (valor ÷ (lotes × 25)), arredondado.
// Comissão do afiliado (decidido em 22/11/2026). Entra junto com login e pagamento.
export const AFFILIATE_PERCENT = 15;
// Desconto para quem compra pela indicação de um afiliado, só na primeira compra (decidido em 22/11/2026).
// A comissão do afiliado (15%) é calculada sobre o valor já com desconto.
export const REFERRAL_DISCOUNT = 10;
// O afiliado recebe a comissão só nas 3 primeiras compras pagas de cada indicado (decidido em 22/11/2026).
export const AFFILIATE_MAX_PURCHASES = 3;
export const discounted = (value: number, percent: number) => Math.round(value * (100 - percent)) / 100;
export const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
export const FREE_VIDEOS = 2;
export const FREE_TRIALS_PER_PERSON = 1;

export function comboCount(h: number, b: number, c: number) {
  return h * b * c;
}

// Vídeos por parte do ZIP (download no celular): ZIP de 300 MB costuma falhar no download ou ao abrir.
export const ZIP_PART = 9;

// Catálogo para cobrança (valores em reais). O id vai no pagamento do Asaas (externalReference).
export const CATALOG = {
  "pacote-3": { credits: 3, value: 14.9, label: "75 vídeos (3 lotes)", recurring: false },
  "pacote-10": { credits: 10, value: 29.9, label: "250 vídeos (10 lotes)", recurring: false },
  "pacote-40": { credits: 40, value: 89.99, label: "1.000 vídeos (40 lotes)", recurring: false },
  assinatura: { credits: 15, value: 39.9, label: "Assinatura mensal · 375 vídeos", recurring: true },
} as const;
export type ProductId = keyof typeof CATALOG;
