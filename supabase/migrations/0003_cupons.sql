-- Cupons criados pelo administrador (22/11/2026). Só o servidor (service role) lê e grava.
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,30}$'),
  kind text not null check (kind in ('percent', 'fixed', 'videos')), -- % de desconto, R$ de desconto ou vídeos de bônus
  amount numeric(10, 2) not null check (amount > 0),
  max_uses integer check (max_uses is null or max_uses > 0), -- null = sem limite
  uses integer not null default 0,
  expires_at timestamptz, -- null = sem validade
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;

-- Cada pessoa usa cada cupom uma vez; conta quando o pagamento é confirmado.
create table if not exists public.coupon_redemptions (
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  payment_id text not null,
  created_at timestamptz not null default now(),
  primary key (coupon_id, user_id)
);
alter table public.coupon_redemptions enable row level security;

alter table public.payments add column if not exists coupon_code text;
alter table public.payments add column if not exists bonus_videos integer not null default 0;

-- Registra o uso do cupom de um pagamento confirmado (idempotente). Devolve os vídeos de bônus a creditar.
create or replace function public.redeem_coupon(p_payment text)
returns integer language plpgsql security definer set search_path = public as $$
declare pay record; c record; inserted integer;
begin
  select user_id, coupon_code, bonus_videos into pay from public.payments where id = p_payment;
  if pay.coupon_code is null then return 0; end if;
  select id into c from public.coupons where code = pay.coupon_code;
  if c.id is null then return 0; end if;
  insert into public.coupon_redemptions (coupon_id, user_id, payment_id) values (c.id, pay.user_id, p_payment)
    on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return 0; end if;
  update public.coupons set uses = uses + 1 where id = c.id;
  return coalesce(pay.bonus_videos, 0);
end $$;
revoke all on function public.redeem_coupon(text) from public, anon, authenticated;
