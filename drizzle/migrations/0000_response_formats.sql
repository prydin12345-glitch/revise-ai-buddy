CREATE TABLE public.question_response_results (
  contract_id uuid NOT NULL REFERENCES public.question_response_contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('marking','graded','failed')),
  marking_token uuid,
  marking_started_at timestamptz,
  draft_revision integer NOT NULL DEFAULT 0,
  response jsonb,
  result jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(contract_id,user_id),
  CHECK ((status='graded' AND result IS NOT NULL) OR (status<>'graded' AND result IS NULL))
);
ALTER TABLE public.question_response_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.question_response_results FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.question_response_results TO service_role;

CREATE FUNCTION public.has_practice_response_contract(p_question_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.question_response_contracts WHERE practice_question_id=p_question_id);
$$;
REVOKE ALL ON FUNCTION public.has_practice_response_contract(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_practice_response_contract(uuid) TO authenticated,service_role;
CREATE POLICY structured_practice_insert_guard ON public.practice_question_answers AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (NOT public.has_practice_response_contract(question_id));
CREATE POLICY structured_practice_update_guard ON public.practice_question_answers AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (NOT public.has_practice_response_contract(question_id))
  WITH CHECK (NOT public.has_practice_response_contract(question_id));
CREATE POLICY structured_practice_delete_guard ON public.practice_question_answers AS RESTRICTIVE
  FOR DELETE TO authenticated USING (NOT public.has_practice_response_contract(question_id));

CREATE FUNCTION public.claim_exam_responses(p_exam_id uuid,p_user_id uuid,p_time_taken integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_status text; d record;
BEGIN
  IF NOT coalesce((public.exam_access_info(p_exam_id,p_user_id)->>'hasAccess')::boolean,false) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_exam_id::text||':'||p_user_id::text,0));
  SELECT status INTO v_status FROM public.exam_submissions WHERE exam_id=p_exam_id AND student_id=p_user_id FOR UPDATE;
  IF v_status IS NULL OR v_status IN ('in_progress','marking_failed') THEN
    FOR d IN SELECT q.id AS question_id,draft.response FROM public.question_response_contracts c
      JOIN public.exam_questions q ON q.id=c.exam_question_id
      JOIN public.question_response_drafts draft ON draft.contract_id=c.id AND draft.user_id=p_user_id
      WHERE q.exam_id=p_exam_id LOOP
      INSERT INTO public.student_answers(exam_id,question_id,student_id,answer_text,score,is_correct,feedback,submitted_at)
        VALUES(p_exam_id,d.question_id,p_user_id,d.response::text,NULL,NULL,NULL,now())
      ON CONFLICT(question_id,student_id) DO UPDATE SET answer_text=EXCLUDED.answer_text,
        score=NULL,is_correct=NULL,feedback=NULL,submitted_at=now();
    END LOOP;
  END IF;
  RETURN public.claim_exam_marking(p_exam_id,p_user_id,p_time_taken);
END $$;

CREATE FUNCTION public.finish_exam_responses(p_exam_id uuid,p_user_id uuid,p_token uuid,p_results jsonb,p_is_late boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE answer record; item jsonb; summary jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_exam_id::text||':'||p_user_id::text,0));
  summary:=public.finish_exam_marking(p_exam_id,p_user_id,p_token,p_results,p_is_late);
  FOR answer IN SELECT c.id,c.definition,q.id AS question_id,q.marks,d.response,d.revision
    FROM public.question_response_contracts c JOIN public.exam_questions q ON q.id=c.exam_question_id
    LEFT JOIN public.question_response_drafts d ON d.contract_id=c.id AND d.user_id=p_user_id
    WHERE q.exam_id=p_exam_id LOOP
    SELECT r INTO item FROM jsonb_array_elements(p_results) r WHERE r->>'question_id'=answer.question_id::text;
    IF (item->'response_result'->>'version') IS DISTINCT FROM '1'
      OR (item->'response_result'->>'definitionRevision') IS DISTINCT FROM (answer.definition->>'revision')
      OR (item->'response_result'->'score') IS DISTINCT FROM (item->'score')
      OR (item->'response_result'->>'maxMarks')::numeric IS DISTINCT FROM answer.marks::numeric THEN
      RAISE EXCEPTION 'Incomplete structured exam result';
    END IF;
    INSERT INTO public.question_response_results(contract_id,user_id,status,draft_revision,response,result)
      VALUES(answer.id,p_user_id,'graded',coalesce(answer.revision,0),answer.response,item->'response_result')
    ON CONFLICT(contract_id,user_id) DO UPDATE SET status='graded',marking_token=NULL,
      draft_revision=EXCLUDED.draft_revision,response=EXCLUDED.response,result=EXCLUDED.result,updated_at=now();
  END LOOP;
  RETURN summary;
END $$;

