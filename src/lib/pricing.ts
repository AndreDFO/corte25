// Preços e limites. Troque aqui para mudar o que aparece no site.
export const MAX_PER_BLOCK = 5; // até 5 ganchos, 5 corpos e 5 CTAs
export const BATCH_VIDEOS = 25; // vídeos por lote (1 crédito), sempre 25
export const FULL_PRICE = "1 crédito"; // o que aparece no botão do lote completo
export const PACKAGES = [
  { credits: 10, price: "R$ 29,90", perBatch: "R$ 2,99 por lote" },
  { credits: 40, price: "R$ 89,99", perBatch: "R$ 2,25 por lote", best: true },
];
export const FREE_VIDEOS = 2;
export const FREE_TRIALS_PER_PERSON = 1;

export function comboCount(h: number, b: number, c: number) {
  return h * b * c;
}

// Vídeos por parte do ZIP (download no celular): ZIP de 300 MB costuma falhar no download ou ao abrir.
export const ZIP_PART = 9;
