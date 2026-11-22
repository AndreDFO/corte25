import { supabaseServer } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase-admin";

export async function POST() {
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut({ scope: "local" }); // só este aparelho (o padrão "global" deslogava o celular ao sair no PC)
  return Response.json({ ok: true });
}
