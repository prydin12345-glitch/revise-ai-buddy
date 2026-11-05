-- PROPOSAL ONLY. Reviewed with offline SQL tests; do not apply without rollout approval.
-- The existing request table cannot store checkpoints while running (its CHECK
-- requires result=NULL). This additive table keeps that invariant and the existing
-- three-call receipt/quotas authoritative. No profile or saved attempt is changed.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.profile_builder_requests') IS NULL
 OR to_regprocedure('public.reserve_ai_request(uuid,text,integer,integer,integer)') IS NULL THEN
  RAISE EXCEPTION 'Install the reviewed existing Profile Builder and quota prerequisites first';
 END IF;
 IF to_regclass('public.profile_builder_jobs') IS NOT NULL THEN
  RAISE EXCEPTION 'Profile Builder jobs already exist; inspect migration history';
 END IF;
END $$;
CREATE TABLE public.profile_builder_jobs (
 user_id uuid NOT NULL, request_id uuid NOT NULL,
 source_key text NOT NULL CHECK(source_key ~ '^[a-f0-9]{64}$'),
 stage text NOT NULL CHECK(stage IN ('reading','identifying','ready','drafting','complete','needs_details','failed')),
 checkpoint jsonb NOT NULL CHECK(jsonb_typeof(checkpoint)='object' AND octet_length(checkpoint::text)<=2600000),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 lease_token uuid, lease_until timestamptz, call_started boolean NOT NULL DEFAULT false,
 quota_reserved boolean NOT NULL DEFAULT false,
 active_ms integer NOT NULL DEFAULT 0 CHECK(active_ms BETWEEN 0 AND 120000),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 PRIMARY KEY(user_id,request_id),
 FOREIGN KEY(user_id,request_id) REFERENCES public.profile_builder_requests(user_id,request_id) ON DELETE CASCADE,
 CHECK((lease_token IS NULL)=(lease_until IS NULL)),
 CHECK(NOT call_started OR lease_token IS NOT NULL)
);
CREATE INDEX profile_builder_jobs_source_owner ON public.profile_builder_jobs(user_id,source_key,expires_at);
ALTER TABLE public.profile_builder_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_builder_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.profile_builder_jobs TO service_role;
-- No client SELECT policy: raw indexed pages never leave the authenticated API.
CREATE FUNCTION public.profile_builder_job_json(p public.profile_builder_jobs) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('owner',p.user_id,'id',p.request_id,'stage',p.stage,
  'revision',p.revision,'leaseToken',p.lease_token,'quotaReserved',p.quota_reserved,
  'callIntents',r.call_intents,'activeMs',p.active_ms,'data',p.checkpoint,
  'leaseUntil',p.lease_until,'createdAt',p.created_at)
 FROM public.profile_builder_requests r WHERE r.user_id=p.user_id AND r.request_id=p.request_id
$$;
CREATE FUNCTION public.create_profile_builder_job(p_owner uuid,p_request uuid,p_hash text,p_source_key text,p_checkpoint jsonb,p_stage text,p_elapsed_ms integer) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed jsonb; j public.profile_builder_jobs;
BEGIN
 claimed:=public.claim_profile_builder_request(p_owner,p_request,p_hash);
 SELECT * INTO j FROM public.profile_builder_jobs WHERE user_id=p_owner AND request_id=p_request;
 IF FOUND THEN RETURN public.profile_builder_job_json(j); END IF;
 IF claimed->>'state'<>'claimed' THEN RAISE EXCEPTION 'This request is not a new source job'; END IF;
 IF p_stage NOT IN ('reading','identifying','ready','needs_details') OR p_elapsed_ms NOT BETWEEN 0 AND 120000 THEN RAISE EXCEPTION 'Invalid source job'; END IF;
 INSERT INTO public.profile_builder_jobs(user_id,request_id,source_key,stage,checkpoint,active_ms)
 VALUES(p_owner,p_request,p_source_key,p_stage,p_checkpoint,p_elapsed_ms) RETURNING * INTO j;
 RETURN public.profile_builder_job_json(j);
END $$;
CREATE FUNCTION public.read_profile_builder_job(p_owner uuid,p_request uuid) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.profile_builder_job_json(j) FROM public.profile_builder_jobs j WHERE user_id=p_owner AND request_id=p_request
$$;
CREATE FUNCTION public.cached_profile_builder_source(p_owner uuid,p_source_key text) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT checkpoint->'evidence' FROM public.profile_builder_jobs
 WHERE user_id=p_owner AND source_key=p_source_key AND expires_at>now()
 AND stage IN ('ready','drafting','complete') AND jsonb_typeof(checkpoint->'evidence')='object'
 ORDER BY created_at DESC LIMIT 1
