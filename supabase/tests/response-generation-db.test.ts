// @vitest-environment node
import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {responseFixture,responseUser as user,responseOther as other} from './response-foundation-fixtures';
let db:PGlite;let serial=100;const id=()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
const context={resolved_by:'server',response_formats:'interactive_v1'};
beforeAll(async()=>{
 db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE TABLE exams(id uuid PRIMARY KEY,user_id uuid,generation_context jsonb,status text);
 CREATE TABLE exam_question_drafts(id uuid PRIMARY KEY,exam_id uuid,question_number text,question_text text,marks integer,correct_answer text,diagram_config jsonb);
 CREATE TABLE exam_questions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exam_id uuid REFERENCES exams,question_number text,question_text text,marks integer,correct_answer text,diagram_config jsonb,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE practice_question_sets(id uuid PRIMARY KEY,user_id uuid,generation_context jsonb,extraction_status text,extraction_error text,total_questions_generated integer);
 CREATE TABLE practice_questions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),set_id uuid REFERENCES practice_question_sets,question_number text,question_text text,marks integer,correct_answer text,diagram_config jsonb,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE exam_submissions(exam_id uuid,student_id uuid,status text);
 CREATE TABLE student_answers(exam_id uuid,question_id uuid,student_id uuid);
 CREATE TABLE practice_question_answers(set_id uuid,question_id uuid,user_id uuid,score integer);
 CREATE FUNCTION exam_access_info(uuid,uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{"hasAccess":true}'::jsonb$$;
 INSERT INTO auth.users VALUES('${user}'),('${other}');`);
 await db.exec(readFileSync('docs/pending-migrations/20261001090000_response_foundation.sql','utf8'));
 await db.exec(readFileSync('docs/pending-migrations/20261003180000_response_generation.sql','utf8'));
});
afterAll(async()=>db?.close());
async function rpc(source:string,parent:string,rows:any[],owner=user,ctx:any=context,role='service_role'){
 await db.exec(`SET ROLE ${role}`);try {const result=await db.query('SELECT commit_generated_responses($1,$2,$3,$4,$5) AS result',[source,parent,owner,ctx,rows]);return (result.rows[0] as any).result;}finally{await db.exec('RESET ROLE');}
}
async function setup(source='practice'){
 const parent=id(),draft=id(),f=responseFixture('grid');f.definition.resourceIds=[];
 const q={question_number:'1(a)',question_text:'Tick the cells.',marks:2,correct_answer:null,diagram_config:null,[source==='exam'?'exam_id':'set_id']:parent};
 const sourceDraft={id:draft,question_text:q.question_text,marks:2,correct_answer:'original private key',diagram_config:null,options:null,table_data:null,question_type:null,topic_tag:null};
 if(source==='exam'){
 await db.query('INSERT INTO exams VALUES($1,$2,$3,$4)',[parent,user,context,'draft']);
 await db.query('INSERT INTO exam_question_drafts VALUES($1,$2,$3,$4,$5,$6,$7)',[draft,parent,'1(a)',q.question_text,2,sourceDraft.correct_answer,null]);
 await db.query('INSERT INTO question_response_generation_drafts(draft_id,source_snapshot,carrier) VALUES($1,$2,$3)',[draft,sourceDraft,{format:'examly_response_v1',original_answer:sourceDraft.correct_answer,definition:f.definition,key:f.key}]);
 }else await db.query('INSERT INTO practice_question_sets(id,user_id,generation_context,extraction_status) VALUES($1,$2,$3,$4)',[parent,user,context,'extracting']);
 return {parent,rows:[{question:q,response:{definition:f.definition,key:f.key},...(source==='exam'?{sourceDraft}:{})}]};
}
it.each(['anon','authenticated'])('forbids %s from calling the generation commit',async role=>{const s=await setup();await expect(rpc('practice',s.parent,s.rows,user,context,role)).rejects.toThrow('permission denied');});
it.each(['exam','practice'])('commits %s questions and private contracts together, preserves defaults and replays without new IDs',async source=>{
 const s=await setup(source);expect(await rpc(source,s.parent,s.rows)).toEqual({count:1,replayed:false});
 const table=source==='exam'?'exam_questions':'practice_questions',column=source==='exam'?'exam_id':'set_id';
 const rows=(await db.query(`SELECT * FROM ${table} WHERE ${column}=$1`,[s.parent])).rows;expect(rows).toHaveLength(1);expect(rows[0].correct_answer).toBeNull();expect(rows[0].created_at).toBeTruthy();
 const c=(await db.query(`SELECT * FROM question_response_contracts WHERE ${source==='exam'?'exam_question_id':'practice_question_id'}=$1`,[rows[0].id])).rows[0];expect(c.marking_key).toEqual(s.rows[0].response.key);
 expect(await rpc(source,s.parent,s.rows)).toEqual({count:1,replayed:true});expect((await db.query(`SELECT id FROM ${table} WHERE ${column}=$1`,[s.parent])).rows[0].id).toBe(rows[0].id);
});
it('rolls back the entire quiz if a later contract fails, including its completion status',async()=>{
 const s=await setup();const second=structuredClone(s.rows[0]);second.question.question_number='2';second.response.key.maxMarks=99;
 await expect(rpc('practice',s.parent,[...s.rows,second])).rejects.toThrow('Invalid response contract');
 expect((await db.query('SELECT * FROM practice_questions WHERE set_id=$1',[s.parent])).rows).toHaveLength(0);
 expect((await db.query('SELECT extraction_status FROM practice_question_sets WHERE id=$1',[s.parent])).rows[0].extraction_status).toBe('extracting');
});
it('refuses a foreign owner, changed snapshot and foreign parent without writing',async()=>{
 const s=await setup();await expect(rpc('practice',s.parent,s.rows,other)).rejects.toThrow('owner');await expect(rpc('practice',s.parent,s.rows,user,{})).rejects.toThrow('snapshot');
 const rows=structuredClone(s.rows);rows[0].question.set_id=id();await expect(rpc('practice',s.parent,rows)).rejects.toThrow('parent');
});
it('refuses duplicate numbers, unknown columns and public private-key remnants',async()=>{
 for(const defect of ['duplicate','column','key']){const s=await setup();if(defect==='duplicate')s.rows.push(structuredClone(s.rows[0]));if(defect==='column')(s.rows[0].question as any).not_a_column=true;if(defect==='key')s.rows[0].question.correct_answer='private' as any;await expect(rpc('practice',s.parent,s.rows)).rejects.toThrow();}
});
it('rejects changed exam drafts and mismatched marks before publication',async()=>{
 const s=await setup('exam');await db.query('UPDATE exam_question_drafts SET question_text=$1 WHERE exam_id=$2',['A revised task.',s.parent]);await expect(rpc('exam',s.parent,s.rows)).rejects.toThrow('Source draft changed');
 const t=await setup('exam');t.rows[0].question.marks=3;await expect(rpc('exam',t.parent,t.rows)).rejects.toThrow('marks changed');
});
it('will not replace a started exam or a quiz with an answer',async()=>{
 const e=await setup('exam');await db.query('INSERT INTO exam_submissions VALUES($1,$2,$3)',[e.parent,user,'in_progress']);await expect(rpc('exam',e.parent,e.rows)).rejects.toThrow('attempted exam');
 const p=await setup();await db.query('INSERT INTO practice_question_answers VALUES($1,$2,$3,NULL)',[p.parent,id(),user]);await expect(rpc('practice',p.parent,p.rows)).rejects.toThrow('attempted quiz');
});

it('preserves an unsubmitted structured exam draft even without a legacy answer row',async()=>{
 const s=await setup('exam'),q=id(),c=id();await db.query('INSERT INTO exam_questions(id,exam_id,marks) VALUES($1,$2,2)',[q,s.parent]);
 await db.query('INSERT INTO question_response_contracts(id,exam_question_id,definition,marking_key) VALUES($1,$2,$3,$4)',[c,q,s.rows[0].response.definition,s.rows[0].response.key]);
 await db.query('INSERT INTO question_response_drafts(contract_id,user_id,response,revision,last_request_id) VALUES($1,$2,$3,1,$4)',[c,user,{version:1},id()]);
 await expect(rpc('exam',s.parent,s.rows)).rejects.toThrow('attempted exam');
 expect((await db.query('SELECT * FROM question_response_drafts WHERE contract_id=$1',[c])).rows).toHaveLength(1);
});

it.each(['anon','authenticated'])('keeps generated draft keys inaccessible to %s',async role=>{
 await db.exec(`SET ROLE ${role}`);try{await expect(db.query('SELECT carrier FROM question_response_generation_drafts')).rejects.toThrow('permission denied');}finally{await db.exec('RESET ROLE');}
});
it('rejects a missing private candidate rather than publishing an unbound input',async()=>{
 const s=await setup('exam');await db.query('DELETE FROM question_response_generation_drafts WHERE draft_id=$1',[s.rows[0].sourceDraft!.id]);await expect(rpc('exam',s.parent,s.rows)).rejects.toThrow('Private response draft');
});
