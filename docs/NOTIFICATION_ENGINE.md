# Notification Engine

The system separates notification creation from notification delivery.

## Event types

- `reminder` — assigned member is reminded before duty time.
- `due` — assigned member is told the duty is now due.
- `next_duty` — after completion, the next scheduled member is informed.
- `escalation` — other active members are alerted after the configured overdue window.
- `missed` — other active members are alerted after the household's local calendar day has passed.

## Reliability

Every event is persisted in `notification_events`. The UI reads the same table for its notification center. Realtime delivers new rows to connected clients, while the database scheduler continues producing events even when no client is open.

This prevents a closed browser from causing the business workflow itself to stop. Delivery is a separate concern.

## Timing

Supabase Cron runs the notification processor every minute. Task times are stored as UTC `timestamptz` values generated from each household's timezone, so households in different countries can coexist in the same database.

## Future push transport

The PWA already registers a service worker and stores browser push subscriptions. A server-side Web Push transport can consume unsent `notification_events` and mark them as delivered. This is intentionally isolated from the core task engine so changing providers later does not require a database redesign.
