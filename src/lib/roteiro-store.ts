import type { BlocoKey, Plano } from "./roteiro";

// O último plano criado fica no navegador: a página Criadores mostra de novo e o gerador
// (página inicial) usa para mostrar, em cada bloco, o que gravar agora.
const KEY = "corte25_roteiro";
export const ROTEIRO_EVENT = "corte25-roteiro";

export function loadPlano(): Plano | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "null");
    return p && Array.isArray(p.ganchos) ? (p as Plano) : null;
  } catch {
    return null;
  }
}

export function savePlano(p: Plano | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(ROTEIRO_EVENT));
  } catch {}
}

// Mesmo nome dos blocos do gerador.
export const FORM_TO_PLANO: Record<"hooks" | "bodies" | "ctas", BlocoKey> = { hooks: "ganchos", bodies: "corpos", ctas: "ctas" };
