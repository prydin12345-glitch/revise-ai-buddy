-- PROPOSAL ONLY. Not applied by this task. Inspect connected schema before use.
BEGIN;
ALTER TABLE public.subject_exam_profiles ADD COLUMN IF NOT EXISTS profile_template jsonb;
ALTER TABLE public.subject_exam_profiles ADD CONSTRAINT profile_template_envelope CHECK (
 profile_template IS NULL OR coalesce((jsonb_typeof(profile_template)='object' AND profile_template->>'version'='1'
 AND profile_template->>'resolved_by'='server' AND profile_template->>'origin' IN ('catalogue','source_backed_ai','model_knowledge_ai','manual')),false));
CREATE FUNCTION public.guard_profile_template() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT (coalesce(auth.role(),'')='service_role' OR current_user IN ('postgres','supabase_admin','service_role'))
 AND ((TG_OP='INSERT' AND NEW.profile_template IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.profile_template IS DISTINCT FROM OLD.profile_template)) THEN
 RAISE EXCEPTION 'profile_template is server-owned' USING ERRCODE='42501'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER guard_profile_template BEFORE INSERT OR UPDATE ON public.subject_exam_profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_template();
CREATE TABLE public.profile_builder_requests (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, request_id uuid NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'), state text NOT NULL CHECK(state IN ('running','complete','failed')) DEFAULT 'running',
 result jsonb, saved_profile_id uuid REFERENCES public.subject_exam_profiles(id) ON DELETE SET NULL,
 call_intents integer NOT NULL DEFAULT 0 CHECK(call_intents BETWEEN 0 AND 3),
 provider_usage jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(provider_usage)='array'),
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, PRIMARY KEY(user_id,request_id),
 CHECK((state='complete' AND result IS NOT NULL) OR (state<>'complete' AND result IS NULL))
);
ALTER TABLE public.profile_builder_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_builder_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.profile_builder_requests TO authenticated; GRANT ALL ON public.profile_builder_requests TO service_role;
CREATE POLICY owner_reads_builder_requests ON public.profile_builder_requests FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION public.claim_profile_builder_request(p_owner uuid,p_request uuid,p_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.profile_builder_requests;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text,6111200));
 IF NOT EXISTS(SELECT 1 FROM public.profile_builder_requests WHERE user_id=p_owner AND request_id=p_request)
 AND (SELECT count(*) FROM public.profile_builder_requests WHERE user_id=p_owner AND created_at>=now()-interval '24 hours')>=120 THEN RAISE EXCEPTION 'Builder request limit reached'; END IF;
 INSERT INTO public.profile_builder_requests(user_id,request_id,payload_hash) VALUES(p_owner,p_request,p_hash) ON CONFLICT DO NOTHING;
 IF FOUND THEN RETURN jsonb_build_object('state','claimed'); END IF;
 SELECT * INTO STRICT r FROM public.profile_builder_requests WHERE user_id=p_owner AND request_id=p_request FOR UPDATE;
 IF r.payload_hash<>p_hash THEN RAISE EXCEPTION 'Idempotency key reused with different input'; END IF;
 RETURN jsonb_build_object('state',CASE WHEN r.state='running' THEN 'busy' ELSE r.state END,'result',r.result);
