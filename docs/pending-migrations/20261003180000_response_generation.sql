-- Batch 3: atomically bind generated questions to private response contracts.
-- Requires both response foundation batches. No historical conversion.
BEGIN;
CREATE TABLE public.question_response_generation_drafts (
  draft_id uuid PRIMARY KEY REFERENCES public.exam_question_drafts(id) ON DELETE CASCADE,
  source_snapshot jsonb NOT NULL,
  carrier jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(source_snapshot)='object'),
  CHECK (carrier->>'format'='examly_response_v1')
);
ALTER TABLE public.question_response_generation_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.question_response_generation_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.question_response_generation_drafts TO service_role;

CREATE FUNCTION public.commit_generated_responses(p_source text,p_parent_id uuid,p_user_id uuid,p_context jsonb,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE saved_context jsonb; parent_status text; q jsonb; item jsonb; response jsonb; key jsonb;
  v_table_name text; parent_column text; contract_column text; fields text; inserted_id uuid;
  n integer:=0; expected_count integer; existing_count integer; expected_marks integer; actual_marks integer;
BEGIN
  IF p_source NOT IN ('exam','practice') OR p_user_id IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_rows)<1 OR jsonb_array_length(p_rows)>300 THEN RAISE EXCEPTION 'Invalid generation commit'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('generated-responses:'||p_source||':'||p_parent_id::text,0));
  IF p_source='exam' THEN
    SELECT generation_context,status INTO saved_context,parent_status FROM public.exams WHERE id=p_parent_id AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Generation owner mismatch'; END IF;
    IF parent_status='published' THEN
      SELECT count(*) INTO existing_count FROM public.exam_questions WHERE exam_id=p_parent_id;
      IF existing_count=0 THEN RAISE EXCEPTION 'Published paper has no questions'; END IF;
      RETURN jsonb_build_object('count',existing_count,'replayed',true);
    END IF;
    IF EXISTS(SELECT 1 FROM public.exam_submissions WHERE exam_id=p_parent_id)
      OR EXISTS(SELECT 1 FROM public.student_answers WHERE exam_id=p_parent_id)
      OR EXISTS(SELECT 1 FROM public.question_response_drafts d JOIN public.question_response_contracts c ON c.id=d.contract_id JOIN public.exam_questions q ON q.id=c.exam_question_id WHERE q.exam_id=p_parent_id) THEN RAISE EXCEPTION 'Cannot replace an attempted exam'; END IF;
    SELECT count(*),coalesce(sum(marks),0) INTO expected_count,expected_marks FROM public.exam_question_drafts WHERE exam_id=p_parent_id;
    IF expected_count<>jsonb_array_length(p_rows) THEN RAISE EXCEPTION 'Draft count changed before publication'; END IF;
    SELECT sum((v->'question'->>'marks')::integer) INTO actual_marks FROM jsonb_array_elements(p_rows) v;
    IF actual_marks<>expected_marks THEN RAISE EXCEPTION 'Draft marks changed before publication'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) v WHERE NOT EXISTS(SELECT 1 FROM public.exam_question_drafts d WHERE d.exam_id=p_parent_id AND d.question_number::text=v->'question'->>'question_number' AND d.marks=(v->'question'->>'marks')::integer)) THEN RAISE EXCEPTION 'Draft identity changed before publication'; END IF;
    v_table_name:='exam_questions';parent_column:='exam_id';contract_column:='exam_question_id';
  ELSE
    SELECT generation_context,extraction_status INTO saved_context,parent_status FROM public.practice_question_sets WHERE id=p_parent_id AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Generation owner mismatch'; END IF;
    IF parent_status='completed' THEN
      SELECT count(*) INTO existing_count FROM public.practice_questions WHERE set_id=p_parent_id;
      IF existing_count=0 THEN RAISE EXCEPTION 'Completed quiz has no questions'; END IF;
      RETURN jsonb_build_object('count',existing_count,'replayed',true);
    END IF;
    IF EXISTS(SELECT 1 FROM public.practice_question_answers WHERE set_id=p_parent_id)
      OR EXISTS(SELECT 1 FROM public.question_response_drafts d JOIN public.question_response_contracts c ON c.id=d.contract_id JOIN public.practice_questions q ON q.id=c.practice_question_id WHERE q.set_id=p_parent_id) THEN RAISE EXCEPTION 'Cannot replace an attempted quiz'; END IF;
    v_table_name:='practice_questions';parent_column:='set_id';contract_column:='practice_question_id';
  END IF;
  IF saved_context IS DISTINCT FROM p_context THEN RAISE EXCEPTION 'Generation snapshot changed'; END IF;
  IF (SELECT count(DISTINCT v->'question'->>'question_number') FROM jsonb_array_elements(p_rows) v)<>jsonb_array_length(p_rows) THEN RAISE EXCEPTION 'Duplicate generated question number'; END IF;
  EXECUTE format('DELETE FROM public.%I WHERE %I=$1',v_table_name,parent_column) USING p_parent_id;
  FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    q:=item->'question'; response:=item->'response';
    IF p_source='exam' AND NOT EXISTS(SELECT 1 FROM public.exam_question_drafts d WHERE d.exam_id=p_parent_id AND d.id=(item->'sourceDraft'->>'id')::uuid
      AND jsonb_build_object('id',d.id,'question_text',d.question_text,'marks',d.marks,'correct_answer',d.correct_answer,'diagram_config',d.diagram_config,'options',to_jsonb(d)->'options','table_data',to_jsonb(d)->'table_data','question_type',to_jsonb(d)->'question_type','topic_tag',to_jsonb(d)->'topic_tag') = item->'sourceDraft') THEN
      RAISE EXCEPTION 'Source draft changed; rerun publication validation';
    END IF;
    IF p_source='exam' THEN
      IF response IS NOT NULL AND response<>'null'::jsonb THEN
        IF NOT EXISTS(SELECT 1 FROM public.question_response_generation_drafts c WHERE c.draft_id=(item->'sourceDraft'->>'id')::uuid
          AND c.source_snapshot=item->'sourceDraft' AND c.carrier->'definition'=response->'definition' AND c.carrier->'key'=response->'key') THEN
          RAISE EXCEPTION 'Private response draft changed or is missing';
        END IF;
      ELSIF EXISTS(SELECT 1 FROM public.question_response_generation_drafts c WHERE c.draft_id=(item->'sourceDraft'->>'id')::uuid) THEN
        RAISE EXCEPTION 'A private response draft was dropped before publication';
      END IF;
    END IF;
    IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR (q->>parent_column)::uuid IS DISTINCT FROM p_parent_id THEN RAISE EXCEPTION 'Question parent mismatch'; END IF;
    q:=q||jsonb_build_object('id',gen_random_uuid());
    IF response IS NOT NULL AND response<>'null'::jsonb THEN
      key:=response->'key';
      IF saved_context->>'response_formats' IS DISTINCT FROM 'interactive_v1' OR saved_context->>'resolved_by' IS DISTINCT FROM 'server'
        OR response->'definition'->>'version' IS DISTINCT FROM '1' OR key->>'version' IS DISTINCT FROM '1'
        OR response->'definition'->>'revision' IS DISTINCT FROM key->>'definitionRevision'
        OR (key->>'maxMarks')::numeric IS DISTINCT FROM (q->>'marks')::numeric
        OR jsonb_typeof(key->'units') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid response contract at commit'; END IF;
      IF (SELECT sum((u->>'marks')::numeric) FROM jsonb_array_elements(key->'units') u) IS DISTINCT FROM (q->>'marks')::numeric THEN RAISE EXCEPTION 'Response unit marks mismatch'; END IF;
      IF q->>'correct_answer' IS NOT NULL OR q->>'rationale' IS NOT NULL OR q->>'worked_solution' IS NOT NULL OR q->>'numerical_answer' IS NOT NULL THEN RAISE EXCEPTION 'Private response answer still on question'; END IF;
    END IF;
    -- Insert only supplied, real columns. Omitted columns retain database defaults.
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(q) k WHERE NOT EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=v_table_name AND c.column_name=k)) THEN RAISE EXCEPTION 'Unknown generated question column'; END IF;
    SELECT string_agg(format('%I',k),',') INTO fields FROM jsonb_object_keys(q) k;
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) RETURNING id',v_table_name,fields,fields,v_table_name) INTO inserted_id USING q;
    IF response IS NOT NULL AND response<>'null'::jsonb THEN
      EXECUTE format('INSERT INTO public.question_response_contracts(%I,definition,marking_key) VALUES($1,$2,$3)',contract_column) USING inserted_id,response->'definition',key;
    END IF;
    n:=n+1;
  END LOOP;
  IF p_source='exam' THEN UPDATE public.exams SET status='published' WHERE id=p_parent_id;
  ELSE UPDATE public.practice_question_sets SET extraction_status='completed',extraction_error=NULL,total_questions_generated=n WHERE id=p_parent_id;
  END IF;
  RETURN jsonb_build_object('count',n,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.commit_generated_responses(text,uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_generated_responses(text,uuid,uuid,jsonb,jsonb) TO service_role;
COMMIT;
