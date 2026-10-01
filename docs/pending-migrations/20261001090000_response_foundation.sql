-- Batch 1: isolated, unscored drafts. No historical answer or grade rewrite.
-- Apply through the backend migration tool; regenerate types afterwards.
BEGIN;
CREATE TABLE public.question_response_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_question_id uuid UNIQUE REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  practice_question_id uuid UNIQUE REFERENCES public.practice_questions(id) ON DELETE CASCADE,
  definition jsonb NOT NULL,
  marking_key jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(exam_question_id,practice_question_id)=1),
  CHECK (jsonb_typeof(definition)='object' AND definition->>'version'='1'),
  CHECK (jsonb_typeof(marking_key)='object' AND marking_key->>'version'='1'),
  CHECK (definition->>'revision'=marking_key->>'definitionRevision')
);
CREATE TABLE public.question_response_drafts (
  contract_id uuid NOT NULL REFERENCES public.question_response_contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response jsonb NOT NULL,
  revision integer NOT NULL CHECK (revision>0),
  last_request_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(contract_id,user_id),
  CHECK (jsonb_typeof(response)='object' AND response->>'version'='1')
);
-- Neither the key nor another student's draft is accessible through PostgREST.
ALTER TABLE public.question_response_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_response_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.question_response_contracts,public.question_response_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.question_response_contracts,public.question_response_drafts TO service_role;

CREATE FUNCTION public.guard_response_contract_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF (NEW.exam_question_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.student_answers WHERE question_id=NEW.exam_question_id))
      OR (NEW.practice_question_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.practice_question_answers WHERE question_id=NEW.practice_question_id)) THEN
      RAISE EXCEPTION 'Cannot attach a response contract to a question with existing answers';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.exam_question_id,NEW.practice_question_id,NEW.definition,NEW.marking_key)
    IS DISTINCT FROM (OLD.exam_question_id,OLD.practice_question_id,OLD.definition,OLD.marking_key) THEN
    RAISE EXCEPTION 'Response contract is immutable; create a new question for a new definition';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER response_contract_immutable BEFORE INSERT OR UPDATE ON public.question_response_contracts
  FOR EACH ROW EXECUTE FUNCTION public.guard_response_contract_immutable();
REVOKE ALL ON FUNCTION public.guard_response_contract_immutable() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.save_question_response_draft(
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
    -- Same lock as claim_exam_marking: a save cannot race final submission.
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
COMMIT;
