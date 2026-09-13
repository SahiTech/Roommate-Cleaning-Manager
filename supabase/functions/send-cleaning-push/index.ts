import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendNotification, type PushSubscription } from 'npm:web-push-neo@0.1.2';

const cors = { 'Content-Type': 'application/json' };

function isAllowedApiKey(value: string | null) {
  if (!value) return false;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>;
    return Object.values(keys).includes(value);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  if (!isAllowedApiKey(req.headers.get('apikey'))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return new Response(JSON.stringify({ error: 'Server configuration unavailable' }), { status: 500, headers: cors });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: config, error: configError } = await admin.from('notification_config').select('vapid_subject,vapid_public_key,vapid_private_key').eq('id', true).single();
  if (configError || !config?.vapid_private_key || !config.vapid_public_key || !config.vapid_subject) return new Response(JSON.stringify({ error: 'VAPID configuration unavailable' }), { status: 500, headers: cors });

  const { data: events, error: eventsError } = await admin.from('notification_events').select('id,member_id,type,title,body').is('sent_at', null).order('created_at', { ascending: true }).limit(100);
  if (eventsError) return new Response(JSON.stringify({ error: eventsError.message }), { status: 500, headers: cors });

  let sent = 0, skipped = 0, failed = 0;
  for (const event of events ?? []) {
    const { data: subscriptions, error: subscriptionsError } = await admin.from('notification_subscriptions').select('id,endpoint,p256dh,auth').eq('member_id', event.member_id);
    if (subscriptionsError) { failed++; continue; }
    if (!subscriptions?.length) {
      await admin.from('notification_events').update({ sent_at: new Date().toISOString() }).eq('id', event.id);
      skipped++;
      continue;
    }

    let allDelivered = true;
    for (const subscription of subscriptions) {
      const pushSubscription: PushSubscription = { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } };
      try {
        await sendNotification(pushSubscription, JSON.stringify({ title: event.title, body: event.body, url: '/', tag: `cleaning-${event.id}` }), {
          vapidDetails: { subject: config.vapid_subject, publicKey: config.vapid_public_key, privateKey: config.vapid_private_key },
          TTL: 300,
          urgency: event.type === 'reminder' ? 'normal' : 'high',
          topic: event.type,
        });
      } catch (error) {
        const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: number }).statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) await admin.from('notification_subscriptions').delete().eq('id', subscription.id);
        else allDelivered = false;
      }
    }
    if (allDelivered) { await admin.from('notification_events').update({ sent_at: new Date().toISOString() }).eq('id', event.id); sent++; }
    else failed++;
  }

  return new Response(JSON.stringify({ ok: true, sent, skipped, failed, processed: (events ?? []).length }), { status: 200, headers: cors });
});
