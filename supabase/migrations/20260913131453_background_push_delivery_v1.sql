select cron.unschedule('roommate-cleaning-push-sender') where exists (select 1 from cron.job where jobname='roommate-cleaning-push-sender');
select cron.schedule(
  'roommate-cleaning-push-sender',
  '* * * * *',
  $$select net.http_post(
      url:='https://bclssrsnumxjdgdljfmx.supabase.co/functions/v1/send-cleaning-push',
      headers:=jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_gPEcYYBVj6gtzwjTGvROwA_vsEt1t5x'),
      body:=jsonb_build_object('source','supabase-cron','time',now()),
      timeout_milliseconds:=5000
  ) as request_id;$$
);

drop index if exists public.notification_events_member_idx;
