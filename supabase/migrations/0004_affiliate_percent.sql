-- Comissão do afiliado por pagamento (22/11/2026): 15% nas 3 primeiras compras do indicado, depois 3%.
alter table public.payments add column if not exists affiliate_percent smallint;
update public.payments set affiliate_percent = 15 where affiliate_code is not null and affiliate_percent is null;
