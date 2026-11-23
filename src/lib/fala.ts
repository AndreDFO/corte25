// Falas do roteiro (área Criadores). A IA marca " / " para uma pausa curta e *palavra* para ênfase.
// Nos cartões e no texto copiado as marcas somem; no teleprompter viram pausa e destaque.
export const WPS = 2.5; // palavras por segundo, ritmo normal de fala em português

export function limpaFala(s: string) {
  return s.replace(/\s*\/\s*/g, " ").replace(/\*([^*]+)\*/g, "$1").replace(/\*/g, "").replace(/\s+/g, " ").trim();
}

export function contaPalavras(s: string) {
  return limpaFala(s).split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function segundosFala(s: string, wps = WPS) {
  return Math.max(1, Math.round(contaPalavras(s) / wps));
}

// Palavras com marcação de pausa (depois dela) e ênfase, para o teleprompter.
export type Palavra = { t: string; enfase: boolean; pausa: boolean; fimFrase: boolean };
export function quebraFala(s: string): Palavra[] {
  const out: Palavra[] = [];
  // *uma ou mais palavras* viram palavras marcadas com \u0001 (pontuação colada fica fora da marca).
  const marcado = s.replace(/\*([^*]+)\*/g, (_, g: string) => g.trim().split(/\s+/).map((w) => `\u0001${w}`).join(" ")).replace(/\*/g, "");
  for (const raw of marcado.replace(/\s*\/\s*/g, " / ").split(/\s+/).filter(Boolean)) {
    if (raw === "/") {
      if (out.length) out[out.length - 1].pausa = true;
      continue;
    }
    const enfase = raw.startsWith("\u0001");
    const t = raw.replace(/\u0001/g, "");
    if (!t) continue;
    out.push({ t, enfase, pausa: false, fimFrase: /[.!?…]$/.test(t) });
  }
  return out;
}
