import { currentUser, updateProfile } from "@/lib/auth";

// O afiliado informa o ID da carteira (walletId) da conta Asaas dele para receber os 15% automaticamente.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const wallet = String(b.walletId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(wallet))
    return Response.json({ error: "Esse não parece um ID de carteira do Asaas (formato 0000aaaa-...)." }, { status: 400 });
  await updateProfile(user.id, { affiliate_wallet_id: wallet });
  return Response.json({ ok: true });
}
