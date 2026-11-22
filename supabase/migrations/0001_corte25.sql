-- Corte25: contas, créditos, pagamentos e afiliados.
-- Toda escrita de saldo passa pelo servidor (chave de serviço). O usuário só lê o que é dele.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  whatsapp text,
  cpf_cnpj text,
  ref_code text unique,                -- código de afiliado da própria pessoa (?ref=)
  referred_by text,                    -- ref_code de quem indicou (vale para sempre)
  asaas_customer_id text,
  affiliate_wallet_id text,            -- walletId do Asaas para receber os 15%
  created_at timestamptz not null default now()
);

-- Extrato de créditos: cada linha soma ou tira lotes. O saldo é a soma.
create table if not exists public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('compra', 'assinatura', 'lote', 'bonus', 'estorno', 'ajuste')),
  payment_id text,                     -- id do pagamento no Asaas (evita crédito em dobro)
  job_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists credit_ledger_payment_once on public.credit_ledger (payment_id, reason) where payment_id is not null;
create index if not exists credit_ledger_user on public.credit_ledger (user_id);

create or replace view public.credit_balance with (security_invoker = true) as
  select user_id, coalesce(sum(delta), 0)::int as credits from public.credit_ledger group by user_id;

create table if not exists public.payments (
  id text primary key,                 -- id do pagamento no Asaas
  user_id uuid references public.profiles (id) on delete set null,
  product text not null,               -- pacote-3, pacote-10, pacote-40, assinatura
  credits integer not null,
  value numeric(10, 2) not null,
  status text not null,
  affiliate_code text,
  subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Liga cada lote (pasta no servidor) à conta que gerou.
create table if not exists public.job_owners (
  job_id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Gasta 1 crédito de forma atômica. Devolve o saldo restante, ou -1 se não havia saldo.
create or replace function public.consume_credit(p_user uuid, p_job text)
returns integer language plpgsql security definer set search_path = public as $$
declare bal integer;
begin
  perform 1 from public.profiles where id = p_user for update;
  select coalesce(sum(delta), 0) into bal from public.credit_ledger where user_id = p_user;
  if bal < 1 then return -1; end if;
  insert into public.credit_ledger (user_id, delta, reason, job_id) values (p_user, -1, 'lote', p_job);
  insert into public.job_owners (job_id, user_id) values (p_job, p_user) on conflict do nothing;
  return bal - 1;
end $$;
revoke all on function public.consume_credit(uuid, text) from public, anon, authenticated;

-- Perfil criado junto com a conta.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, ref_code)
  values (new.id, new.email, substr(replace(new.id::text, '-', ''), 1, 8))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.payments enable row level security;
alter table public.job_owners enable row level security;

drop policy if exists "ler o próprio perfil" on public.profiles;
create policy "ler o próprio perfil" on public.profiles for select using (auth.uid() = id);
drop policy if exists "ler o próprio extrato" on public.credit_ledger;
create policy "ler o próprio extrato" on public.credit_ledger for select using (auth.uid() = user_id);
drop policy if exists "ler os próprios pagamentos" on public.payments;
create policy "ler os próprios pagamentos" on public.payments for select using (auth.uid() = user_id);
drop policy if exists "ler os próprios lotes" on public.job_owners;
create policy "ler os próprios lotes" on public.job_owners for select using (auth.uid() = user_id);
