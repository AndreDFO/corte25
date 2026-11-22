-- Exclusão de cupom (22/11/2026): cupom já usado some da lista mas fica guardado para o histórico.
alter table public.coupons add column if not exists deleted_at timestamptz;
