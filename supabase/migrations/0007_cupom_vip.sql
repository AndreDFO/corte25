-- Cupom que libera recursos VIP (22/11/2026): o admin escolhe quais recursos e por quantos dias (amount = dias).
-- O cliente resgata em Minha conta; cada resgate vira uma linha em vip_grants.
alter table public.coupons drop constraint if exists coupons_kind_check;
alter table public.coupons add constraint coupons_kind_check check (kind in ('percent', 'fixed', 'videos', 'vip'));
alter table public.coupons add column if not exists features text[];
create table if not exists public.vip_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  coupon_id uuid references public.coupons (id) on delete set null,
  features text[] not null,
  until timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists vip_grants_user on public.vip_grants (user_id, until);
alter table public.vip_grants enable row level security;
