-- Cupom de resgate sem compra (22/11/2026): o cliente digita em Minha conta ("Tenho um cupom").
-- Tipo novo "gratis" = vídeos grátis direto no saldo. O tipo "vip" (recursos VIP por X dias) também é resgatado aqui.
-- Os tipos "percent", "fixed" e "videos" (bônus) continuam valendo só na compra.
alter table public.coupons drop constraint if exists coupons_kind_check;
alter table public.coupons add constraint coupons_kind_check check (kind in ('percent', 'fixed', 'videos', 'vip', 'gratis'));

alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('compra', 'assinatura', 'lote', 'bonus', 'estorno', 'ajuste', 'cupom'));

-- Resgata um cupom de uma vez só (trava a linha do cupom: dois resgates ao mesmo tempo não passam do limite).
-- Devolve {ok, error?, kind, amount, features, until}.
create or replace function public.claim_coupon(p_user uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record; inserted integer; feats text[]; v_until timestamptz;
begin
  select * into c from public.coupons where code = p_code for update;
  if c.id is null or not c.active or c.deleted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'nao_encontrado');
  end if;
  if c.kind not in ('gratis', 'vip') then return jsonb_build_object('ok', false, 'error', 'compra'); end if;
  if c.expires_at is not null and c.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'vencido'); end if;
  if c.max_uses is not null and c.uses >= c.max_uses then return jsonb_build_object('ok', false, 'error', 'esgotado'); end if;
  insert into public.coupon_redemptions (coupon_id, user_id, payment_id) values (c.id, p_user, 'resgate-' || c.kind)
    on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return jsonb_build_object('ok', false, 'error', 'ja_usou'); end if;
  update public.coupons set uses = uses + 1 where id = c.id;
  if c.kind = 'gratis' then
    insert into public.credit_ledger (user_id, delta, reason) values (p_user, floor(c.amount)::integer, 'cupom');
    return jsonb_build_object('ok', true, 'kind', c.kind, 'amount', floor(c.amount)::integer);
  end if;
  feats := coalesce(nullif(c.features, '{}'), array['todos']);
  v_until := now() + make_interval(days => round(c.amount)::integer);
  insert into public.vip_grants (user_id, coupon_id, features, until) values (p_user, c.id, feats, v_until);
  return jsonb_build_object('ok', true, 'kind', c.kind, 'amount', round(c.amount)::integer, 'features', feats, 'until', v_until);
end $$;
revoke all on function public.claim_coupon(uuid, text) from public, anon, authenticated;
