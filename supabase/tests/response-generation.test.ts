// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {generateResponseFormats,generatedResponse,legacyResponseCandidate,responseWritePayload,responseProposalCaller,commitGeneratedResponses} from '../functions/_shared/response-generation';
import {responseFormatsEnabled} from '../functions/_shared/response-format-policy';
import {responseFixture} from './response-foundation-fixtures';
import {markResponse} from '../functions/_shared/response-marking';
import {AiCallBudget} from '../functions/_shared/ai-call-budget';
const context={context_version:2,resolved_by:'server',profile_id:'p',response_formats:'interactive_v1',subject_name:'Biology',educational_tier:'GCSE',exam_board:'AQA',assessment_tier:'higher',course_id:'aqa_gcse_biology',paper_id:'paper_1',paper_contract:{mode:'short_practice'}};
const question={id:'q',question_number:'1(a)',question_type:'short_answer',question_text:'State which substances are polymers.',marks:2,correct_answer:'Glycogen and DNA.',diagram_config:null,options:null,topic_tag:'Cell biology'};
function proposal(kind:any){const f=responseFixture(kind);f.definition.resourceIds=[];return {definition:f.definition,key:f.key};}
it('requires an explicit protected opt-in and leaves old attempts untouched',async()=>{
 const call=vi.fn();expect((await generateResponseFormats([question],{},call)).rows).toEqual([question]);expect(call).not.toHaveBeenCalled();
 for(const patch of [{resolved_by:'client'},{profile_id:null},{context_version:1},{paper_contract:{mode:'custom'}},{response_formats:'v99'}])expect(()=>responseFormatsEnabled({...context,...patch})).toThrow();
});
it.each(['choice','grid','cloze','fields'] as const)('accepts %s, preserves original task/marks, hides keys and marks one aggregate question',async kind=>{
 const p=proposal(kind),call=vi.fn(async()=>p);const r=await generateResponseFormats([question],context,call);expect(call).toHaveBeenCalledTimes(1);
 const row=r.rows[0],carrier=generatedResponse(row)!;expect(row.question_text).toBe(question.question_text);expect(row.marks).toBe(2);expect(legacyResponseCandidate(row)).toEqual(question);
 const payload=responseWritePayload(row);expect(payload.question.correct_answer).toBeNull();expect(payload.question.options).toBeNull();expect(payload.response?.key).toEqual(p.key);expect(JSON.stringify(payload.question)).not.toContain('expectedIds');
 const f=responseFixture(kind);f.envelope.questionId='q';const marked=await markResponse({questionId:'q',marks:2,definition:carrier.definition,key:carrier.key,response:f.envelope},vi.fn());expect(marked.score).toBe(2);expect(marked.maxMarks).toBe(2);
});
it('converts all fifteen OCR-style MCQs losslessly with zero extra model calls',async()=>{
 const rows=Array.from({length:15},(_,i)=>({...question,question_number:String(i+1),marks:1,question_type:'mcq',question_text:'Which statement could explain the need for ATP?',options:['Osmosis','Active transport','Diffusion','Facilitated diffusion'],correct_answer:'B'}));
 const call=vi.fn(),result=await generateResponseFormats(rows,context,call);expect(call).not.toHaveBeenCalled();expect(result.rows).toHaveLength(15);
 for(const row of result.rows){const c=generatedResponse(row)!;expect(c.definition.kind).toBe('choice');expect((c.definition as any).maxSelections).toBe(1);expect(c.key.units[0].rule).toEqual({kind:'exact_set',expectedIds:['o1']});expect(legacyResponseCandidate(row)).toEqual(rows.find(q=>q.question_number===row.question_number));}
});
it('keeps essays, graphs, specialised diagrams, shared-passage and high-mark tasks on the existing path',async()=>{
 const rows=[{...question,marks:6},{...question,question_type:'long_form'},{...question,diagram_config:{type:'line_chart'}},{...question,question_text:'State the result from the previous part.'},{...question,question_latex:'x'}];
 const call=vi.fn();expect((await generateResponseFormats(rows,context,call)).rows).toEqual(rows);expect(call).not.toHaveBeenCalled();
});
it('limits adaptation to three eligible parts and records explicit suitability skips',async()=>{
 const call=vi.fn(async()=>({skip:'Needs unrestricted written reasoning.'}));const rows=Array.from({length:8},(_,i)=>({...question,question_number:String(i+1)}));
 const r=await generateResponseFormats(rows,context,call);expect(call).toHaveBeenCalledTimes(3);expect(r.rows).toEqual(rows);expect(r.report).toHaveLength(3);
});
it('repairs a malformed proposal once without changing the question or calling indefinitely',async()=>{
 const p=proposal('grid'),bad={...p,key:{...p.key,maxMarks:9}};const call=vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(p);
 const r=await generateResponseFormats([question],context,call);expect(call).toHaveBeenCalledTimes(2);expect(call.mock.calls[1][0]).toContain('Previous proposal was rejected');expect(generatedResponse(r.rows[0])).not.toBeNull();
 const invalid=vi.fn(async()=>bad);await expect(generateResponseFormats([question],context,invalid)).rejects.toThrow('No malformed input');expect(invalid).toHaveBeenCalledTimes(2);
});
it.each(['marks','private','reasoning','scope','resource','clozeLeak','optional'])('refuses the %s defect before persistence',async defect=>{
 const p:any=proposal(['clozeLeak','optional'].includes(defect)?'cloze':'grid');let row=question;
 if(defect==='optional')p.definition.fields[0].required=false;
 if(defect==='marks')p.key.units[0].marks=10;
 if(defect==='private')p.definition.answer='secret';
 if(defect==='reasoning')row={...question,question_text:'Explain why cells require glucose.'};
 if(defect==='scope')p.definition.rows[0].label='Calvin cycle';
 if(defect==='resource')p.definition.resourceIds=['missing'];
 if(defect==='clozeLeak')p.definition.segments[0].text='The answer is glucose. Tube X contains ';
 await expect(generateResponseFormats([row],context,async()=>p)).rejects.toThrow();
});
it('preserves shared table data and units exactly once and refuses invented resource IDs',async()=>{
 const row={...question,diagram_config:{type:'data_table',headers:['Tube','Time'],units:['','s'],rows:[['X',20],['Y',30]],caption:'Results'}};
 const p=proposal('fields');p.definition.resourceIds=['data'];const r=await generateResponseFormats([row],context,async()=>p);
 const payload=responseWritePayload(r.rows[0]);expect(payload.question.diagram_config.resources).toEqual([{id:'data',kind:'table',title:'Results',columns:['Tube','Time (s)'],rows:[['X','20'],['Y','30']]}]);expect(payload.question.table_data).toBeUndefined();
});
it('counts transport failures and truncation, uses a bounded token limit, and refuses an exhausted budget',async()=>{
 const budget=new AiCallBudget({maxCalls:2,maxMs:10000});const fetcher=vi.fn(async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"definition":'}}],usage:{prompt_tokens:10,completion_tokens:5}})));
 const call=responseProposalCaller('test',budget,fetcher as any);await expect(call('test')).rejects.toThrow('incomplete');expect(budget.calls).toBe(1);expect(budget.completionTokens).toBe(5);
 expect(JSON.parse(fetcher.mock.calls[0][1].body).max_tokens).toBe(5000);
 await expect(call('test')).rejects.toThrow();await expect(call('test')).rejects.toThrow('budget');expect(fetcher).toHaveBeenCalledTimes(2);
 const b=new AiCallBudget({maxCalls:1,maxMs:1000});await expect(responseProposalCaller('test',b,async()=>{throw new Error('offline');})('test')).rejects.toThrow('offline');expect(b.failures).toBe(1);
});
it('refuses persistence errors and unconfirmed writes rather than reporting ready',async()=>{
 for(const result of [{error:{message:'missing migration'}},{data:null},{data:{count:0}}])await expect(commitGeneratedResponses({rpc:async()=>result},'practice','set','owner',context,[question])).rejects.toThrow('not committed');
});

it.each([{question_text:'Explain why cells require glucose.'},{question_text:'Calculate the mean.',correct_answer:'Award one method mark for working and one for the final value.'}])('keeps written reasoning/method credit out of final-number-only inputs: %j',async patch=>{
 const p=proposal('fields');await expect(generateResponseFormats([{...question,...patch}],context,async()=>p)).rejects.toThrow('written field with a rubric');
});
