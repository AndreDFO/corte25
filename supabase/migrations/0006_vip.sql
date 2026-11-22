-- Plano VIP (22/11/2026): assinatura extra de R$ 14,99/mês que libera recursos exclusivos.
alter table public.profiles add column if not exists vip_canceled_at timestamptz;
create index if not exists payments_user_product_idx on public.payments (user_id, product);

-- Assinante mensal (sem VIP) ganha 3 vídeos por mês com recursos VIP.
create table if not exists public.vip_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id text not null,
  videos integer not null check (videos > 0),
  created_at timestamptz not null default now()
);
create index if not exists vip_usage_user_idx on public.vip_usage (user_id, created_at);
alter table public.vip_usage enable row level security;
