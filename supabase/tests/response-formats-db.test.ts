// @vitest-environment node
import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {responseFixture,responseUser as user,responseOther as other} from './response-foundation-fixtures';
import {markResponse} from '../functions/_shared/response-marking';
let db:PGlite;let serial=0;
const id=()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`
 CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT current_setting('request.jwt.claim.sub',true)::uuid$$;
 CREATE TABLE exams(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE exam_questions(id uuid PRIMARY KEY,exam_id uuid REFERENCES exams,marks integer);
 CREATE TABLE exam_submissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exam_id uuid,student_id uuid,status text,
  submitted_at timestamptz,marking_token uuid,marking_started_at timestamptz,marking_error text,total_score numeric,total_marks integer,
  time_taken_seconds integer,time_remaining_seconds integer,is_late boolean,UNIQUE(exam_id,student_id));
 CREATE TABLE student_answers(exam_id uuid,question_id uuid,student_id uuid,answer_text text,answer_latex text,answer_format text,
  table_answers jsonb,score numeric,is_correct boolean,feedback text,submitted_at timestamptz,UNIQUE(question_id,student_id));
 CREATE TABLE practice_question_sets(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE practice_questions(id uuid PRIMARY KEY,set_id uuid REFERENCES practice_question_sets,marks integer);
 CREATE TABLE practice_question_answers(user_id uuid,set_id uuid,question_id uuid,answer_text text,score numeric,is_correct boolean,
  feedback text,submitted_at timestamptz,updated_at timestamptz,UNIQUE(user_id,question_id));
 CREATE TABLE practice_set_progress(user_id uuid,set_id uuid,questions_attempted integer,questions_correct integer,
  last_accessed_at timestamptz,updated_at timestamptz,UNIQUE(user_id,set_id));
 ALTER TABLE practice_question_answers ENABLE ROW LEVEL SECURITY;
 GRANT SELECT,INSERT,UPDATE,DELETE ON practice_question_answers TO authenticated;
 GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
 CREATE POLICY owner_answers ON practice_question_answers TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
 CREATE FUNCTION exam_access_info(p_exam_id uuid,p_user_id uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('hasAccess',exists(SELECT 1 FROM exams WHERE id=p_exam_id AND user_id=p_user_id))$$;
 INSERT INTO auth.users VALUES('${user}'),('${other}');
 SELECT set_config('request.jwt.claim.sub','${user}',false);
 `);
 const foundations=readFileSync('supabase/migrations/20260913090000_launch_foundations.sql','utf8');
 // Run the real pre-existing lock/claim/finalisation code, not a test stub.
 await db.exec(foundations.slice(foundations.indexOf('CREATE OR REPLACE FUNCTION public.guard_exam_answer_write'),foundations.indexOf('CREATE OR REPLACE FUNCTION public.save_exam_progress_secure')));
 await db.exec(readFileSync('docs/pending-migrations/20261001090000_response_foundation.sql','utf8'));
 await db.exec(readFileSync('docs/pending-migrations/20261001150000_response_formats.sql','utf8'));
});
afterAll(async()=>db?.close());
async function roleQuery(role:string,sql:string,args:any[]=[]){await db.exec(`SET ROLE ${role}`);try{return await db.query(sql,args);}finally{await db.exec('RESET ROLE');}}
async function rpc(name:string,args:any[]){const r=await roleQuery('service_role',`SELECT ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args);return (r.rows[0] as any).result;}
async function setup(source:'exam'|'practice'='practice',kind:Parameters<typeof responseFixture>[0]='choice'){
 const parent=id(),q=id(),c=id(),f=responseFixture(kind);f.envelope.questionId=q;
 await db.query(`INSERT INTO ${source==='exam'?'exams':'practice_question_sets'} VALUES($1,$2)`,[parent,user]);
 await db.query(`INSERT INTO ${source==='exam'?'exam_questions':'practice_questions'} VALUES($1,$2,2)`,[q,parent]);
 await db.query(`INSERT INTO question_response_contracts(id,${source==='exam'?'exam_question_id':'practice_question_id'},definition,marking_key) VALUES($1,$2,$3,$4)`,[c,q,JSON.stringify(f.definition),JSON.stringify(f.key)]);
 const save=(rev=0,envelope=f.envelope)=>rpc('save_question_response_draft',[c,user,JSON.stringify(envelope),rev,id()]);
 const result=await markResponse({questionId:q,marks:2,definition:f.definition,key:f.key,response:f.envelope},async()=>({units:[{unitId:'u1',score:1,feedback:'Partial.'}]}));
 return {...f,parent,q,c,save,result};
}
it.each(['anon','authenticated'])('keeps private results and all marking RPCs inaccessible to %s',async role=>{
 await expect(roleQuery(role,'SELECT * FROM question_response_results')).rejects.toThrow(/permission denied/);
 for(const sql of ['SELECT claim_exam_responses(NULL,NULL,0)','SELECT finish_exam_responses(NULL,NULL,NULL,NULL,false)','SELECT claim_practice_response(NULL,NULL,0)','SELECT finish_practice_response(NULL,NULL,NULL,NULL)','SELECT fail_practice_response(NULL,NULL,NULL)'])await expect(roleQuery(role,sql)).rejects.toThrow(/permission denied/);
});
it('blocks forged practice scores, clearing and rebinding while preserving the legacy write path',async()=>{
 const s=await setup();
 await expect(roleQuery('authenticated','INSERT INTO practice_question_answers(user_id,set_id,question_id,score) VALUES($1,$2,$3,2)',[user,s.parent,s.q])).rejects.toThrow(/row-level security/);
 await s.save();const claim=await rpc('claim_practice_response',[s.c,user,1]);await rpc('finish_practice_response',[s.c,user,claim.token,s.result]);
 await roleQuery('authenticated','UPDATE practice_question_answers SET score=0 WHERE question_id=$1',[s.q]);
 await roleQuery('authenticated','DELETE FROM practice_question_answers WHERE question_id=$1',[s.q]);
 expect(Number((await db.query('SELECT score FROM practice_question_answers WHERE question_id=$1',[s.q])).rows[0].score)).toBe(2);
 const legacy=id();await db.query('INSERT INTO practice_questions VALUES($1,$2,2)',[legacy,s.parent]);
 await roleQuery('authenticated','INSERT INTO practice_question_answers(user_id,set_id,question_id,score) VALUES($1,$2,$3,1)',[user,s.parent,legacy]);
 await expect(roleQuery('authenticated','UPDATE practice_question_answers SET question_id=$1 WHERE question_id=$2',[s.q,legacy])).rejects.toThrow();
 expect((await db.query('SELECT count(*)::int n FROM practice_question_answers WHERE set_id=$1',[s.parent])).rows[0].n).toBe(2);
});
it('claims the exact saved practice revision, serialises duplicate marking and locks late saves',async()=>{
 const s=await setup();await s.save();
 await expect(rpc('claim_practice_response',[s.c,other,1])).rejects.toThrow(/access denied/);
 await expect(rpc('claim_practice_response',[s.c,user,0])).rejects.toThrow(/revision/);
 const claim=await rpc('claim_practice_response',[s.c,user,1]);expect(claim.response).toEqual(s.envelope);
 expect((await rpc('claim_practice_response',[s.c,user,1])).state).toBe('busy');
 await expect(s.save(1)).rejects.toThrow(/locked/);
 await expect(rpc('finish_practice_response',[s.c,user,id(),s.result])).rejects.toThrow(/expired/);
});
it('failed practice marking creates no grade; a saved response can be retried and committed once',async()=>{
 const s=await setup();await s.save();const first=await rpc('claim_practice_response',[s.c,user,1]);
 await rpc('fail_practice_response',[s.c,user,first.token]);
 expect((await db.query('SELECT * FROM practice_question_answers WHERE question_id=$1',[s.q])).rows).toHaveLength(0);
 await s.save(1);const next=await rpc('claim_practice_response',[s.c,user,2]);
 await rpc('finish_practice_response',[s.c,user,next.token,s.result]);
 expect(await rpc('claim_practice_response',[s.c,user,2])).toEqual({state:'graded',result:s.result});
 expect((await db.query('SELECT count(*)::int n FROM practice_question_answers WHERE question_id=$1',[s.q])).rows[0].n).toBe(1);
 expect((await db.query('SELECT questions_attempted,questions_correct FROM practice_set_progress WHERE set_id=$1',[s.parent])).rows[0]).toEqual({questions_attempted:1,questions_correct:1});
 await expect(s.save(2)).rejects.toThrow(/marked/);
});
it('an expired practice lease cannot overwrite the replacement result',async()=>{
 const s=await setup();await s.save();const old=await rpc('claim_practice_response',[s.c,user,1]);
 await db.query("UPDATE question_response_results SET marking_started_at=now()-interval '6 minutes' WHERE contract_id=$1",[s.c]);
 const active=await rpc('claim_practice_response',[s.c,user,1]);expect(active.token).not.toBe(old.token);
 await rpc('fail_practice_response',[s.c,user,old.token]);
 await expect(rpc('finish_practice_response',[s.c,user,old.token,s.result])).rejects.toThrow(/expired/);
 await rpc('finish_practice_response',[s.c,user,active.token,s.result]);
});
it('rolls back practice result, score and progress together on a storage failure',async()=>{
 const s=await setup();await s.save();const claim=await rpc('claim_practice_response',[s.c,user,1]);
 await db.exec("ALTER TABLE practice_set_progress ADD CONSTRAINT test_failure CHECK(questions_attempted<0) NOT VALID");
 try{await expect(rpc('finish_practice_response',[s.c,user,claim.token,s.result])).rejects.toThrow();}finally{await db.exec('ALTER TABLE practice_set_progress DROP CONSTRAINT test_failure');}
 expect((await db.query('SELECT * FROM practice_question_answers WHERE question_id=$1',[s.q])).rows).toHaveLength(0);
 expect((await db.query('SELECT status,result FROM question_response_results WHERE contract_id=$1',[s.c])).rows[0]).toEqual({status:'marking',result:null});
});
it.each(['choice','grid','cloze','fields'] as const)('marks an exam %s as one existing answer row and one private result',async kind=>{
 const s=await setup('exam',kind);await s.save();
 const claim=await rpc('claim_exam_responses',[s.parent,user,42]);expect(claim.state).toBe('claimed');
 const before=(await db.query('SELECT score,answer_text FROM student_answers WHERE question_id=$1',[s.q])).rows[0];expect(before.score).toBeNull();expect(JSON.parse(before.answer_text as string)).toEqual(s.envelope);
 await expect(s.save(1)).rejects.toThrow(/locked/);
 const results=[{question_id:s.q,score:2,is_correct:true,feedback:'2/2',response_result:s.result}];
 expect(await rpc('finish_exam_responses',[s.parent,user,claim.token,results,false])).toEqual({totalScore:2,totalMarks:2});
 expect((await db.query('SELECT status,total_score FROM exam_submissions WHERE exam_id=$1',[s.parent])).rows[0]).toEqual({status:'graded',total_score:'2'});
 expect((await db.query('SELECT count(*)::int n FROM student_answers WHERE question_id=$1',[s.q])).rows[0].n).toBe(1);
 expect((await db.query('SELECT result FROM question_response_results WHERE contract_id=$1',[s.c])).rows[0].result).toEqual(s.result);
 expect((await rpc('claim_exam_responses',[s.parent,user,0])).state).toBe('graded');
});
it('rolls back native exam grades if the structured result is missing',async()=>{
 const s=await setup('exam');await s.save();const claim=await rpc('claim_exam_responses',[s.parent,user,1]);
 await expect(rpc('finish_exam_responses',[s.parent,user,claim.token,[{question_id:s.q,score:2,is_correct:true,feedback:'2/2'}],false])).rejects.toThrow(/Incomplete structured/);
 expect((await db.query('SELECT status,total_score FROM exam_submissions WHERE exam_id=$1',[s.parent])).rows[0]).toEqual({status:'marking',total_score:null});
 expect((await db.query('SELECT score FROM student_answers WHERE question_id=$1',[s.q])).rows[0].score).toBeNull();
 await rpc('fail_exam_marking',[s.parent,user,claim.token]);
 expect((await db.query('SELECT status FROM exam_submissions WHERE exam_id=$1',[s.parent])).rows[0].status).toBe('marking_failed');
});
it('preserves the frozen answer when reclaiming an expired exam marking lease',async()=>{
 const s=await setup('exam');await s.save();const first=await rpc('claim_exam_responses',[s.parent,user,1]);
 await db.query("UPDATE exam_submissions SET marking_started_at=now()-interval '6 minutes' WHERE exam_id=$1",[s.parent]);
 const second=await rpc('claim_exam_responses',[s.parent,user,1]);expect(second.token).not.toBe(first.token);
 expect(JSON.parse((await db.query('SELECT answer_text FROM student_answers WHERE question_id=$1',[s.q])).rows[0].answer_text as string)).toEqual(s.envelope);
});
