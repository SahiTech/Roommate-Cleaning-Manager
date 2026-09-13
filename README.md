# Roommate Cleaning Manager

A mobile-first shared bathroom/household duty manager for roommates.

## Implemented
- Roommate management
- Room leader/member roles
- Weekly automatic duty rotation
- Daily bathroom duty view
- Cleaning confirmation with timestamp
- Cleaning task storage
- Completion history
- Responsive mobile-first dashboard
- PWA manifest foundation

## Stack
- Next.js App Router + TypeScript
- Supabase Postgres
- `@supabase/ssr`
- Responsive CSS

## Dedicated backend
This repository is intentionally connected to the dedicated Supabase project:
`https://bclssrsnumxjdgdljfmx.supabase.co`

Do not point this application at another Supabase project.

## Environment
Use `.env.example` as the template. The Supabase publishable key belongs in the deployment environment and must never be committed.

## Run
`npm install`
`npm run dev`

## Notification roadmap
The core schedule/confirmation workflow is implemented first. Push/Telegram notifications should run server-side after deployment so notification credentials stay private.