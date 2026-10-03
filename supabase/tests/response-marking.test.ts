// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {markResponse,parseResponseResult,emptyResponse} from '../functions/_shared/response-marking';
import {parseResponseDefinition,parseResponseEnvelope,responseCompleteness} from '../functions/_shared/response-contract';
import {responseResources} from '../functions/_shared/response-resources';
import {responseRubricMarker} from '../functions/_shared/response-rubric';
import {responseFixture,responseQuestion as id} from './response-foundation-fixtures';
const input=(f= responseFixture())=>({questionId:id,marks:2,definition:f.definition,key:f.key,response:f.envelope});
describe('shared marking: exact questions and rubrics',()=>{
 it.each(['choice','grid','cloze','fields'] as const)('marks %s without a model and preserves its maximum',async kind=>{
  const f=responseFixture(kind),ai=vi.fn();const result=await markResponse(input(f),ai);
  expect(result.score).toBe(2);expect(result.units).toHaveLength(1);expect(result.isCorrect).toBe(true);expect(ai).not.toHaveBeenCalled();expect(parseResponseResult(result,f.definition,f.key)).toEqual(result);
 });
 it('rejects ticking every option and invented IDs before any marking',async()=>{
  const f=responseFixture(), ai=vi.fn();(f.envelope as any).value.selectedIds=['a','b','c'];
  await expect(markResponse(input(f),ai)).rejects.toThrow();(f.envelope as any).value.selectedIds=['a','private'];
  await expect(markResponse(input(f),ai)).rejects.toThrow();expect(ai).not.toHaveBeenCalled();
 });
 it('checks whole row sets, awards partial question credit and distinguishes untouched from explicit none',async()=>{
  const f:any=responseFixture('grid');f.definition.rows.push({id:'sugar',label:'Is a sugar'});
  f.key.units=[{...f.key.units[0],marks:1},{id:'u2',targetIds:['sugar'],marks:1,rule:{kind:'exact_set',expectedIds:[]}}];
  expect((await markResponse(input(f),vi.fn())).score).toBe(1);
  f.envelope.value.rows.sugar=[];expect((await markResponse(input(f),vi.fn())).score).toBe(2);
  f.envelope.value.rows.polymer=['glycogen','sucrose','dna'];expect((await markResponse(input(f),vi.fn())).score).toBe(1);
 });
 it('matches words exactly after case/whitespace normalization, not by substring',async()=>{
  const f:any=responseFixture('cloze');f.envelope.value.fields.tube_x='  GLUCOSE  ';
  expect((await markResponse(input(f),vi.fn())).score).toBe(2);
  f.envelope.value.fields.tube_x='not glucose';expect((await markResponse(input(f),vi.fn())).score).toBe(0);
 });
 it('compares dropdown IDs exactly even when text matching is case-insensitive',async()=>{
  const f:any=responseFixture('cloze');f.definition.fields[0]={...f.definition.fields[0],input:'select',options:[{id:'a',label:'Glucose'},{id:'A',label:'Starch'}]};f.key.units[0].rule.accepted=['a'];f.envelope.value.fields.tube_x='A';
  expect((await markResponse(input(f),vi.fn())).score).toBe(0);
 });
 it('accepts numeric zero but never converts a blank or incomplete exponent to zero',async()=>{
  const f:any=responseFixture('fields');for(const [value,score] of [['0',2],['',0],['-',0],['1e-',0],['0.1',2],['0.2',0]]){
   f.envelope.value.fields.tube_x=value;expect((await markResponse(input(f),vi.fn())).score).toBe(score);
  }
 });
 it('allows typing a negative exponent without accepting nonfinite or arbitrary text',()=>{
  const f:any=responseFixture('fields');for(const value of ['-','-.','-.5','1e','1e-','1e-2'])expect(()=>parseResponseEnvelope({...f.envelope,value:{fields:{tube_x:value}}},f.definition,id)).not.toThrow();
  for(const value of ['Infinity','NaN','1e999','0x10','hello'])expect(()=>parseResponseEnvelope({...f.envelope,value:{fields:{tube_x:value}}},f.definition,id)).toThrow();
  expect(responseCompleteness(f.definition,{...f.envelope,value:{fields:{tube_x:'-'}}})).toBe('partial');
 });
 it('does not mark a completely unanswered rubric with a model',async()=>{
  const f=responseFixture('text'),ai=vi.fn();const r=await markResponse({...input(f),response:emptyResponse(f.definition,id)},ai);expect(r.score).toBe(0);expect(ai).not.toHaveBeenCalled();
 });
 it('sends related written fields together once and combines partial units exactly',async()=>{
  const f:any=responseFixture('fields');f.definition.fields=[{id:'x',label:'Tube X',required:true,input:'text'},{id:'y',label:'Tube Y',required:true,input:'text'}];
  f.key.units=['x','y'].map((target,i)=>({id:'u'+i,targetIds:[target],marks:1,rule:{kind:'rubric',guidance:'Explain.'}}));f.envelope.value.fields={x:'Explanation X',y:'Explanation Y'};
  const ai=vi.fn(async()=>({units:[{unitId:'u0',score:1,feedback:'Credited.'},{unitId:'u1',score:0,feedback:'No supporting reason.'}]}));
  expect((await markResponse(input(f),ai)).score).toBe(1);expect(ai).toHaveBeenCalledTimes(1);expect(ai.mock.calls[0][0]).toHaveLength(2);
 });
 it.each([{units:[]},{units:[{unitId:'u1',score:3,feedback:'Over cap'}]},{units:[{unitId:'invented',score:1,feedback:'Wrong ID'}]},{units:[{unitId:'u1',score:0,feedback:''}]},{units:[{unitId:'u1',score:'1',feedback:'Wrong type'}]}])('rejects a malformed model result instead of fabricating a zero: %j',async raw=>{
  await expect(markResponse(input(responseFixture('text')),async()=>raw)).rejects.toThrow();
 });
 it('rejects corrupt stored unit totals',async()=>{
  const f=responseFixture();const r=await markResponse(input(f),vi.fn());r.units[0].score=0;expect(()=>parseResponseResult(r,f.definition,f.key)).toThrow('add up');
 });
 it('rejects truncated, missing or non-JSON provider tool responses',async()=>{
  for(const body of [{choices:[{finish_reason:'length'}]}, {choices:[]}, {choices:[{message:{tool_calls:[{function:{name:'grade_response_units',arguments:'broken'}}]}}]}]){
   const marker=responseRubricMarker({question_text:'Explain.'},[], 'test',async()=>new Response(JSON.stringify(body)));
   await expect(markResponse(input(responseFixture('text')),marker)).rejects.toThrow();
  }
 });
});
describe('shared context is explicit public data',()=>{
 const definition= parseResponseDefinition(responseFixture().definition);
 const resource={id:'experiment',kind:'table',title:'Tube results',columns:['Tube','Time (s)'],rows:[['X',20],['Y',30]]};
 const q=(r:any)=>({diagram_config:{type:'response_context',resources:r}});
 it('returns the same saved measurements as strings and only one resource per reference',()=>expect(responseResources(q([resource]),definition)).toEqual([{...resource,rows:[['X','20'],['Y','30']]}]));
 it('refuses absent, duplicated, ragged and private resource content',()=>{
  for(const resources of [[],[resource,resource],[{...resource,rows:[['X']]}],[{...resource,answer:'secret'}],[{...resource,rows:[['X',Infinity]]}]])expect(()=>responseResources(q(resources),definition)).toThrow();
 });
});
