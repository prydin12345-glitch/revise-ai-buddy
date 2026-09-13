-- Deploy this migration BEFORE the launch-foundations Edge Function bundle.
-- No historical grades are changed. All privileged mutation RPCs are service-role only.
BEGIN;

CREATE TABLE public.ai_request_reservations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_request_reservations_user_feature_time
  ON public.ai_request_reservations(user_id, feature, created_at);
CREATE INDEX ai_request_reservations_time ON public.ai_request_reservations(created_at);
ALTER TABLE public.ai_request_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_request_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_request_reservations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ai_request_reservations_id_seq TO service_role;

CREATE TABLE public.ai_request_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  global_daily_limit integer NOT NULL DEFAULT 2000 CHECK (global_daily_limit > 0)
);
INSERT INTO public.ai_request_settings(id) VALUES (true);
ALTER TABLE public.ai_request_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_request_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_request_settings TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ai_request(
  p_user_id uuid, p_feature text, p_daily_limit integer,
  p_burst_limit integer, p_burst_minutes integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_day timestamptz := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_daily integer; v_burst integer; v_global integer; v_settings public.ai_request_settings;
  v_reason text := NULL; v_retry integer := 60;
BEGIN
  IF p_user_id IS NULL OR length(p_feature) NOT BETWEEN 1 AND 100
     OR p_daily_limit NOT BETWEEN 1 AND 10000 OR p_burst_limit NOT BETWEEN 1 AND 1000
     OR p_burst_minutes NOT BETWEEN 1 AND 1440 THEN
    RAISE EXCEPTION 'Invalid quota parameters';
  END IF;
  -- One short transaction locks the budget, checks limits and reserves a slot.
  -- Two concurrent calls cannot both consume the final available slot.
  PERFORM pg_advisory_xact_lock(913090001);
  SELECT * INTO STRICT v_settings FROM public.ai_request_settings WHERE id;
  SELECT count(*) INTO v_global FROM public.ai_request_reservations WHERE created_at >= v_day;
  SELECT count(*) FILTER (WHERE created_at >= v_day),
         count(*) FILTER (WHERE created_at > v_now - make_interval(mins => p_burst_minutes))
    INTO v_daily, v_burst FROM public.ai_request_reservations
    WHERE user_id = p_user_id AND feature = p_feature
      AND created_at >= least(v_day, v_now - make_interval(mins => p_burst_minutes));
  IF NOT v_settings.enabled THEN v_reason := 'disabled';
  ELSIF v_global >= v_settings.global_daily_limit THEN v_reason := 'global';
  ELSIF v_burst >= p_burst_limit THEN v_reason := 'burst';
  ELSIF v_daily >= p_daily_limit THEN v_reason := 'daily'; END IF;
  IF v_reason IN ('global','daily') THEN
    v_retry := greatest(1, ceil(extract(epoch FROM v_day + interval '1 day' - v_now))::integer);
  ELSIF v_reason = 'burst' THEN v_retry := p_burst_minutes * 60; END IF;
  IF v_reason IS NULL THEN
    INSERT INTO public.ai_request_reservations(user_id, feature) VALUES(p_user_id,p_feature);
    v_daily := v_daily + 1; v_burst := v_burst + 1;
  END IF;
  RETURN jsonb_build_object('allowed',v_reason IS NULL,'reason',v_reason,
    'usedToday',v_daily,'dailyLimit',p_daily_limit,'usedInBurstWindow',v_burst,
    'burstLimit',p_burst_limit,'retryAfterSeconds',CASE WHEN v_reason IS NULL THEN 0 ELSE v_retry END);
END $$;
REVOKE ALL ON FUNCTION public.reserve_ai_request(uuid,text,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_request(uuid,text,integer,integer,integer) TO service_role;
-- Old tutor counters must not remain user-writable, even though new code does not trust them.
REVOKE INSERT, UPDATE, DELETE ON public.ai_tutor_rate_limits FROM anon, authenticated;
DROP POLICY IF EXISTS "Users see own rate limit" ON public.ai_tutor_rate_limits;
CREATE POLICY "Read own legacy tutor quota" ON public.ai_tutor_rate_limits FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.exam_access_info(p_exam_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exam public.exams; v_manager boolean; v_access boolean; v_released boolean;
  v_assigned boolean; v_deadline timestamptz;
BEGIN
  IF p_user_id IS NULL OR (coalesce(auth.role(),'') <> 'service_role' AND p_user_id IS DISTINCT FROM auth.uid()) THEN
    RETURN jsonb_build_object('hasAccess',false);
  END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id = p_exam_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('hasAccess',false); END IF;
  v_manager := v_exam.user_id = p_user_id OR coalesce(v_exam.assigned_by = p_user_id,false);
  SELECT count(*) > 0, coalesce(bool_or(ea.is_grades_released),false), min(ea.deadline)
    INTO v_assigned,v_released,v_deadline FROM public.exam_assignments ea
    WHERE ea.exam_id = p_exam_id AND ea.is_active = true
      AND (ea.release_date IS NULL OR ea.release_date <= now()) AND (
      (ea.assignment_type IN ('individual','student') AND ea.target_id = p_user_id)
      OR (ea.assignment_type = 'group' AND EXISTS (
        SELECT 1 FROM public.group_members gm WHERE gm.group_id=ea.target_id
          AND gm.student_id=p_user_id AND gm.is_active=true))
      OR (ea.assignment_type='all' AND EXISTS (
        SELECT 1 FROM public.group_members gm JOIN public.student_groups sg ON sg.id=gm.group_id
          WHERE gm.student_id=p_user_id AND gm.is_active=true AND sg.is_active=true
          AND sg.tutor_id=ea.assigned_by)));
  v_access := v_manager OR v_assigned;
  RETURN jsonb_build_object('hasAccess',v_access,'isOwner',v_exam.user_id=p_user_id,
    'isManager',v_manager,'isAssigned',v_assigned OR v_exam.assigned_by IS NOT NULL,
    'gradesReleased',v_manager OR coalesce(v_exam.grade_released,false) OR v_released,
    'deadline',v_deadline);
END $$;
REVOKE ALL ON FUNCTION public.exam_access_info(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.exam_access_info(uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.can_read_exam_solutions(p_exam_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_info jsonb;
BEGIN
  v_info := public.exam_access_info(p_exam_id,auth.uid());
  RETURN coalesce((v_info->>'hasAccess')::boolean,false) AND (
    coalesce((v_info->>'isManager')::boolean,false) OR (
      coalesce((v_info->>'gradesReleased')::boolean,false) AND EXISTS (
        SELECT 1 FROM public.exam_submissions es WHERE es.exam_id=p_exam_id
          AND es.student_id=auth.uid() AND es.status='graded')));
END $$;
REVOKE ALL ON FUNCTION public.can_read_exam_solutions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_exam_solutions(uuid) TO authenticated,service_role;

-- Restrictive policies AND with every existing permissive policy, including old FOR ALL policies.
CREATE POLICY "Require released solutions" ON public.exam_questions AS RESTRICTIVE
  FOR SELECT TO authenticated USING (public.can_read_exam_solutions(exam_id));
CREATE POLICY "Hide unreleased answer feedback" ON public.student_answers AS RESTRICTIVE
  FOR SELECT TO authenticated USING (score IS NULL OR public.can_read_exam_solutions(exam_id));
CREATE POLICY "Hide unreleased submission scores" ON public.exam_submissions AS RESTRICTIVE
  FOR SELECT TO authenticated USING (total_score IS NULL OR public.can_read_exam_solutions(exam_id));
REVOKE SELECT ON public.exam_questions,public.student_answers,public.exam_submissions FROM anon;
-- Prevent client-authored grades/statuses. Answer/progress writes use the authenticated Edge Functions.
REVOKE INSERT, UPDATE ON public.student_answers, public.exam_submissions FROM anon, authenticated;

-- Metadata-only views preserve cover pages and progress lists without exposing solutions/scores.
CREATE VIEW public.exam_question_metadata WITH (security_barrier=true) AS
  SELECT q.id,q.exam_id,q.question_number,q.marks FROM public.exam_questions q
  WHERE coalesce((public.exam_access_info(q.exam_id,auth.uid())->>'hasAccess')::boolean,false);
CREATE VIEW public.exam_submission_metadata WITH (security_barrier=true) AS
  SELECT s.id,s.exam_id,s.student_id,s.status,s.time_remaining_seconds,s.last_accessed_at,
         s.exam_started_at,s.submitted_at,s.time_taken_seconds,
         CASE WHEN public.can_read_exam_solutions(s.exam_id) THEN s.total_score ELSE NULL END AS total_score,
         CASE WHEN public.can_read_exam_solutions(s.exam_id) THEN s.total_marks ELSE NULL END AS total_marks
  FROM public.exam_submissions s
  WHERE s.student_id=auth.uid() AND
    coalesce((public.exam_access_info(s.exam_id,auth.uid())->>'hasAccess')::boolean,false);
REVOKE ALL ON public.exam_question_metadata,public.exam_submission_metadata FROM PUBLIC,anon;
GRANT SELECT ON public.exam_question_metadata,public.exam_submission_metadata TO authenticated;

ALTER TABLE public.exam_submissions ADD COLUMN marking_token uuid,
  ADD COLUMN marking_started_at timestamptz, ADD COLUMN marking_error text;

-- Serialize answer/progress writes with the marking claim. A late autosave cannot reopen a graded paper.
CREATE OR REPLACE FUNCTION public.guard_exam_answer_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.exam_questions q WHERE q.id=NEW.question_id AND q.exam_id=NEW.exam_id) THEN
    RAISE EXCEPTION 'Question does not belong to exam';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.exam_id::text || ':' || NEW.student_id::text,0));
  SELECT status INTO v_status FROM public.exam_submissions
    WHERE exam_id=NEW.exam_id AND student_id=NEW.student_id FOR UPDATE;
  IF TG_OP='INSERT' OR (NEW.answer_text,NEW.answer_latex,NEW.answer_format,NEW.table_answers)
    IS DISTINCT FROM (OLD.answer_text,OLD.answer_latex,OLD.answer_format,OLD.table_answers) THEN
    IF v_status IN ('marking','graded','submitted','completed') THEN RAISE EXCEPTION 'Exam answers are locked'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_exam_answer_write BEFORE INSERT OR UPDATE ON public.student_answers
  FOR EACH ROW EXECUTE FUNCTION public.guard_exam_answer_write();

CREATE OR REPLACE FUNCTION public.claim_exam_marking(p_exam_id uuid,p_user_id uuid,p_time_taken integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_submission public.exam_submissions; v_token uuid := gen_random_uuid();
BEGIN
  IF NOT coalesce((public.exam_access_info(p_exam_id,p_user_id)->>'hasAccess')::boolean,false) THEN
    RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_exam_id::text || ':' || p_user_id::text,0));
  INSERT INTO public.exam_submissions(exam_id,student_id,status,submitted_at)
    VALUES(p_exam_id,p_user_id,'in_progress',NULL) ON CONFLICT(exam_id,student_id) DO NOTHING;
  SELECT * INTO STRICT v_submission FROM public.exam_submissions
    WHERE exam_id=p_exam_id AND student_id=p_user_id FOR UPDATE;
  IF v_submission.status='graded' THEN RETURN jsonb_build_object('state','graded'); END IF;
  IF v_submission.status='marking' AND v_submission.marking_started_at > now()-interval '5 minutes' THEN
    RETURN jsonb_build_object('state','busy'); END IF;
  UPDATE public.exam_submissions SET status='marking',marking_token=v_token,
    marking_started_at=now(),marking_error=NULL,total_score=NULL,total_marks=NULL,
    submitted_at=coalesce(CASE WHEN status IN ('marking','marking_failed') THEN submitted_at END,now()),
    time_taken_seconds=greatest(0,coalesce(p_time_taken,0))
    WHERE id=v_submission.id;
  RETURN jsonb_build_object('state','claimed','token',v_token);
END $$;

CREATE OR REPLACE FUNCTION public.fail_exam_marking(p_exam_id uuid,p_user_id uuid,p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.exam_submissions SET status='marking_failed',total_score=NULL,total_marks=NULL,
    marking_error='Marking could not finish. Your answers are saved. Please retry.',marking_token=NULL
  WHERE exam_id=p_exam_id AND student_id=p_user_id AND marking_token=p_token AND status='marking';
$$;

CREATE OR REPLACE FUNCTION public.finish_exam_marking(
  p_exam_id uuid,p_user_id uuid,p_token uuid,p_results jsonb,p_is_late boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_submission public.exam_submissions; v_expected integer; v_count integer;
  v_total numeric; v_marks integer; v_result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_exam_id::text || ':' || p_user_id::text,0));
  SELECT * INTO STRICT v_submission FROM public.exam_submissions
    WHERE exam_id=p_exam_id AND student_id=p_user_id FOR UPDATE;
  IF v_submission.status<>'marking' OR v_submission.marking_token IS DISTINCT FROM p_token THEN
    RAISE EXCEPTION 'Marking claim expired'; END IF;
  SELECT count(*),coalesce(sum(marks),0) INTO v_expected,v_marks FROM public.exam_questions WHERE exam_id=p_exam_id;
  IF jsonb_typeof(p_results)<>'array' OR jsonb_array_length(p_results)<>v_expected OR v_expected=0 THEN
    RAISE EXCEPTION 'Incomplete marking results'; END IF;
  SELECT count(DISTINCT r->>'question_id') INTO v_count FROM jsonb_array_elements(p_results) r;
  IF v_count<>v_expected THEN RAISE EXCEPTION 'Duplicate marking results'; END IF;
  v_total:=0;
  FOR v_result IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    IF jsonb_typeof(v_result->'score') IS DISTINCT FROM 'number' OR
       NOT EXISTS (SELECT 1 FROM public.exam_questions q WHERE q.exam_id=p_exam_id
         AND q.id=(v_result->>'question_id')::uuid AND (v_result->>'score')::numeric BETWEEN 0 AND q.marks) THEN
      RAISE EXCEPTION 'Invalid marking result'; END IF;
    v_total:=v_total+(v_result->>'score')::numeric;
    -- Unanswered questions legitimately score zero but need no fabricated answer row.
    UPDATE public.student_answers SET score=(v_result->>'score')::numeric,
      feedback=v_result->>'feedback',is_correct=(v_result->>'is_correct')::boolean
      WHERE exam_id=p_exam_id AND student_id=p_user_id AND question_id=(v_result->>'question_id')::uuid;
  END LOOP;
  UPDATE public.exam_submissions SET status='graded',total_score=v_total,total_marks=v_marks,
    time_remaining_seconds=NULL,is_late=p_is_late,marking_token=NULL,marking_error=NULL
    WHERE id=v_submission.id;
  RETURN jsonb_build_object('totalScore',v_total,'totalMarks',v_marks);
END $$;

CREATE OR REPLACE FUNCTION public.save_exam_progress_secure(p_exam_id uuid,p_user_id uuid,p_remaining integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT coalesce((public.exam_access_info(p_exam_id,p_user_id)->>'hasAccess')::boolean,false) THEN
    RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_exam_id::text || ':' || p_user_id::text,0));
  INSERT INTO public.exam_submissions(exam_id,student_id,status,submitted_at,exam_started_at,time_remaining_seconds,last_accessed_at)
    VALUES(p_exam_id,p_user_id,'in_progress',NULL,now(),p_remaining,now())
  ON CONFLICT(exam_id,student_id) DO UPDATE SET last_accessed_at=now(),
    time_remaining_seconds=coalesce(p_remaining,exam_submissions.time_remaining_seconds)
    WHERE exam_submissions.status IN ('in_progress','marking_failed');
END $$;

REVOKE ALL ON FUNCTION public.claim_exam_marking(uuid,uuid,integer),
 public.fail_exam_marking(uuid,uuid,uuid),public.finish_exam_marking(uuid,uuid,uuid,jsonb,boolean),
 public.save_exam_progress_secure(uuid,uuid,integer),public.guard_exam_answer_write() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_exam_marking(uuid,uuid,integer),
 public.fail_exam_marking(uuid,uuid,uuid),public.finish_exam_marking(uuid,uuid,uuid,jsonb,boolean),
 public.save_exam_progress_secure(uuid,uuid,integer) TO service_role;
COMMIT;
