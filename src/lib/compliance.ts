// Filtro de palavras de risco para textos que vão no vídeo e na legenda (regras de conteúdo do
// TikTok e do TikTok Shop). Tudo que a IA ou os modelos prontos escrevem passa por aqui.
// Se algum texto tiver um termo de risco, o item inteiro é trocado por um modelo seguro.

// Normaliza para comparar sem acento e sem maiúsculas.
export function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Cada linha: [motivo, expressão regular aplicada no texto normalizado].
export const RISKY: [string, RegExp][] = [
  // Promessas absolutas e superlativos (TikTok Shop proíbe alegações exageradas)
  ["promessa absoluta", /\b(garantid[oa]s?|garantia de resultado|100 ?%|cem por cento|infalivel|definitiv[oa]|milagr\w*|magic[oa]|perfeit[oa] pra todo|nunca mais|para sempre|sem (nenhum )?risco)\b/],
  ["superlativo", /\b(o|a) melhor\b|\bmelhor (do|da) (mundo|brasil|mercado)\b|\bmelhor compra\b|\bn(umero|o\.?|º) ?1\b|\bunic[oa] que funciona\b/],
  // Saúde, corpo e resultado (proibido ou restrito)
  ["saúde/resultado", /\b(cura\w*|curar|trata(mento)? de|emagrec\w*|perde(r)? peso|queima(r)? gordura|secar a barriga|rejuvenesc\w*|elimina rugas|cresce(r)? cabelo|antes e depois|resultado(s)? em \d+|tratamento|remedio|doenca\w*|ansiedade|depressao|diabetes|pressao alta|celulite|estrias|acne)\b/],
  // Urgência e escassez falsas
  ["urgência falsa", /\b(acabando|ultimas unidades|ultima chance|so hoje|somente hoje|corre que|estoque limitado|vai esgotar|esgota(ndo)?|antes que acabe|promocao relampago)\b/],
  // Chamar para fora do app ou outra loja
  ["tirar do app", /\b(whats\w*|zap|link na bio|instagram|insta\b|telegram|shopee|mercado ?livre|amazon|aliexpress|shein|chama no (direct|privado|dm)|me chama|site oficial|www\.|https?:)/],
  // Grátis / brinde / sorteio (exige regra própria no TikTok Shop)
  ["grátis/sorteio", /\b(gratis|de graca|brinde|sorteio|sorteando|giveaway|frete gratis|cupom)\b/],
  // Dinheiro fácil e engajamento forçado
  ["engajamento/dinheiro", /\b(ganhe dinheiro|renda extra|fique rico|segue pra|siga para|curte e compartilha|comenta (eu quero|aqui)|marca (um|uma) amig)\b/],
  // Palavras sensíveis em geral
  ["termo sensível", /\b(arma\w*|droga\w*|bebida alcoolica|cigarro|vape|aposta\w*|bet\b|cassino|morte|matar|suicid\w*|sangue|nude\w*|sexy|sensual|golpe|piranha)\b/],
];

export function riskyReason(text: string): string | null {
  const t = norm(text);
  for (const [why, re] of RISKY) if (re.test(t)) return why;
  return null;
}

export function isSafe(...texts: string[]) {
  return texts.every((t) => !riskyReason(t));
}

// Hashtags: só letras e números, sem termos de risco e sem as que pedem engajamento.
const BAD_TAGS = /^(fyp|foryou|foryoupage|paravoce|viral(izar)?|seguidores|sigodevolta|sdv|like4like|f4f)$/;
export function safeHashtags(tags: string[]) {
  return tags.filter((h) => !BAD_TAGS.test(norm(h)) && !riskyReason(h));
}