CREATE FUNCTION public.claim_practice_response(p_contract_id uuid,p_user_id uuid,p_expected_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE draft public.question_response_drafts; marked public.question_response_results; token uuid:=gen_random_uuid();
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.question_response_contracts c JOIN public.practice_questions q ON q.id=c.practice_question_id
    JOIN public.practice_question_sets s ON s.id=q.set_id WHERE c.id=p_contract_id AND s.user_id=p_user_id) THEN RAISE EXCEPTION 'Practice access denied'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_contract_id::text||':'||p_user_id::text,1));
  SELECT * INTO marked FROM public.question_response_results WHERE contract_id=p_contract_id AND user_id=p_user_id FOR UPDATE;
  IF marked.status='graded' THEN RETURN jsonb_build_object('state','graded','result',marked.result); END IF;
  IF marked.status='marking' AND marked.marking_started_at>now()-interval '5 minutes' THEN RETURN jsonb_build_object('state','busy'); END IF;
  SELECT * INTO draft FROM public.question_response_drafts WHERE contract_id=p_contract_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR p_expected_revision IS DISTINCT FROM draft.revision THEN RAISE EXCEPTION 'Draft revision changed; reload before marking'; END IF;
  INSERT INTO public.question_response_results(contract_id,user_id,status,marking_token,marking_started_at,draft_revision,response,result)
    VALUES(p_contract_id,p_user_id,'marking',token,now(),draft.revision,draft.response,NULL)
  ON CONFLICT(contract_id,user_id) DO UPDATE SET status='marking',marking_token=EXCLUDED.marking_token,
    marking_started_at=now(),draft_revision=EXCLUDED.draft_revision,response=EXCLUDED.response,result=NULL,updated_at=now();
  RETURN jsonb_build_object('state','claimed','token',token,'response',draft.response,'revision',draft.revision);
END $$;

CREATE FUNCTION public.finish_practice_response(p_contract_id uuid,p_user_id uuid,p_token uuid,p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE marked public.question_response_results; question record; attempted integer; correct integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_contract_id::text||':'||p_user_id::text,1));
  SELECT * INTO STRICT marked FROM public.question_response_results WHERE contract_id=p_contract_id AND user_id=p_user_id FOR UPDATE;
  IF marked.status<>'marking' OR marked.marking_token IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'Practice marking claim expired'; END IF;
  SELECT q.id,q.set_id,q.marks,c.definition INTO STRICT question FROM public.question_response_contracts c
    JOIN public.practice_questions q ON q.id=c.practice_question_id JOIN public.practice_question_sets s ON s.id=q.set_id
    WHERE c.id=p_contract_id AND s.user_id=p_user_id;
  IF (p_result->>'version') IS DISTINCT FROM '1' OR (p_result->>'definitionRevision') IS DISTINCT FROM (question.definition->>'revision')
    OR jsonb_typeof(p_result->'score') IS DISTINCT FROM 'number' OR NOT ((p_result->>'score')::numeric BETWEEN 0 AND question.marks)
    OR (p_result->>'maxMarks')::numeric IS DISTINCT FROM question.marks::numeric
    OR jsonb_typeof(p_result->'feedback') IS DISTINCT FROM 'string'
    OR (p_result->>'isCorrect')::boolean IS DISTINCT FROM ((p_result->>'score')::numeric=question.marks) THEN
    RAISE EXCEPTION 'Invalid practice result';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('practice-progress:'||question.set_id::text||':'||p_user_id::text,2));
  INSERT INTO public.practice_question_answers(user_id,set_id,question_id,answer_text,score,is_correct,feedback,submitted_at,updated_at)
    VALUES(p_user_id,question.set_id,question.id,marked.response::text,(p_result->>'score')::numeric,
      (p_result->>'isCorrect')::boolean,p_result->>'feedback',now(),now())
  ON CONFLICT(user_id,question_id) DO UPDATE SET answer_text=EXCLUDED.answer_text,score=EXCLUDED.score,
    is_correct=EXCLUDED.is_correct,feedback=EXCLUDED.feedback,submitted_at=EXCLUDED.submitted_at,updated_at=now();
  UPDATE public.question_response_results SET status='graded',result=p_result,marking_token=NULL,updated_at=now()
    WHERE contract_id=p_contract_id AND user_id=p_user_id;
  SELECT count(*),count(*) FILTER(WHERE is_correct) INTO attempted,correct FROM public.practice_question_answers
    WHERE user_id=p_user_id AND set_id=question.set_id AND score IS NOT NULL AND submitted_at IS NOT NULL;
  INSERT INTO public.practice_set_progress(user_id,set_id,questions_attempted,questions_correct,last_accessed_at,updated_at)
    VALUES(p_user_id,question.set_id,attempted,correct,now(),now())
  ON CONFLICT(user_id,set_id) DO UPDATE SET questions_attempted=EXCLUDED.questions_attempted,
    questions_correct=EXCLUDED.questions_correct,last_accessed_at=now(),updated_at=now();
  RETURN p_result;
