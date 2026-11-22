-- Saldo em vídeos (decidido pelo Andre em 22/11/2026): 1 lote = 25 vídeos de saldo.
-- A pessoa escolhe quantos vídeos gerar (5 a 25) e só desconta o que gerar.
-- credit_ledger.delta passa a contar VÍDEOS (antes contava lotes): converte o que já existe.
update public.credit_ledger set delta = delta * 25 where abs(delta) < 25 and delta <> 0;

-- Gasta p_n vídeos de forma atômica. Devolve o saldo restante, ou -1 se não havia saldo.
create or replace function public.consume_videos(p_user uuid, p_job text, p_n integer)
returns integer language plpgsql security definer set search_path = public as $$
declare bal integer;
begin
  if p_n < 1 then return -1; end if;
  perform 1 from public.profiles where id = p_user for update;
  select coalesce(sum(delta), 0) into bal from public.credit_ledger where user_id = p_user;
  if bal < p_n then return -1; end if;
  insert into public.credit_ledger (user_id, delta, reason, job_id) values (p_user, -p_n, 'lote', p_job);
  insert into public.job_owners (job_id, user_id) values (p_job, p_user) on conflict do nothing;
  return bal - p_n;
end $$;
revoke all on function public.consume_videos(uuid, text, integer) from public, anon, authenticated;