$$;
CREATE FUNCTION public.acquire_profile_builder_job(p_owner uuid,p_request uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.profile_builder_jobs;
BEGIN
 SELECT * INTO STRICT j FROM public.profile_builder_jobs WHERE user_id=p_owner AND request_id=p_request FOR UPDATE;
 IF j.stage IN ('complete','failed','needs_details') THEN RETURN public.profile_builder_job_json(j); END IF;
 IF j.lease_until>now() THEN RETURN public.profile_builder_job_json(j)||jsonb_build_object('leaseToken',null); END IF;
 IF j.call_started OR j.expires_at<=now() OR j.active_ms>=120000 THEN
  -- An expired in-flight transport has unknown cost: never issue that call again.
  IF j.call_started THEN
   PERFORM public.record_profile_builder_usage(p_owner,p_request,jsonb_build_object('promptTokens',0,'completionTokens',0,'outcome','unknown_provider_cost'));
  END IF;
  UPDATE public.profile_builder_jobs SET stage='failed',lease_token=NULL,lease_until=NULL,call_started=false,
   checkpoint=jsonb_set(checkpoint,'{needs}','["This build expired or its last call could not be confirmed. Your saved profiles are unchanged."]'),revision=revision+1
   WHERE user_id=p_owner AND request_id=p_request RETURNING * INTO j;
  UPDATE public.profile_builder_requests SET state='failed',finished_at=now() WHERE user_id=p_owner AND request_id=p_request AND state='running';
  RETURN public.profile_builder_job_json(j);
 END IF;
 UPDATE public.profile_builder_jobs SET lease_token=gen_random_uuid(),lease_until=now()+interval '60 seconds'
 WHERE user_id=p_owner AND request_id=p_request RETURNING * INTO j;
 RETURN public.profile_builder_job_json(j);
END $$;
CREATE FUNCTION public.reserve_profile_builder_job(p_owner uuid,p_request uuid,p_token uuid,p_revision integer) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.profile_builder_jobs; q jsonb;
BEGIN
 SELECT * INTO STRICT j FROM public.profile_builder_jobs WHERE user_id=p_owner AND request_id=p_request FOR UPDATE;
 IF j.lease_token IS DISTINCT FROM p_token OR p_token IS NULL OR j.revision<>p_revision OR j.lease_until<=now() THEN RAISE EXCEPTION 'Source job lease changed'; END IF;
 IF j.quota_reserved THEN RETURN; END IF;
 q:=public.reserve_ai_request(p_owner,'profile_builder',10,3,10);
 IF NOT coalesce((q->>'allowed')::boolean,false) THEN RAISE EXCEPTION 'Profile Builder quota unavailable'; END IF;
 UPDATE public.profile_builder_jobs SET quota_reserved=true WHERE user_id=p_owner AND request_id=p_request;
END $$;
CREATE FUNCTION public.begin_profile_builder_job_call(p_owner uuid,p_request uuid,p_token uuid,p_revision integer) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.profile_builder_jobs;
BEGIN
 SELECT * INTO STRICT j FROM public.profile_builder_jobs WHERE user_id=p_owner AND request_id=p_request FOR UPDATE;
 IF j.lease_token IS DISTINCT FROM p_token OR p_token IS NULL OR j.revision<>p_revision OR j.lease_until<=now()
 OR j.call_started OR NOT j.quota_reserved OR j.active_ms>=120000 OR j.stage NOT IN ('reading','identifying','drafting') THEN RAISE EXCEPTION 'Source job cannot start another call'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ai_request_settings WHERE id AND enabled) THEN RAISE EXCEPTION 'AI requests are paused'; END IF;
 PERFORM public.record_profile_builder_call(p_owner,p_request);
 UPDATE public.profile_builder_jobs SET call_started=true WHERE user_id=p_owner AND request_id=p_request;