END $$;

CREATE FUNCTION public.fail_practice_response(p_contract_id uuid,p_user_id uuid,p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.question_response_results SET status='failed',result=NULL,marking_token=NULL,updated_at=now()
    WHERE contract_id=p_contract_id AND user_id=p_user_id AND marking_token=p_token AND status='marking';
$$;

REVOKE ALL ON FUNCTION public.claim_exam_responses(uuid,uuid,integer),public.finish_exam_responses(uuid,uuid,uuid,jsonb,boolean),
  public.claim_practice_response(uuid,uuid,integer),public.finish_practice_response(uuid,uuid,uuid,jsonb),
  public.fail_practice_response(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_exam_responses(uuid,uuid,integer),public.finish_exam_responses(uuid,uuid,uuid,jsonb,boolean),
  public.claim_practice_response(uuid,uuid,integer),public.finish_practice_response(uuid,uuid,uuid,jsonb),
  public.fail_practice_response(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.save_question_response_draft(
  p_contract_id uuid,p_user_id uuid,p_response jsonb,p_expected_revision integer,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.question_response_contracts; old_draft public.question_response_drafts;
  v_exam_id uuid; v_status text; v_question_id uuid; next_revision integer;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0
    OR p_response IS NULL OR octet_length(p_response::text)>131072 THEN RAISE EXCEPTION 'Invalid response request'; END IF;
  SELECT * INTO c FROM public.question_response_contracts WHERE id=p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Response contract not found'; END IF;
  v_question_id:=coalesce(c.exam_question_id,c.practice_question_id);
  IF jsonb_typeof(p_response)<>'object' OR (p_response->>'version') IS DISTINCT FROM '1'
    OR (p_response->>'questionId') IS DISTINCT FROM v_question_id::text
    OR (p_response->>'definitionRevision') IS DISTINCT FROM (c.definition->>'revision')
    OR (p_response->>'kind') IS DISTINCT FROM (c.definition->>'kind') THEN
    RAISE EXCEPTION 'Response identity mismatch';
  END IF;
  IF c.exam_question_id IS NOT NULL THEN
    SELECT exam_id INTO v_exam_id FROM public.exam_questions WHERE id=c.exam_question_id;
    IF NOT coalesce((public.exam_access_info(v_exam_id,p_user_id)->>'hasAccess')::boolean,false) THEN
      RAISE EXCEPTION 'Response access denied';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_exam_id::text||':'||p_user_id::text,0));
    SELECT status INTO v_status FROM public.exam_submissions WHERE exam_id=v_exam_id AND student_id=p_user_id FOR UPDATE;
    IF v_status IN ('marking','graded','submitted','completed') THEN RAISE EXCEPTION 'Exam answers are locked'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.practice_questions q JOIN public.practice_question_sets s ON s.id=q.set_id
      WHERE q.id=c.practice_question_id AND s.user_id=p_user_id) THEN RAISE EXCEPTION 'Response access denied'; END IF;
    IF EXISTS (SELECT 1 FROM public.practice_question_answers a WHERE a.question_id=c.practice_question_id AND a.user_id=p_user_id AND a.score IS NOT NULL) THEN
      RAISE EXCEPTION 'Practice answer is already marked';
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_contract_id::text||':'||p_user_id::text,1));
  IF c.practice_question_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.question_response_results
    WHERE contract_id=p_contract_id AND user_id=p_user_id AND status IN ('marking','graded')) THEN
    RAISE EXCEPTION 'Practice response is locked';
  END IF;
  SELECT * INTO old_draft FROM public.question_response_drafts WHERE contract_id=p_contract_id AND user_id=p_user_id FOR UPDATE;
  IF FOUND AND old_draft.last_request_id=p_request_id THEN
    IF old_draft.response IS DISTINCT FROM p_response THEN RAISE EXCEPTION 'Request ID reused with different content'; END IF;
    RETURN jsonb_build_object('revision',old_draft.revision,'response',old_draft.response,'updatedAt',old_draft.updated_at,'replayed',true);
  END IF;
  IF coalesce(old_draft.revision,0)<>p_expected_revision THEN
    RETURN jsonb_build_object('conflict',true,'revision',coalesce(old_draft.revision,0));
  END IF;
  next_revision:=p_expected_revision+1;
  INSERT INTO public.question_response_drafts(contract_id,user_id,response,revision,last_request_id)
    VALUES(p_contract_id,p_user_id,p_response,next_revision,p_request_id)
    ON CONFLICT(contract_id,user_id) DO UPDATE SET response=EXCLUDED.response,revision=EXCLUDED.revision,
      last_request_id=EXCLUDED.last_request_id,updated_at=now();
  RETURN jsonb_build_object('revision',next_revision,'response',p_response,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.save_question_response_draft(uuid,uuid,jsonb,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_question_response_draft(uuid,uuid,jsonb,integer,uuid) TO service_role;