// Legendas animadas no estilo TikTok (arquivo .ass que o FFmpeg grava no vídeo com a libass):
// - fala: 1 a 3 palavras por vez, em maiúsculas, a palavra falada fica verde-limão;
// - gancho: o texto entra palavra por palavra no início do vídeo.
import type { Word } from "./transcribe";

const W = 1080;
const H = 1920;
const LIME = "&H0035F1C8&"; // #c8f135 em BGR (formato do .ass)
const WHITE = "&H00FFFFFF&";

const t = (sec: number) => {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const escText = (s: string) => s.replace(/[{}\\]/g, "").replace(/\n/g, "\\N");

function header() {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Fala,Inter ExtraBold,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,8,4,5,60,60,0,1
Style: Gancho,Inter ExtraBold,80,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,9,0,8,60,60,0,1
Style: GanchoCaixa,Inter ExtraBold,80,&H00000000,&H00000000,&H0DFFFFFF,&H0DFFFFFF,0,0,0,0,100,100,0,0,3,26,0,8,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

// Junta palavras em grupos curtos (até 3 palavras / 16 letras), quebrando em pausa ou pontuação.
function groups(words: Word[]): Word[][] {
  const out: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const len = cur.reduce((n, x) => n + x.w.length + 1, 0) + w.w.length;
    if (cur.length && (cur.length >= 3 || len > 16 || w.s - prev.e > 0.45 || /[.!?,;:]$/.test(prev.w))) {
      out.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) out.push(cur);
  return out;
}

export interface HookOverlay {
  text: string; // já quebrado em linhas com \n
  style: number; // 0, 1 (caixa branca) ou 2, igual ao gancho normal
  until: number; // some depois de X segundos
}

// words: palavras da fala com o tempo JÁ no tempo final do vídeo.
export function buildAss(words: Word[], hook: HookOverlay | null, yFrac = 0.6): string {
  const lines: string[] = [];
  if (hook) {
    const y = [H * 0.14, H * 0.2, H * 0.3][hook.style] ?? H * 0.14;
    const style = hook.style === 1 ? "GanchoCaixa" : "Gancho";
    const tokens = hook.text.split(/(\s+)/); // mantém espaços e quebras
    const nWords = tokens.filter((x) => x.trim()).length;
    const step = Math.min(0.16, 1.2 / Math.max(1, nWords));
    for (let i = 0; i < nWords; i++) {
      const start = i * step;
      const end = i === nWords - 1 ? hook.until : (i + 1) * step;
      let k = -1;
      const txt = tokens
        .map((tok) => {
          if (!tok.trim()) return tok.includes("\n") ? "\\N" : " ";
          k++;
          const clean = escText(tok);
          // Palavras que ainda não entraram ficam invisíveis (o texto não "pula" de lugar).
          if (k > i) return `{\\alpha&HFF&}${clean}{\\alpha&H00&}`;
          if (k === i) return `{\\fscx70\\fscy70\\t(0,90,\\fscx100\\fscy100)}${clean}{\\fscx100\\fscy100}`;
          return clean;
        })
        .join("");
      lines.push(`Dialogue: 1,${t(start)},${t(end)},${style},,0,0,0,,{\\an8\\pos(${W / 2},${Math.round(y)})}${txt}`);
    }
  }
  const y = Math.round(H * yFrac);
  const gs = groups(words);
  gs.forEach((g, gi) => {
    // O grupo some quando o próximo entra (nunca dois grupos na tela ao mesmo tempo).
    const next = gs[gi + 1]?.[0].s ?? Infinity;
    const gEnd = Math.min(g[g.length - 1].e + 0.15, next);
    g.forEach((w, i) => {
      const start = w.s;
      const end = i < g.length - 1 ? g[i + 1].s : gEnd;
      if (end <= start) return;
      const pop = i === 0 ? "\\fscx80\\fscy80\\t(0,80,\\fscx100\\fscy100)" : "";
      const txt = g
        .map((x, j) => {
          const up = escText(x.w.toLocaleUpperCase("pt-BR"));
          return j === i ? `{\\c${LIME}}${up}{\\c${WHITE}}` : up;
        })
        .join(" ");
      lines.push(`Dialogue: 0,${t(start)},${t(end)},Fala,,0,0,0,,{\\an5\\pos(${W / 2},${y})${pop}}${txt}`);
    });
  });
  return header() + lines.join("\n") + "\n";
}
