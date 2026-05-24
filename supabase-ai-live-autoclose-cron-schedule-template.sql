-- AITradeX AI Live Auto-Close Cron Schedule Template
-- Use only if you want to create the schedule from SQL.
-- Replace PROJECT_REF and YOUR_SECRET before running.
-- If Supabase Dashboard Scheduled Functions is available, use the dashboard instead.

-- Required extensions may already be enabled in your Supabase project.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Remove old schedule with same name if it exists.
select cron.unschedule('aitradex-ai-live-auto-close-every-minute')
where exists (
  select 1 from cron.job where jobname = 'aitradex-ai-live-auto-close-every-minute'
);

-- Run every 1 minute.
select cron.schedule(
  'aitradex-ai-live-auto-close-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/ai-live-auto-close',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-aitradex-cron-secret', 'YOUR_SECRET'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) as request_id;
  $$
);
