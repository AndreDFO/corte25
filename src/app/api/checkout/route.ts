import { asaasConfigured, createCheckout, createCustomer } from "@/lib/asaas";
import { currentUser, getProfile, updateProfile } from "@/lib/auth";
import { CATALOG, includesVip, type ProductId } from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { affiliatePercentFor, referralDiscount } from "@/lib/credits";
import { checkCoupon } from "@/lib/coupons";
import { discounted } from "@/lib/pricing";
import { vipStatus } from "@/lib/vip";

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

  if (includesVip(product)) {
    const st = await vipStatus(user);
    if (st.admin) return Response.json({ error: "Sua conta de administrador já é VIP." }, { status: 400 });
    if (st.active && !st.canceled && !st.coupon) return Response.json({ error: "Você já é VIP." }, { status: 400 });
  }
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
  // 15% nas 3 primeiras compras pagas do indicado; depois 3% para sempre.
  const affiliatePercent = profile.referred_by ? await affiliatePercentFor(user.id) : null;
  if (affiliatePercent) {
    const { data } = await supabaseAdmin()
      .from("profiles")
      .select("affiliate_wallet_id")
      .eq("ref_code", profile.referred_by)
      .maybeSingle();
    wallet = data?.affiliate_wallet_id || null;
  }

  // Preço: desconto da indicação (1ª compra) ou cupom, o que for menor (não somam).
  // Cupom de vídeos de bônus soma com o desconto da indicação.
  const full = CATALOG[product].value;
  const refPercent = await referralDiscount(user.id, profile.referred_by);
  let value = refPercent ? discounted(full, refPercent) : full;
  let note = refPercent ? `${refPercent}% de desconto pela indicação` : "";
  let couponCode: string | null = null;
  let bonusVideos = 0;
  if (b.coupon) {
    const c = await checkCoupon(String(b.coupon), user.id, product);
    if (!c.ok) return Response.json({ error: c.error, code: "coupon" }, { status: 400 });
    bonusVideos = c.bonusVideos;
    // Só conta como usado se o cupom mudou algo (preço menor ou vídeos de bônus).
    if (c.value < value) {
      value = c.value;
      note = `cupom ${c.coupon.code}`;
      couponCode = c.coupon.code;
    } else if (c.bonusVideos) {
      note = [note, `cupom ${c.coupon.code}`].filter(Boolean).join(" · ");
      couponCode = c.coupon.code;
    }
  }
  const discountArgs = { value: value !== full ? value : undefined, note: note || undefined };
  try {
    let out;
    try {
      out = await createCheckout({ customer, userId: user.id, product, affiliateWallet: wallet, affiliatePercent: affiliatePercent ?? undefined, ...discountArgs });
    } catch (err) {
      if (!wallet) throw err;
      // Carteira do afiliado recusada (ID errado ou a própria conta): a venda não pode travar.
      // Cobra sem o split; a indicação fica registrada em payments.affiliate_code para pagar à mão.
      console.warn("[checkout] split recusado, cobrando sem ele:", (err as Error).message);
      wallet = null;
      out = await createCheckout({ customer, userId: user.id, product, affiliateWallet: null, ...discountArgs });
    }
    await supabaseAdmin().from("payments").upsert({
      id: out.id,
      user_id: user.id,
      product,
      credits: CATALOG[product].credits,
      value: out.value,
      status: "PENDING",
      affiliate_code: affiliatePercent ? profile.referred_by : null,
      affiliate_percent: affiliatePercent,
      subscription_id: out.subscription || null,
      coupon_code: couponCode,
      bonus_videos: bonusVideos,
    });
    return Response.json({ url: out.url });
  } catch (err) {
    console.error("[checkout]", err);
    return Response.json({ error: "Não deu para gerar a cobrança agora. Tente de novo em instantes." }, { status: 502 });
  }
}
