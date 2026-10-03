import {readPracticeResponses} from '../_shared/response-service.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleResponseDraft } from '../_shared/response-foundation.ts';
import { ExamRequestError } from '../_shared/exam-access.ts';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response(null, { headers });
    if (req.method !== 'POST')
        return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers });
    try {
        const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
        const { data: { user }, error } = await client.auth.getUser(token);
        if (error || !user)
            throw new ExamRequestError(401, 'Authentication required');
        const text = await req.text();
        if (new TextEncoder().encode(text).length > 131072)
            throw new ExamRequestError(413, 'Response too large');
        let body;
        try {
            body = JSON.parse(text);
        }
        catch {
            throw new ExamRequestError(400, 'Invalid JSON');
        }
        const result = body?.action === 'questions' && body?.source === 'practice'
            ? await readPracticeResponses(client, user.id, body)
            : await handleResponseDraft(client, user.id, body);
        return new Response(JSON.stringify(result), { headers });
    }
    catch (e) {
        return new Response(JSON.stringify({ error: e instanceof ExamRequestError ? e.message : 'Response could not be processed' }), { status: e instanceof ExamRequestError ? e.status : 503, headers });
    }
});
