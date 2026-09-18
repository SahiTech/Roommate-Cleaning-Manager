-- Task metadata
ALTER TABLE public.cleaning_schedules
  ADD COLUMN IF NOT EXISTS task_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS repeat_unit text NOT NULL DEFAULT 'days'
    CHECK (repeat_unit IN ('days','weeks')),
  ADD COLUMN IF NOT EXISTS repeat_interval integer NOT NULL DEFAULT 1
    CHECK (repeat_interval BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Home',
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.cleaning_tasks
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text;

UPDATE public.cleaning_schedules
SET repeat_unit='days', repeat_interval=greatest(interval_days,1)
WHERE repeat_unit IS NULL OR repeat_interval IS NULL;

UPDATE public.cleaning_tasks ct
SET title=coalesce(cs.title,'Cleaning task'),
    description=coalesce(cs.task_description,''),
    category=coalesce(cs.category,'Home')
FROM public.cleaning_schedules cs
WHERE cs.id=ct.schedule_id;

-- Invite tokens are short, shareable, expire in 7 days and support up to 20 joins.
CREATE OR REPLACE FUNCTION public.create_room_invite(p_room_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_code text;
BEGIN
 IF NOT public.is_room_admin(p_room_id) THEN RAISE EXCEPTION 'Admin access required'; END IF;
 v_code:=upper(substr(encode(gen_random_bytes(9),'hex'),1,12));
 INSERT INTO public.room_invites(room_id,created_by,code_hash,expires_at,max_uses,uses,revoked)
 VALUES(p_room_id,auth.uid(),encode(digest(v_code,'sha256'),'hex'),now()+interval '7 days',20,0,false);
 RETURN v_code;
END;$function$;

CREATE OR REPLACE FUNCTION public.accept_room_invite(p_code text,p_name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_inv public.room_invites%rowtype; v_name text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO v_inv FROM public.room_invites
 WHERE code_hash=encode(digest(upper(trim(p_code)),'sha256'),'hex')
 AND revoked=false AND expires_at>now() AND uses<max_uses FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invite is invalid, expired, or full'; END IF;
 IF EXISTS(SELECT 1 FROM public.members WHERE room_id=v_inv.room_id AND user_id=auth.uid() AND active=true) THEN RETURN v_inv.room_id; END IF;
 SELECT coalesce(nullif(trim(p_name),''),nullif(raw_user_meta_data->>'full_name',''),split_part(email,'@',1),'Room member')
 INTO v_name FROM auth.users WHERE id=auth.uid();
 INSERT INTO public.members(room_id,user_id,name,email,role,active,joined_at)
 SELECT v_inv.room_id,auth.uid(),v_name,u.email,'member',true,now() FROM auth.users u WHERE u.id=auth.uid();
 UPDATE public.room_invites SET uses=uses+1 WHERE id=v_inv.id;
 RETURN v_inv.room_id;
END;$function$;