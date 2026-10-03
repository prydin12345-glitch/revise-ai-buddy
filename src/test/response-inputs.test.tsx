import {useState} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {ResponseInput} from '@/components/responses/ResponseInput';
import {ResponseReview} from '@/components/responses/ResponseReview';
import {ResponseResources} from '@/components/responses/ResponseResources';
import {ResponseDraftSession} from '@/lib/response-draft-session';
import {responseFixture,responseQuestion as id,responseParent as parent} from '../../supabase/tests/response-foundation-fixtures';
import type {ResponseDefinition,ResponseEnvelope} from '@/lib/response-contract';
afterEach(cleanup);
function Editor({definition,initial=null}:{definition:ResponseDefinition;initial?:ResponseEnvelope|null}){
 const [value,change]=useState(initial);return <><ResponseInput questionId={id} definition={definition} value={value} onChange={change}/><output data-testid="response">{JSON.stringify(value)}</output></>;
}
const answer=()=>JSON.parse(screen.getByTestId('response').textContent!).value;
it('tick two uses stable IDs, enforces the cap, and allows clearing',()=>{
 render(<Editor definition={responseFixture().definition}/>);
 expect(screen.getByText('Tick two boxes.')).toBeTruthy();
 fireEvent.click(screen.getByLabelText('Glucose'));fireEvent.click(screen.getByLabelText('Starch'));
 expect(screen.getByLabelText('DNA')).toBeDisabled();expect(answer().selectedIds).toEqual(['a','b']);
 fireEvent.click(screen.getByLabelText('Glucose'));expect(screen.getByLabelText('DNA')).not.toBeDisabled();
 fireEvent.click(screen.getByLabelText('Starch'));expect(answer().selectedIds).toEqual([]);
});
it('tick one replaces the selected option and rehydrates saved selection after reorder',()=>{
 const f:any=responseFixture();f.definition.minSelections=1;f.definition.maxSelections=1;
 render(<Editor definition={f.definition}/>);fireEvent.click(screen.getByLabelText('Glucose'));fireEvent.click(screen.getByLabelText('DNA'));expect(answer().selectedIds).toEqual(['c']);cleanup();
 f.definition.options.reverse();f.envelope.value.selectedIds=['c'];render(<Editor definition={f.definition} initial={f.envelope}/>);
 expect(screen.getByLabelText('DNA')).toBeChecked();expect(screen.getByLabelText('Glucose')).not.toBeChecked();
});
it('grid cells have row/column labels, persist individual selections and explicit none',()=>{
 const f=responseFixture('grid');render(<Editor definition={f.definition}/>);
 expect(screen.getAllByRole('columnheader')).toHaveLength(4);
 fireEvent.click(screen.getByRole('checkbox',{name:'Is a polymer — Glycogen'}));fireEvent.click(screen.getByRole('checkbox',{name:'Is a polymer — DNA'}));
 expect(answer().rows).toEqual({polymer:['glycogen','dna']});
 fireEvent.click(screen.getByRole('button',{name:'No selections: Is a polymer'}));expect(answer().rows).toEqual({polymer:[]});
 expect(screen.getByRole('button',{name:'No selections: Is a polymer'})).toHaveAttribute('aria-pressed','true');
});
it('cloze blanks live inside the paragraph and include labelled dropdown choices',()=>{
 const f:any=responseFixture('cloze');f.definition.fields.push({id:'y',label:'Tube Y',required:true,input:'select',options:[{id:'a',label:'Water'},{id:'b',label:'Starch'}]});
 f.definition.segments.push({text:' Tube Y contains '},{blankId:'y'},{text:'.'});
 render(<Editor definition={f.definition}/>);
 fireEvent.change(screen.getByLabelText('Tube X'),{target:{value:'glucose'}});fireEvent.change(screen.getByLabelText('Tube Y'),{target:{value:'b'}});
 expect(answer().fields).toEqual({tube_x:'glucose',y:'b'});expect(screen.getByLabelText('Tube Y').closest('[aria-label="Complete the paragraph"]')).toBeTruthy();
});
it('numeric fields accept incremental negative input and a meaningful zero',()=>{
 render(<Editor definition={responseFixture('fields').definition}/>);const input=screen.getByLabelText('Tube X');
 for(const value of ['-','-.','-.2','0']){fireEvent.change(input,{target:{value}});expect(input).toHaveValue(value);}
 expect(answer().fields.tube_x).toBe('0');fireEvent.change(input,{target:{value:'bad'}});expect(input).toHaveValue('0');
});
it('shared data is visible once above separate labelled answer fields',()=>{
 const f:any=responseFixture('fields');f.definition.fields.push({id:'y',label:'Tube Y',input:'text',required:true});
 render(<><ResponseResources resources={[{id:'experiment',kind:'table',title:'Incubation results',columns:['Tube','Time (s)'],rows:[['X','20'],['Y','30']]}]}/><Editor definition={f.definition}/></>);
 expect(screen.getAllByRole('table')).toHaveLength(1);expect(screen.getByText('Time (s)')).toBeVisible();expect(screen.getByLabelText('Tube X')).toBeVisible();expect(screen.getByLabelText('Tube Y')).toBeVisible();
});
it('unreleased review displays saved answers with no private key or marking feedback',()=>{
 const f=responseFixture('text'),question:any={id,response_definition:f.definition,response_key:f.key,response_result:{units:[{unitId:'u1',targetIds:['answer'],score:1,maxMarks:2,feedback:'SECRET FEEDBACK'}]}};
 const view=render(<ResponseReview question={question} answerText={JSON.stringify(f.envelope)} solutionsReleased={false}/>);
 expect(screen.getByDisplayValue('Glucose is absorbed.')).toBeDisabled();expect(screen.queryByText(/PRIVATE|SECRET/)).toBeNull();
 view.rerender(<ResponseReview question={question} answerText={JSON.stringify(f.envelope)} solutionsReleased/>);
 expect(screen.getByText(/PRIVATE/)).toBeVisible();expect(screen.getByText('SECRET FEEDBACK')).toBeVisible();
});
it('restores a later local edit after the preceding save succeeded but its acknowledgement was lost',async()=>{
 const f=responseFixture('cloze'),scope={source:'exam' as const,parentId:parent,questionId:id};let fail=true;const calls:any[]=[];
 const transport=vi.fn(async body=>{calls.push(body);if(fail)throw new Error('lost acknowledgement');return {response:body.response,revision:body.expectedRevision+1};});
 const original=new ResponseDraftSession(scope,transport);original.initialise({definition:f.definition,response:null,revision:0});original.update(f.envelope);await expect(original.flush()).rejects.toThrow();
 const later:any=structuredClone(f.envelope);later.value.fields.tube_x='starch';original.update(later);const recovery=original.recovery();
 const restored=new ResponseDraftSession(scope,transport);restored.initialise({definition:f.definition,response:f.envelope,revision:1});restored.restoreRecovery(recovery);
 expect(restored.status).toBe('dirty');fail=false;await restored.flush();expect(calls.at(-1).expectedRevision).toBe(1);expect(calls.at(-1).response).toEqual(later);expect(restored.revision).toBe(2);
});
it('retains both a conflicting local edit and the newer server revision without overwriting',async()=>{
 const f=responseFixture('cloze'),transport=vi.fn();const session=new ResponseDraftSession({source:'exam',parentId:parent,questionId:id},transport);
 const newer:any=structuredClone(f.envelope);newer.value.fields.tube_x='starch';session.initialise({definition:f.definition,response:newer,revision:3});session.restoreRecovery({version:1,revision:1,response:f.envelope,pending:null});
 expect(session.status).toBe('conflict');expect(session.response).toEqual(f.envelope);await expect(session.flush()).rejects.toThrow(/conflict/);expect(transport).not.toHaveBeenCalled();
});
