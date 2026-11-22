// Busca de música na hora (pedido do Andre, 22/11): em vez de uma playlist pronta, o cliente VIP
// pesquisa músicas num acervo externo e escolhe uma. Fonte: API pública do Openverse
// (WordPress), só licenças que liberam uso comercial SEM exigir crédito: CC0 e Public Domain
// Mark. Na prática vêm beats de produtores do Freesound, de 30 s a 2 min.
// Na hora de gerar o lote o servidor confere de novo a licença direto no Openverse e baixa o
// arquivo (o cliente não consegue trocar o endereço da música).
// Opcional: OPENVERSE_CLIENT_ID e OPENVERSE_CLIENT_SECRET no Railway aumentam o limite de buscas
// (cadastro grátis em https://api.openverse.org/v1/#tag/auth). Sem elas funciona com o limite anônimo.

export interface OnlineTrack {
  id: string; // "ov_<uuid do openverse>"
  title: string;
  seconds: number;
  creator?: string;
  preview: string; // endereço do áudio para ouvir no navegador
}

const API = "https://api.openverse.org/v1";
const MIN_S = 28;
const MAX_S = 240;
const MAX_BYTES = 15 * 1024 * 1024;

// Sugestões de busca mostradas como botões no formulário.
export const SUGGESTIONS = ["trap beat", "hip hop beat", "deep house", "funk groove", "lofi beat", "reggaeton", "tropical house", "dance pop", "cinematic", "edm"];

// Palavras que indicam efeito sonoro, pedaço solto de bateria ou música infantil: fica de fora.
const BLOCK =
  /\b(kids?|child|children|nursery|lullaby|cartoon|toy|baby|christmas|xmas|8[- ]?bit|chiptune|ukulele|whistl\w*|circus|sfx|fx|foley|riser|siren|kick|snare|hi-?hat|clap|one[- ]?shot|drums?|percussion|rumble|blade|pronunciation|fire|crackl\w*|fan|rain|wind|ambien\w*|noise|field recording|sound effect|notification|alarm|test|tone|horror|scary|creepy|preview)\b/i;

interface OvAudio {
  id: string;
  title?: string;
  url?: string;
  creator?: string;
  license?: string;
  duration?: number | null; // ms
  filetype?: string | null;
  filesize?: number | null;
  tags?: { name?: string }[] | null;
}

let token: { value: string; until: number } | null = null;
async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "User-Agent": "Corte25/1.0 (busca de musicas)" };
  const id = process.env.OPENVERSE_CLIENT_ID;
  const secret = process.env.OPENVERSE_CLIENT_SECRET;
  if (!id || !secret) return h;
  if (!token || token.until < Date.now()) {
    try {
      const res = await fetch(`${API}/auth_tokens/token/`, {
        method: "POST",
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
        signal: AbortSignal.timeout(10_000),
      });
      const j = (await res.json()) as { access_token?: string; expires_in?: number };
      if (j.access_token) token = { value: j.access_token, until: Date.now() + ((j.expires_in ?? 3600) - 60) * 1000 };
    } catch {
      token = null;
    }
  }
  if (token) h.Authorization = `Bearer ${token.value}`;
  return h;
}

const licOk = (a: OvAudio) => ["cc0", "pdm"].includes((a.license || "").toLowerCase());

function good(a: OvAudio) {
  const s = (a.duration ?? 0) / 1000;
  const type = (a.filetype || a.url?.split(".").pop() || "").toLowerCase();
  return (
    /^[a-f0-9-]{36}$/.test(a.id) &&
    licOk(a) &&
    !!a.url?.startsWith("https://") &&
    s >= MIN_S &&
    s <= MAX_S &&
    ["mp3", "ogg", "wav", "flac", "m4a"].includes(type) &&
    (!a.filesize || a.filesize <= MAX_BYTES) &&
    !BLOCK.test(a.title || "") &&
    !(a.tags || []).some((t) => BLOCK.test(t.name || ""))
  );
}

// Guarda as buscas por 1 h para poupar o limite do Openverse.
const cache = new Map<string, { at: number; tracks: OnlineTrack[] }>();

export async function searchOnline(raw: string): Promise<OnlineTrack[]> {
  const q = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
  if (q.length < 2) return [];
  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < 3600_000) return hit.tracks;
  const u = new URL(`${API}/audio/`);
  u.searchParams.set("q", q);
  u.searchParams.set("license", "cc0,pdm");
  u.searchParams.set("length", "short"); // 30 s a 2 min
  u.searchParams.set("page_size", "50");
  const res = await fetch(u, { headers: await authHeaders(), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const j = (await res.json()) as { results?: OvAudio[] };
  const tracks = (j.results ?? [])
    .filter(good)
    .slice(0, 20)
    .map((a) => ({
      id: `ov_${a.id}`,
      title: (a.title || "Sem nome").replace(/\.(wav|mp3|ogg|flac|aiff?)$/i, "").slice(0, 60),
      seconds: Math.round((a.duration ?? 0) / 1000),
      creator: a.creator?.slice(0, 40),
      preview: a.url!,
    }));
  if (cache.size > 300) cache.clear();
  cache.set(q, { at: Date.now(), tracks });
  return tracks;
}

export const isOnlineId = (id: string) => /^ov_[a-f0-9-]{36}$/.test(id);

// Baixa a música escolhida, conferindo a licença direto no Openverse. null = não pode usar.
export async function downloadOnline(id: string): Promise<Buffer | null> {
  if (!isOnlineId(id)) return null;
  const res = await fetch(`${API}/audio/${id.slice(3)}/`, { headers: await authHeaders(), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const a = (await res.json()) as OvAudio;
  if (!licOk(a) || !a.url?.startsWith("https://")) return null;
  const file = await fetch(a.url, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
  if (!file.ok) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  return buf.length > 20_000 && buf.length <= MAX_BYTES ? buf : null;
}