END $$;
CREATE FUNCTION public.record_profile_builder_call(p_owner uuid,p_request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN UPDATE public.profile_builder_requests SET call_intents=call_intents+1 WHERE user_id=p_owner AND request_id=p_request AND state='running' AND call_intents<3;
 IF NOT FOUND THEN RAISE EXCEPTION 'Builder call budget exhausted or request unavailable'; END IF;
END $$;
CREATE FUNCTION public.record_profile_builder_usage(p_owner uuid,p_request uuid,p_usage jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF jsonb_typeof(p_usage)<>'object' OR NOT(p_usage ? 'promptTokens' AND p_usage ? 'completionTokens' AND p_usage ? 'outcome') OR (p_usage->>'promptTokens')::integer<0 OR (p_usage->>'completionTokens')::integer<0 THEN RAISE EXCEPTION 'Invalid provider accounting'; END IF;
 UPDATE public.profile_builder_requests SET provider_usage=provider_usage||jsonb_build_array(p_usage) WHERE user_id=p_owner AND request_id=p_request AND state='running' AND jsonb_array_length(provider_usage)<call_intents;
 IF NOT FOUND THEN RAISE EXCEPTION 'No unrecorded builder call'; END IF;
END $$;
CREATE FUNCTION public.save_builder_profile(p_owner uuid,p_profile uuid,p_name text,p_settings jsonb,p_context jsonb,p_proposal uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.subject_exam_profiles; target uuid;
BEGIN
 IF length(trim(p_name)) NOT BETWEEN 1 AND 120 OR coalesce(p_context->>'resolved_by','')<>'server' THEN RAISE EXCEPTION 'Invalid profile envelope'; END IF;
 IF p_proposal IS NOT NULL THEN SELECT saved_profile_id INTO target FROM public.profile_builder_requests WHERE user_id=p_owner AND request_id=p_proposal FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF; END IF;
 IF p_profile IS NULL AND target IS NULL THEN
 INSERT INTO public.subject_exam_profiles(user_id,subject_name,profile_name,topics,question_count) VALUES(p_owner,p_settings->>'subject_name',p_name,ARRAY(SELECT jsonb_array_elements_text(p_settings->'topics')),(p_settings->>'question_count')::integer) RETURNING id INTO target;
 ELSIF p_profile IS NOT NULL THEN SELECT id INTO target FROM public.subject_exam_profiles WHERE id=p_profile AND user_id=p_owner FOR UPDATE;
 IF target IS NULL THEN RAISE EXCEPTION 'Profile not found' USING ERRCODE='42501'; END IF; END IF;
 UPDATE public.subject_exam_profiles SET profile_name=p_name,topics=ARRAY(SELECT jsonb_array_elements_text(p_settings->'topics')),question_count=(p_settings->>'question_count')::integer,
 educational_tier=p_settings->>'educational_tier',assessment_tier=p_settings->>'assessment_tier',exam_board=p_settings->>'exam_board',time_limit_minutes=(p_settings->>'time_limit_minutes')::integer,
 mcq_count=(p_settings->>'mcq_count')::integer,written_question_count=(p_settings->>'written_question_count')::integer,mcq_options_count=(p_settings->>'mcq_options_count')::integer,
 question_structure=p_settings->>'question_structure',parent_question_count=(p_settings->>'parent_question_count')::integer,max_parts_per_question=(p_settings->>'max_parts_per_question')::integer,
 mcq_position=p_settings->>'mcq_position',mark_distribution=p_settings->'mark_distribution',include_extended=(p_settings->>'include_extended')::boolean,extended_marks=(p_settings->>'extended_marks')::integer,
 difficulty_progression=p_settings->>'difficulty_progression',calculator_policy=p_settings->>'calculator_policy',include_graphs=(p_settings->>'include_graphs')::boolean,include_tables=(p_settings->>'include_tables')::boolean,
 paper_blueprint=NULLIF(p_settings->'paper_blueprint','null'::jsonb),profile_template=p_context WHERE id=target AND user_id=p_owner RETURNING * INTO r;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owned profile save failed' USING ERRCODE='42501'; END IF;
 IF p_proposal IS NOT NULL AND p_profile IS NULL THEN UPDATE public.profile_builder_requests SET saved_profile_id=target WHERE user_id=p_owner AND request_id=p_proposal; END IF;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.claim_profile_builder_request(uuid,uuid,text),public.record_profile_builder_call(uuid,uuid),public.record_profile_builder_usage(uuid,uuid,jsonb),public.save_builder_profile(uuid,uuid,text,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_profile_builder_request(uuid,uuid,text),public.record_profile_builder_call(uuid,uuid),public.record_profile_builder_usage(uuid,uuid,jsonb),public.save_builder_profile(uuid,uuid,text,jsonb,jsonb,uuid) TO service_role;
COMMIT;
