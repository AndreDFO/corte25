-- Relatos de problema (22/11/2026): o cliente conversa com a IA do botão "Relatar problema"
-- e o relato fica salvo aqui. O admin acompanha em /admin; a tarefa automática lê os "novo".
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'novo' check (status in ('novo', 'em_correcao', 'corrigido', 'descartado')),
  summary text not null,
  details text,
  page text,
  user_id uuid references public.profiles (id) on delete set null,
  email text,
  contact text,
  transcript jsonb not null default '[]'::jsonb,
  browser jsonb not null default '{}'::jsonb,
  screenshot text,
  has_screenshot boolean generated always as (screenshot is not null) stored,
  fix_note text,
  fix_pr text
);
create index if not exists bug_reports_status on public.bug_reports (status, created_at desc);
alter table public.bug_reports enable row level security;
