# Product Roadmap

## Phase 1 — Core household manager (implemented)

- Passwordless account login
- Multi-household support
- Household admin/member roles
- Invite links
- Weekly rotation
- Rolling task generation
- Confirmation workflow
- Next-person notification event
- Reminder/due/overdue/missed notification engine
- Notification center
- Realtime alerts
- PWA manifest + service worker
- Browser notification subscription storage
- RLS tenant isolation

## Phase 2 — Professional household operations

- Schedule editor per weekday
- Multiple chores and rooms (bathroom, kitchen, trash, dishes, laundry)
- Duration and difficulty per chore
- Skip/leave request with admin approval
- Duty swap request
- Temporary replacement
- Vacation/absence calendar
- Household announcements
- Member notification preferences
- Streaks and fairness score
- Monthly history and reports
- CSV export
- Audit/activity log

## Phase 3 — SaaS product

- Public landing page
- Pricing plans and feature flags
- Organization/household limits by plan
- Billing integration
- Admin SaaS dashboard
- Usage analytics
- Custom branding per household
- Custom domains for business/hostel customers
- Support and moderation tools

## Phase 4 — Mobile distribution

- Installable PWA hardening
- Android package via TWA/Capacitor
- Native notification integration
- iOS PWA optimization
- Optional App Store / Play Store release

## Notification transport

The database scheduler and notification queue are already production-oriented. Browser/local notifications work while the PWA is active, and push subscription records are stored. A dedicated server-side Web Push sender can be enabled as a separate transport without changing task or notification logic.
