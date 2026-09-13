# Roommate Cleaning Manager — Architecture

## Product model

This is a multi-tenant household management SaaS. A user owns or belongs to one or more households. Every household owns its members, schedules, tasks and notification history.

## Stack

- Next.js App Router + TypeScript
- Supabase Auth for passwordless email login
- Supabase Postgres + RLS for tenant isolation
- Supabase Realtime for in-app alerts
- Supabase Cron for minute-level task/notification processing
- PWA + service worker for installable mobile/desktop experience
- Web Push subscription storage is already included; the server-side push transport is isolated so it can be enabled later without changing the data model.
- Vercel for web hosting

## Security model

- Browser receives only the Supabase publishable key.
- Secret/service keys never belong in browser code.
- `rooms`, `members`, `cleaning_schedules`, `cleaning_tasks`, notifications and push subscriptions are RLS protected.
- Household access is determined by `members.user_id` and admin role.
- Invite codes are stored hashed, expire automatically and have usage limits.
- Server-only notification configuration is not exposed through the Data API.

## Core lifecycle

1. User signs in with email magic link.
2. A first-time user can claim the existing bootstrap household; later users create a household or join by invite.
3. Admin generates a shareable invite link.
4. Joining creates a member record linked to the authenticated user.
5. Admin generates a weekly rotation.
6. The database creates a rolling 14-day task window.
7. Supabase Cron evaluates reminders, due alerts, overdue escalation and missed duties every minute.
8. Completion is performed through a security-definer RPC so only the assigned member or an admin can confirm a task.
9. Confirmation creates a `next_duty` notification for the next assignee.
10. Notifications remain in the database until delivered/read, so users do not lose alerts when offline.

## Portability

The application does not hard-code a single household into the UI. New households use the same schema and policies. The web app can later be packaged with Capacitor/TWA or another native wrapper without changing the database model.