END $$;
CREATE FUNCTION public.commit_profile_builder_job(p_owner uuid,p_request uuid,p_token uuid,p_revision integer,p_stage text,p_checkpoint jsonb,p_elapsed_ms integer,p_proposal jsonb DEFAULT NULL) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.profile_builder_jobs;
BEGIN
 SELECT * INTO STRICT j FROM public.profile_builder_jobs WHERE user_id=p_owner AND request_id=p_request FOR UPDATE;
 IF j.lease_token IS DISTINCT FROM p_token OR p_token IS NULL OR j.revision<>p_revision OR j.call_started THEN RAISE EXCEPTION 'Source job checkpoint lease changed'; END IF;
 IF p_elapsed_ms<0 OR p_elapsed_ms>120000 OR p_stage NOT IN ('reading','identifying','ready','drafting','complete','needs_details','failed') THEN RAISE EXCEPTION 'Invalid source job checkpoint'; END IF;
 IF p_stage='complete' AND (p_proposal IS NULL OR p_proposal->>'origin'<>'source_backed_ai') THEN RAISE EXCEPTION 'A complete source job requires its checked proposal'; END IF;
 UPDATE public.profile_builder_jobs SET stage=p_stage,checkpoint=p_checkpoint,active_ms=least(120000,active_ms+p_elapsed_ms),
  revision=revision+1,lease_token=NULL,lease_until=NULL WHERE user_id=p_owner AND request_id=p_request RETURNING * INTO j;
 IF p_stage IN ('complete','failed') THEN
  UPDATE public.profile_builder_requests SET state=p_stage,result=CASE WHEN p_stage='complete' THEN p_proposal ELSE NULL END,finished_at=now()
  WHERE user_id=p_owner AND request_id=p_request AND state='running';
  IF NOT FOUND THEN RAISE EXCEPTION 'Source job receipt unavailable'; END IF;
 END IF;
 RETURN public.profile_builder_job_json(j);
END $$;
CREATE FUNCTION public.finish_profile_builder_job_call(p_owner uuid,p_request uuid,p_token uuid,p_revision integer,p_stage text,p_checkpoint jsonb,p_elapsed_ms integer,p_usage jsonb,p_proposal jsonb DEFAULT NULL) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.profile_builder_jobs;
BEGIN
 SELECT * INTO STRICT j FROM public.profile_builder_jobs WHERE user_id=p_owner AND request_id=p_request FOR UPDATE;
 IF j.lease_token IS DISTINCT FROM p_token OR p_token IS NULL OR j.revision<>p_revision OR NOT j.call_started THEN RAISE EXCEPTION 'Source call receipt lease changed'; END IF;
 PERFORM public.record_profile_builder_usage(p_owner,p_request,p_usage);
 UPDATE public.profile_builder_jobs SET call_started=false WHERE user_id=p_owner AND request_id=p_request;
 RETURN public.commit_profile_builder_job(p_owner,p_request,p_token,p_revision,p_stage,p_checkpoint,p_elapsed_ms,p_proposal);
END $$;
REVOKE ALL ON FUNCTION public.profile_builder_job_json(public.profile_builder_jobs),public.create_profile_builder_job(uuid,uuid,text,text,jsonb,text,integer),public.read_profile_builder_job(uuid,uuid),public.cached_profile_builder_source(uuid,text),public.acquire_profile_builder_job(uuid,uuid),public.reserve_profile_builder_job(uuid,uuid,uuid,integer),public.begin_profile_builder_job_call(uuid,uuid,uuid,integer),public.commit_profile_builder_job(uuid,uuid,uuid,integer,text,jsonb,integer,jsonb),public.finish_profile_builder_job_call(uuid,uuid,uuid,integer,text,jsonb,integer,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.profile_builder_job_json(public.profile_builder_jobs),public.create_profile_builder_job(uuid,uuid,text,text,jsonb,text,integer),public.read_profile_builder_job(uuid,uuid),public.cached_profile_builder_source(uuid,text),public.acquire_profile_builder_job(uuid,uuid),public.reserve_profile_builder_job(uuid,uuid,uuid,integer),public.begin_profile_builder_job_call(uuid,uuid,uuid,integer),public.commit_profile_builder_job(uuid,uuid,uuid,integer,text,jsonb,integer,jsonb),public.finish_profile_builder_job_call(uuid,uuid,uuid,integer,text,jsonb,integer,jsonb,jsonb) TO service_role;
COMMIT;
-- Rollback proposal (only after stopping new builds and retaining required private
-- records under the account retention policy): DROP the nine functions above, then
-- DROP TABLE public.profile_builder_jobs. Existing profiles/receipts remain valid.
-- This proposal deliberately does not modify generated types or applied migrations.
