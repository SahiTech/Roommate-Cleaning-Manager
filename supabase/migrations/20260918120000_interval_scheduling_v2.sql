-- Interval scheduling: one duty per member every N days, with an explicit start date/time.
-- Existing weekly schedules keep working because interval_days defaults to 7 and starts_on can be null.
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS schedule_interval_days integer NOT NULL DEFAULT 7
  CHECK (schedule_interval_days BETWEEN 1 AND 31);

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS schedule_start_date date;

ALTER TABLE public.cleaning_schedules
  ADD COLUMN IF NOT EXISTS interval_days integer NOT NULL DEFAULT 7
  CHECK (interval_days BETWEEN 1 AND 31);

ALTER TABLE public.cleaning_schedules
  ADD COLUMN IF NOT EXISTS starts_on date;

ALTER TABLE public.cleaning_schedules
  ADD COLUMN IF NOT EXISTS next_assignment_mode text NOT NULL DEFAULT 'after_completion'
  CHECK (next_assignment_mode IN ('after_completion','fixed_schedule'));

ALTER TABLE public.cleaning_schedules
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.cleaning_schedules
  ADD COLUMN IF NOT EXISTS escalation_enabled boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS cleaning_tasks_room_due_idx
  ON public.cleaning_tasks(room_id, due_at);

CREATE INDEX IF NOT EXISTS cleaning_tasks_member_date_idx
  ON public.cleaning_tasks(member_id, duty_date);

CREATE OR REPLACE FUNCTION public.ensure_room_tasks(
  p_room_id uuid,
  p_days integer DEFAULT 45
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  s record;
  d date;
  v_due timestamptz;
  v_count integer := 0;
  v_start date;
  v_end date;
  v_step integer;
BEGIN
  IF NOT public.is_room_member(p_room_id) THEN
    RAISE EXCEPTION 'Room access denied';
  END IF;

  SELECT * INTO r FROM public.rooms WHERE id = p_room_id;

  FOR s IN
    SELECT *
    FROM public.cleaning_schedules
    WHERE room_id = p_room_id
      AND active = true
  LOOP
    v_start := COALESCE(
      s.starts_on,
      (now() AT TIME ZONE r.timezone)::date
    );

    v_end := (now() AT TIME ZONE r.timezone)::date
      + greatest(p_days, 1) - 1;

    v_step := greatest(COALESCE(s.interval_days, 7), 1);

    d := v_start;

    WHILE d <= v_end LOOP
      v_due := ((d + s.duty_time) AT TIME ZONE r.timezone);

      INSERT INTO public.cleaning_tasks(
        room_id,
        schedule_id,
        member_id,
        duty_date,
        due_at,
        status
      )
      VALUES(
        p_room_id,
        s.id,
        s.member_id,
        d,
        v_due,
        'pending'
      )
      ON CONFLICT DO NOTHING;

      IF FOUND THEN
        v_count := v_count + 1;
      END IF;

      d := d + v_step;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_cleaning_task(
  p_task_id uuid,
  p_note text DEFAULT NULL
)
RETURNS cleaning_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.cleaning_tasks%rowtype;
  n public.cleaning_tasks%rowtype;
  r public.rooms%rowtype;
BEGIN
  SELECT * INTO t
  FROM public.cleaning_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF NOT public.is_room_member(t.room_id) THEN
    RAISE EXCEPTION 'Room access denied';
  END IF;

  IF NOT EXISTS(
    SELECT 1
    FROM public.members
    WHERE id = t.member_id
      AND user_id = auth.uid()
      AND active = true
  ) AND NOT public.is_room_admin(t.room_id) THEN
    RAISE EXCEPTION 'You are not assigned to this duty';
  END IF;

  IF t.status = 'completed' THEN
    RETURN t;
  END IF;

  UPDATE public.cleaning_tasks
  SET
    status = 'completed',
    completed_at = now(),
    confirmation_note = nullif(trim(p_note), '')
  WHERE id = p_task_id
  RETURNING * INTO t;

  SELECT * INTO r
  FROM public.rooms
  WHERE id = t.room_id;

  -- Always notify the next pending task in chronological order.
  SELECT ct.* INTO n
  FROM public.cleaning_tasks ct
  JOIN public.cleaning_schedules cs
    ON cs.id = ct.schedule_id
  WHERE ct.room_id = t.room_id
    AND ct.status = 'pending'
    AND ct.duty_date > t.duty_date
  ORDER BY ct.duty_date, ct.due_at
  LIMIT 1;

  IF n.id IS NOT NULL THEN
    INSERT INTO public.notification_events(
      room_id,
      member_id,
      task_id,
      type,
      title,
      body
    )
    VALUES(
      t.room_id,
      n.member_id,
      n.id,
      'next_duty',
      'Next cleaning duty',
      'You are next. Your cleaning duty is scheduled for '
      || to_char(
        n.due_at AT TIME ZONE r.timezone,
        'Dy, DD Mon YYYY HH24:MI'
      )
      || '.'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN t;
END;
$function$;