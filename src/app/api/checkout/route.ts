import { asaasConfigured, createCheckout, createCustomer } from "@/lib/asaas";
import { currentUser, getProfile, updateProfile } from "@/lib/auth";
import { CATALOG, type ProductId } from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { affiliateStillEarns, referralDiscount } from "@/lib/credits";

function validCpfCnpj(v: string) {
  const d = v.replace(/\D/g, "");
  return d.length === 11 || d.length === 14;
}

// Cria a cobrança no Asaas e devolve o link da página de pagamento.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Entre na sua conta para comprar." }, { status: 401 });
  if (!asaasConfigured()) return Response.json({ error: "O pagamento ainda está sendo configurado." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const product = String(b.product || "") as ProductId;
  if (!(product in CATALOG)) return Response.json({ error: "Produto inválido." }, { status: 400 });

  const profile = await getProfile(user.id);
  if (!profile) return Response.json({ error: "Conta não encontrada." }, { status: 404 });
  let customer = profile.asaas_customer_id;
  if (!customer) {
    const name = String(b.name || profile.name || "").trim();
    const cpfCnpj = String(b.cpfCnpj || profile.cpf_cnpj || "").replace(/\D/g, "");
    if (!name || !validCpfCnpj(cpfCnpj))
      return Response.json({ error: "Informe nome e CPF ou CNPJ para emitir a cobrança.", code: "need_doc" }, { status: 400 });
    const c = await createCustomer({
      name,
      email: user.email || profile.email || "",
      cpfCnpj,
      mobilePhone: profile.whatsapp?.slice(2) || undefined,
    });
    customer = c.id;
    await updateProfile(user.id, { asaas_customer_id: customer, name, cpf_cnpj: cpfCnpj });
  }

  // Afiliado: quem indicou e já cadastrou a carteira do Asaas recebe 15% via split,
  // só nas 3 primeiras compras pagas do indicado.
  let wallet: string | null = null;
  const earns = Boolean(profile.referred_by) && (await affiliateStillEarns(user.id));
  if (earns) {
    const { data } = await supabaseAdmin()
      .from("profiles")
      .select("affiliate_wallet_id")
      .eq("ref_code", profile.referred_by)
      .maybeSingle();
    wallet = data?.affiliate_wallet_id || null;
  }

  const discountPercent = await referralDiscount(user.id, profile.referred_by);
  try {
    let out;
    try {
      out = await createCheckout({ customer, userId: user.id, product, affiliateWallet: wallet, discountPercent });
    } catch (err) {
      if (!wallet) throw err;
      // Carteira do afiliado recusada (ID errado ou a própria conta): a venda não pode travar.
      // Cobra sem o split; a indicação fica registrada em payments.affiliate_code para pagar à mão.
      console.warn("[checkout] split recusado, cobrando sem ele:", (err as Error).message);
      wallet = null;
      out = await createCheckout({ customer, userId: user.id, product, affiliateWallet: null, discountPercent });
    }
    await supabaseAdmin().from("payments").upsert({
      id: out.id,
      user_id: user.id,
      product,
      credits: CATALOG[product].credits,
      value: out.value,
      status: "PENDING",
      affiliate_code: earns ? profile.referred_by : null,
      subscription_id: out.subscription || null,
    });
    return Response.json({ url: out.url });
  } catch (err) {
    console.error("[checkout]", err);
    return Response.json({ error: "Não deu para gerar a cobrança agora. Tente de novo em instantes." }, { status: 502 });
  }
}
