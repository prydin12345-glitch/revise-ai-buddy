// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { mayReadSolutions, studentQuestion, requireExamAccess } from '../functions/_shared/exam-access';
import { validatedGrade } from '../functions/_shared/marking-result';
import { enforceRateLimit, checkGenerationRateLimit } from '../functions/_shared/rate-limiter';

const tutor='00000000-0000-0000-0000-000000000001';
const student='00000000-0000-0000-0000-000000000002';
const stranger='00000000-0000-0000-0000-000000000003';
const exam='10000000-0000-0000-0000-000000000001';
const q1='20000000-0000-0000-0000-000000000001';
const q2='20000000-0000-0000-0000-000000000002';
let db:PGlite;
const sql=(s:string)=>db.exec(s);
async function asUser(id:string,role='authenticated') {
  await sql(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id}',false); SELECT set_config('request.jwt.claim.role','${role}',false); SET ROLE ${role};`);
}
async function rpc(name:string,args:unknown[]) {
  const params=args.map((_,i)=>`$${i+1}`).join(',');
  return (await db.query<{result:any}>(`SELECT public.${name}(${params}) AS result`,args)).rows[0].result;
}
beforeAll(async()=>{
  db=new PGlite();
  await sql(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated,service_role;
    CREATE TABLE public.exams(id uuid PRIMARY KEY,user_id uuid,assigned_by uuid,grade_released boolean DEFAULT false);
    CREATE TABLE public.exam_assignments(id uuid DEFAULT gen_random_uuid(),exam_id uuid,assignment_type text,target_id uuid,
      assigned_by uuid,is_active boolean DEFAULT true,is_grades_released boolean DEFAULT false,deadline timestamptz,release_date timestamptz);
    CREATE TABLE public.student_groups(id uuid PRIMARY KEY,tutor_id uuid,is_active boolean DEFAULT true);
    CREATE TABLE public.group_members(group_id uuid,student_id uuid,is_active boolean DEFAULT true);
    CREATE TABLE public.exam_questions(id uuid PRIMARY KEY,exam_id uuid,question_number text,marks integer,correct_answer text);
    CREATE TABLE public.exam_submissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exam_id uuid,student_id uuid,
      status text,submitted_at timestamptz DEFAULT now(),time_taken_seconds integer,total_score numeric,total_marks integer,
      time_remaining_seconds integer,last_accessed_at timestamptz,exam_started_at timestamptz,is_late boolean,
      UNIQUE(exam_id,student_id));
    CREATE TABLE public.student_answers(id uuid DEFAULT gen_random_uuid(),exam_id uuid,student_id uuid,question_id uuid,
      answer_text text,answer_latex text,answer_format text,table_answers jsonb,score numeric,feedback text,is_correct boolean);
    CREATE TABLE public.ai_tutor_rate_limits(user_id uuid,date date,message_count integer);
    ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY existing_questions ON public.exam_questions FOR ALL TO authenticated USING(true) WITH CHECK(true);
    CREATE POLICY existing_answers ON public.student_answers FOR ALL TO authenticated USING(student_id=auth.uid()) WITH CHECK(student_id=auth.uid());
    CREATE POLICY existing_submissions ON public.exam_submissions FOR ALL TO authenticated USING(student_id=auth.uid()) WITH CHECK(student_id=auth.uid());
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
    INSERT INTO auth.users VALUES('${tutor}'),('${student}'),('${stranger}');
    INSERT INTO public.exams(id,user_id) VALUES('${exam}','${tutor}');
    INSERT INTO public.exam_assignments(exam_id,assignment_type,target_id,assigned_by) VALUES('${exam}','individual','${student}','${tutor}');
    INSERT INTO public.exam_questions VALUES('${q1}','${exam}','1',2,'SECRET_A'),('${q2}','${exam}','2',3,'SECRET_B');
  `);
  await sql(readFileSync(new URL('../migrations/20260913090000_launch_foundations.sql',import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db?.close();});

describe('database access and marking',()=>{
  it('blocks direct answer keys before completion even with a permissive existing policy',async()=>{
    await asUser(student);
    expect((await db.query('SELECT * FROM exam_questions')).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM exam_question_metadata')).rows).toHaveLength(2);
    await expect(sql(`INSERT INTO exam_submissions(exam_id,student_id,status) VALUES('${exam}','${student}','graded')`)).rejects.toThrow(/permission denied/);
    await expect(rpc('reserve_ai_request',[student,'x',100,100,10])).rejects.toThrow(/permission denied/);
    await asUser(stranger);
    expect((await db.query('SELECT * FROM exam_question_metadata')).rows).toHaveLength(0);
    expect((await rpc('exam_access_info',[exam,student])).hasAccess).toBe(false);
  });
  it('serializes claims, blocks late saves and rolls back incomplete grading',async()=>{
    await asUser(student,'service_role');
    await rpc('save_exam_progress_secure',[exam,student,600]);
    await sql(`INSERT INTO student_answers(exam_id,student_id,question_id,answer_text) VALUES('${exam}','${student}','${q1}','my answer');`);
    const claim=await rpc('claim_exam_marking',[exam,student,42]);
    expect(claim.state).toBe('claimed');
    expect((await rpc('claim_exam_marking',[exam,student,42])).state).toBe('busy');
    await expect(sql(`UPDATE student_answers SET answer_text='changed' WHERE question_id='${q1}'`)).rejects.toThrow(/locked/);
    await rpc('save_exam_progress_secure',[exam,student,500]);
    expect((await db.query<{status:string}>('SELECT status FROM exam_submissions')).rows[0].status).toBe('marking');
    await expect(rpc('finish_exam_marking',[exam,student,claim.token,JSON.stringify([{question_id:q1,score:2,feedback:'ok',is_correct:true}]),false])).rejects.toThrow(/Incomplete/);
    expect((await db.query<{score:number|null}>('SELECT score FROM student_answers')).rows[0].score).toBeNull();
    await rpc('fail_exam_marking',[exam,student,claim.token]);
    const failed=(await db.query<{status:string;total_score:number|null}>('SELECT status,total_score FROM exam_submissions')).rows[0];
    expect(failed).toEqual({status:'marking_failed',total_score:null});
    // A retry can edit its saved answer, then claim and finish exactly once.
    await sql(`UPDATE student_answers SET answer_text='retry answer' WHERE question_id='${q1}'`);
    const retry=await rpc('claim_exam_marking',[exam,student,42]);
    await expect(rpc('finish_exam_marking',[exam,student,claim.token,'[]',false])).rejects.toThrow(/expired/);
    const result=await rpc('finish_exam_marking',[exam,student,retry.token,JSON.stringify([
      {question_id:q1,score:2,feedback:'ok',is_correct:true},{question_id:q2,score:0,feedback:'No answer provided',is_correct:false},
    ]),false]);
    expect(result).toEqual({totalScore:2,totalMarks:5});
    expect((await rpc('claim_exam_marking',[exam,student,42])).state).toBe('graded');
    await rpc('save_exam_progress_secure',[exam,student,99]);
    expect((await db.query<{status:string}>('SELECT status FROM exam_submissions')).rows[0].status).toBe('graded');
  });
  it('keeps completed grades/solutions hidden until tutor release',async()=>{
    await asUser(student);
    expect((await db.query('SELECT * FROM exam_questions')).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM exam_submissions')).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM student_answers')).rows).toHaveLength(0);
    expect((await db.query<{status:string}>('SELECT status FROM exam_submission_metadata')).rows[0].status).toBe('graded');
    await asUser(tutor,'service_role');
    await sql(`UPDATE exam_assignments SET is_grades_released=true WHERE exam_id='${exam}'`);
    await asUser(student);
    expect((await db.query('SELECT * FROM exam_questions')).rows).toHaveLength(2);
    expect((await db.query('SELECT * FROM student_answers')).rows).toHaveLength(1);
    await asUser(stranger);
    expect((await db.query('SELECT * FROM exam_questions')).rows).toHaveLength(0);
  });
});

describe('quota enforcement',()=>{
  it('records reservations before work, blocks overflow and honours the global switch',async()=>{
    await asUser(student,'service_role');
    expect((await rpc('reserve_ai_request',[student,'test',2,2,10])).allowed).toBe(true);
    expect((await rpc('reserve_ai_request',[student,'test',2,2,10])).allowed).toBe(true);
    expect((await rpc('reserve_ai_request',[student,'test',2,2,10])).allowed).toBe(false);
    await sql('UPDATE ai_request_settings SET enabled=false');
    expect((await rpc('reserve_ai_request',[student,'another',100,100,10])).reason).toBe('disabled');
    await sql('UPDATE ai_request_settings SET enabled=true,global_daily_limit=2');
    expect((await rpc('reserve_ai_request',[stranger,'another',100,100,10])).reason).toBe('global');
  });
  it('fails closed on database errors and shares generation aliases',async()=>{
    expect((await enforceRateLimit({rpc:async()=>({error:{code:'down'}})},student,'x')).allowed).toBe(false);
    expect((await enforceRateLimit({rpc:async()=>{throw new Error('down');}},student,'x')).status).toBe(503);
    let feature='';
    await checkGenerationRateLimit({rpc:async(_name:string,args:any)=>{feature=args.p_feature;return {data:{allowed:true}};}},student,'generate-practice-questions');
    expect(feature).toBe('practice_generation');
  });
});

describe('safe payloads and grade validation',()=>{
  it('does not treat preview or an in-progress submission as permission',()=>{
    const access={hasAccess:true,isOwner:false,isManager:false,isAssigned:true,gradesReleased:true,deadline:null};
    expect(mayReadSolutions(access,'in_progress')).toBe(false);
    expect(mayReadSolutions(access,'marking_failed')).toBe(false);
    expect(mayReadSolutions({...access,gradesReleased:false},'graded')).toBe(false);
    expect(mayReadSolutions(access,'graded')).toBe(true);
    expect(studentQuestion({id:q1,question_text:'Work it out',correct_answer:'secret',
      options:[{text:'A',isCorrect:true}],diagram_config:{title:'diagram',answerKey:{a:1}},
      table_data:JSON.stringify({headers:['X'],correctAnswers:{a:1}}),private_future_field:'secret',
    })).toEqual({id:q1,question_text:'Work it out',options:[{text:'A'}],diagram_config:{title:'diagram'},table_data:'{"headers":["X"]}'});
  });
  it('rejects invalid, partial or non-finite model results instead of inventing zeros',()=>{
    for(const value of [null,{}, {score:null}, {score:NaN,feedback:'x',isCorrect:false},
      {score:9,feedback:'x',isCorrect:true},{score:0,feedback:'',isCorrect:false}])expect(()=>validatedGrade(value,5)).toThrow();
    expect(validatedGrade({score:0,feedback:'Incorrect answer',isCorrect:true},5).isCorrect).toBe(false);
  });
  it('fails closed when access checks cannot run',async()=>{
    await expect(requireExamAccess({rpc:async()=>({error:{}})},exam,student)).rejects.toThrow(/could not be verified/);
    await expect(requireExamAccess({rpc:async()=>({data:{hasAccess:false}})},exam,student)).rejects.toThrow(/do not have access/);
  });
});
