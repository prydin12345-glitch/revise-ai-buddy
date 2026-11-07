CREATE OR REPLACE FUNCTION public.reserve_profile_builder_job(p_owner uuid, p_request uuid, p_token uuid, p_revision integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE j public.profile_builder_jobs; q jsonb; tester boolean;
BEGIN
 SELECT * INTO STRICT j FROM public.profile_builder_jobs WHERE user_id=p_owner AND request_id=p_request FOR UPDATE;
 IF j.lease_token IS DISTINCT FROM p_token OR p_token IS NULL OR j.revision<>p_revision OR j.lease_until<=now() THEN RAISE EXCEPTION 'Source job lease changed'; END IF;
 IF j.quota_reserved THEN RETURN; END IF;
 -- Temporary testing exemption for the owner's test account; everyone else keeps 10/day, 3 per 10 minutes.
 tester := p_owner = '9160693a-bcb8-4bc6-9e10-d587cae18db0'::uuid;
 q:=public.reserve_ai_request(p_owner,'profile_builder',CASE WHEN tester THEN 1000 ELSE 10 END,CASE WHEN tester THEN 1000 ELSE 3 END,10);
 IF NOT coalesce((q->>'allowed')::boolean,false) THEN RAISE EXCEPTION 'Profile Builder quota unavailable'; END IF;
 UPDATE public.profile_builder_jobs SET quota_reserved=true WHERE user_id=p_owner AND request_id=p_request;
END $function$;