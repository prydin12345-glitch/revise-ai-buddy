import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireExamAccess, ExamRequestError } from '../_shared/exam-access.ts';
const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
  try {
    const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'') ?? '';
    const {data:{user},error}=await client.auth.getUser(token);
    if(error || !user)throw new ExamRequestError(401,'Authentication required');
    const {examId,timeRemainingSeconds}=await req.json();
    await requireExamAccess(client,examId,user.id);
    if(timeRemainingSeconds!=null && (!Number.isInteger(timeRemainingSeconds) || timeRemainingSeconds<0 || timeRemainingSeconds>604800))
      throw new ExamRequestError(400,'Invalid remaining time');
    const {error:saveError}=await client.rpc('save_exam_progress_secure',{
      p_exam_id:examId,p_user_id:user.id,p_remaining:timeRemainingSeconds ?? null,
    });
    if(saveError)throw new Error('Progress could not be saved');
    return new Response(JSON.stringify({success:true}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
  } catch(error) {
    return new Response(JSON.stringify({error:error instanceof Error ? error.message : 'Save failed'}),{
      status:error instanceof ExamRequestError ? error.status : 503,headers:{...corsHeaders,'Content-Type':'application/json'},
    });
  }
});
