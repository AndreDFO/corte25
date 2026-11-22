import { connection } from "next/server";
import { listLibrary } from "@/lib/music-library";

// Lista da playlist para o formulário (sem caminhos de arquivo).
export async function GET() {
  await connection();
  const tracks = (await listLibrary()).map(({ id, title, style, seconds, creator, license, source }) => ({ id, title, style, seconds, creator, license, source }));
  return Response.json({ tracks }, { headers: { "Cache-Control": "public, max-age=600" } });
}
