import fs from "node:fs/promises";
import path from "node:path";
import { trackPath } from "@/lib/music-library";

const TYPES: Record<string, string> = { ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".flac": "audio/flac", ".m4a": "audio/mp4" };

// Arquivo da música, para a prévia no formulário.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = await trackPath(id);
  if (!p) return new Response("não encontrada", { status: 404 });
  const buf = await fs.readFile(p);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream", "Cache-Control": "public, max-age=86400" },
  });
}
