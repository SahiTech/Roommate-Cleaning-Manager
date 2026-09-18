-- Advanced household management foundation
CREATE TABLE IF NOT EXISTS public.duty_exceptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE, duty_date date NOT NULL,
 type text NOT NULL CHECK (type IN ('leave','skip','swap')), replacement_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
 reason text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS duty_exceptions_room_date_idx ON public.duty_exceptions(room_id,duty_date);
CREATE TABLE IF NOT EXISTS public.duty_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
 task_id uuid REFERENCES public.cleaning_tasks(id) ON DELETE SET NULL, actor_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
 event_type text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS duty_events_room_created_idx ON public.duty_events(room_id,created_at DESC);
ALTER TABLE public.cleaning_tasks ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent'));
ALTER TABLE public.cleaning_tasks ADD COLUMN IF NOT EXISTS proof_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.cleaning_tasks ADD COLUMN IF NOT EXISTS proof_url text;
ALTER TABLE public.cleaning_tasks ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE public.cleaning_tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS max_members integer NOT NULL DEFAULT 20 CHECK (max_members BETWEEN 2 AND 100);
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS quiet_hours_start time;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS quiet_hours_end time;
