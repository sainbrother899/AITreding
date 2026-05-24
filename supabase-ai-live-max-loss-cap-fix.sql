-- AITradeX AI Live Max Loss Cap + total_pnl ambiguity fix
-- Run this in Supabase SQL Editor. Safe to run multiple times.
-- Ensures AI live close settlement caps loss at locked AI amount/margin.

create or replace function public.aitradex_close_ai_live_batch(
  p_batch_id text,
  p_reason text default 'ADMIN_BATCH_CLOSE',
  p_exit_price numeric default 0,
  p_exit_price_display text default '',
  p_exit_price_source text default 'Admin close',
  p_admin_user_id text default 'control_root',
  p_admin_email text default '',
  p_admin_name text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pos public.trade_orders%rowtype;
  batch public.ai_trade_batches%rowtype;
  v_exit_price numeric := coalesce(nullif(p_exit_price,0),0);
  entry_price numeric;
  margin numeric;
  leverage_value numeric;
  exposure numeric;
  raw_pnl numeric;
  final_pnl numeric;
  target_pnl numeric;
  target_type_clean text;
  direction numeric;
  settlement numeric;
  closed_count integer := 0;
  total_positions integer := 0;
  v_total_pnl numeric := 0;
  total_settlement numeric := 0;
  ledger_id text;
  notif_id text;
  log_id text;
  queue_id text;
  effective_reason text := coalesce(nullif(trim(p_reason), ''), 'ADMIN_BATCH_CLOSE');
  display_price text;
begin
  if not public.aitradex_validate_admin(p_admin_user_id) then
    raise exception 'Admin permission required for AI live close.';
  end if;

  select * into batch from public.ai_trade_batches where id = p_batch_id for update;

  select count(*) into total_positions
  from public.trade_orders
  where batch_id = p_batch_id
    and upper(coalesce(trade_type,'')) = 'AI_LIVE'
    and upper(coalesce(status,'OPEN')) = 'OPEN';

  if total_positions = 0 then
    return jsonb_build_object('ok', true, 'batchId', p_batch_id, 'closed', 0, 'message', 'No open AI live positions found.');
  end if;

  for pos in
    select * from public.trade_orders
    where batch_id = p_batch_id
      and upper(coalesce(trade_type,'')) = 'AI_LIVE'
      and upper(coalesce(status,'OPEN')) = 'OPEN'
    for update
  loop
    entry_price := coalesce(nullif(pos.entry_price,0), nullif(batch.entry_price,0), v_exit_price, 0);
    if v_exit_price <= 0 then
      v_exit_price := coalesce(nullif(pos.exit_price,0), entry_price, 0);
    end if;
    display_price := coalesce(nullif(p_exit_price_display,''), v_exit_price::text);

    margin := greatest(coalesce(pos.margin_amount,0),0);
    leverage_value := greatest(coalesce(pos.leverage,1),1);
    exposure := greatest(margin * leverage_value, coalesce(pos.position_size,0), 0);
    direction := case when upper(coalesce(pos.side,'BUY')) = 'SELL' then -1 else 1 end;

    if entry_price > 0 and v_exit_price > 0 and exposure > 0 then
      raw_pnl := exposure * ((v_exit_price - entry_price) / entry_price) * direction;
    else
      raw_pnl := 0;
    end if;

    target_pnl := greatest(coalesce(pos.target_percent,0),0) * exposure / 100;
    target_type_clean := upper(coalesce(pos.target_type,'PROFIT'));
    final_pnl := raw_pnl;

    if target_pnl > 0 then
      if target_type_clean = 'LOSS' then
        final_pnl := greatest(final_pnl, -least(coalesce(nullif(margin,0), target_pnl), target_pnl));
      else
        final_pnl := least(final_pnl, target_pnl);
      end if;
    end if;

    if final_pnl < 0 then
      final_pnl := greatest(final_pnl, -margin);
    end if;

    final_pnl := round(final_pnl::numeric, 2);
    if coalesce(pos.margin_locked,false) then
      settlement := greatest(0, margin + final_pnl);
    else
      settlement := final_pnl;
    end if;
    settlement := round(settlement::numeric, 2);

    ledger_id := 'ledger_ai_live_settle_' || pos.id;
    insert into public.wallet_ledger(id, user_id, account_type, type, amount, reference_id, note, balance_after, created_at, raw)
    values (
      ledger_id,
      pos.user_id,
      'REAL',
      'AI_LIVE_SETTLEMENT',
      settlement,
      pos.id,
      coalesce(pos.pair,'AI') || ' AI live ' || coalesce(pos.side,'') || ' closed by backend · AI amount ' || margin::text || ' · P/L ' || final_pnl::text,
      null,
      now(),
      jsonb_build_object('secureAiLiveClose', true, 'batchId', p_batch_id, 'reason', effective_reason, 'exitPrice', v_exit_price, 'pnl', final_pnl, 'settlement', settlement, 'adminUserId', p_admin_user_id)
    )
    on conflict (user_id, account_type, type, reference_id) do nothing;

    update public.trade_orders
    set status = 'CLOSED',
        trade_type = 'AI_LIVE',
        exit_price = v_exit_price,
        exit_price_display = display_price,
        pnl = final_pnl,
        settlement_amount = settlement,
        close_reason = effective_reason,
        closed_by = p_admin_user_id,
        source = 'ADMIN_AI_LIVE_CLOSE_BACKEND',
        closed_at = now(),
        raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object(
          'secureAiLiveClose', true,
          'closedBy', p_admin_user_id,
          'closedByEmail', p_admin_email,
          'closedByName', p_admin_name,
          'closedAt', now(),
          'exitPrice', v_exit_price,
          'exitPriceDisplay', display_price,
          'exitPriceSource', p_exit_price_source,
          'rawPnl', round(raw_pnl::numeric,2),
          'pnl', final_pnl,
          'settlementAmount', settlement,
          'safeFormula', 'margin * leverage * priceMovePercent, capped by target and max loss = margin',
          'maxLossCap', margin
        )
    where id = pos.id;

    notif_id := 'notif_ai_live_close_' || pos.id;
    insert into public.notifications(id, audience, user_id, title, message, type, link_page, reference_id, read, created_at, raw)
    values (
      notif_id,
      'USER',
      pos.user_id,
      'AI live position closed',
      coalesce(pos.pair,'AI') || ' ' || coalesce(pos.side,'') || ' closed. P/L ' || final_pnl::text || '. Settlement ' || settlement::text || '.',
      'AI',
      'orders',
      'ai_close_' || pos.id,
      false,
      now(),
      jsonb_build_object('secureAiLiveClose', true, 'batchId', p_batch_id, 'pnl', final_pnl, 'settlement', settlement)
    )
    on conflict (id) do update set
      audience=excluded.audience, user_id=excluded.user_id, title=excluded.title, message=excluded.message, type=excluded.type, link_page=excluded.link_page, reference_id=excluded.reference_id, raw=excluded.raw, created_at=excluded.created_at;

    closed_count := closed_count + 1;
    v_total_pnl := v_total_pnl + final_pnl;
    total_settlement := total_settlement + settlement;
  end loop;

  update public.ai_trade_batches
  set status = 'CLOSED',
      total_pnl = round(v_total_pnl::numeric,2),
      closed_at = now(),
      raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object(
        'secureAiLiveClose', true,
        'closedBy', p_admin_user_id,
        'closedByEmail', p_admin_email,
        'closedAt', now(),
        'closeReason', effective_reason,
        'exitPrice', v_exit_price,
        'exitPriceDisplay', display_price,
        'exitPriceSource', p_exit_price_source,
        'closedCount', closed_count,
        'totalSettlement', round(total_settlement::numeric,2)
      )
  where id = p_batch_id;

  log_id := 'adminlog_ai_live_close_' || p_batch_id || '_' || replace(effective_reason,' ','_');
  insert into public.admin_action_logs(id, admin_user_id, action, target_type, target_id, meta, created_at)
  values (log_id, p_admin_user_id, 'AI_LIVE_CLOSE_SECURE', 'AI_BATCH', p_batch_id, jsonb_build_object('closed', closed_count, 'totalPositions', total_positions, 'reason', effective_reason, 'exitPrice', v_exit_price, 'totalPnl', round(v_total_pnl::numeric,2), 'totalSettlement', round(total_settlement::numeric,2), 'adminEmail', p_admin_email, 'adminName', p_admin_name), now())
  on conflict (id) do update set meta=excluded.meta, created_at=excluded.created_at;

  queue_id := 'backend_ai_live_close_' || p_batch_id || '_' || replace(effective_reason,' ','_');
  insert into public.backend_action_queue(id, action_type, status, requested_by, target_user_id, payload, result, created_at, processed_at)
  values (queue_id, 'AI_LIVE_CLOSE', 'COMPLETED', p_admin_user_id, null, jsonb_build_object('batchId', p_batch_id, 'reason', effective_reason, 'exitPrice', v_exit_price), jsonb_build_object('closed', closed_count, 'totalPnl', round(v_total_pnl::numeric,2), 'totalSettlement', round(total_settlement::numeric,2)), now(), now())
  on conflict (id) do update set status='COMPLETED', result=excluded.result, processed_at=now();

  return jsonb_build_object('ok', true, 'batchId', p_batch_id, 'closed', closed_count, 'totalPositions', total_positions, 'exitPrice', v_exit_price, 'totalPnl', round(v_total_pnl::numeric,2), 'totalSettlement', round(total_settlement::numeric,2), 'status', 'CLOSED');
end;
$$;



grant execute on function public.aitradex_close_ai_live_batch(text,text,numeric,text,text,text,text,text) to anon, authenticated;
