// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {generationEnvelope,parseGenerationContent} from '../functions/_shared/generation-response';

const row = {question_number:'1(a)',question_text:'Calculate the rate.',marks:2,correct_answer:'PRIVATE KEY',
  chart_data:{type:'data_table',headers:['Time (s)','Volume (cm³)'],rows:[[0,0],[10,4]]}};

describe('lossless question envelopes',()=>{
  it.each([['canonical',{questions:[row],detected_subject:'Biology',topics:['Cells']}],
    ['parts',{parts:[row],topics:['Cells']}],['array',[row]]])('accepts %s without modifying numbering, resources or private keys',(_name,value)=>{
    const original=structuredClone(value),result=generationEnvelope(value);
    expect(result.questions).toEqual([row]);expect(value).toEqual(original);
    if(!Array.isArray(value))expect(result.topics).toEqual(['Cells']);
  });
  it('accepts equivalent aliases regardless of property order',()=>{
    expect(generationEnvelope({questions:[row],parts:[Object.fromEntries(Object.entries(row).reverse())]}).questions).toEqual([row]);
  });
  it.each([null,'PRIVATE TEXT',{}, {topics:[row]}, {exam:{questions:[row]}}, {questions:'PRIVATE TEXT'},
    {questions:null}, {questions:[row],parts:[{...row,marks:5}]}, {questions:[],parts:[row]},
    {questions:[null]}, {questions:[row,'PRIVATE TEXT']}])('rejects ambiguous or unsupported data without echoing the response: %#',value=>{
    expect(()=>generationEnvelope(value)).toThrow();
    try{generationEnvelope(value);}catch(e){expect(String(e)).not.toMatch(/PRIVATE TEXT|PRIVATE KEY/);}
  });
  it('does not pretend an empty array is a paper',()=>{
    expect(()=>generationEnvelope({questions:[]})).toThrow('empty_question_array');
  });
});

describe('complete-object truncation recovery',()=>{
  it.each(['questions','parts','array'] as const)('recovers %s and preserves nested resources, escaped strings and private keys',shape=>{
    const complete={...row,question_text:'Calculate the rate. The token "questions" is text {only}.'};
    const array=`[${JSON.stringify(complete)},{"question_number":"1(b)","chart_data":{"rows":[`;
    const body=shape==='array'?array:`{"detected_subject":"Biology","${shape}":${array}`;
    expect(parseGenerationContent(body,'length').questions).toEqual([complete]);
  });
  it('accepts JSON fences without altering embedded code or scientific text',()=>{
    expect(parseGenerationContent('```json\n'+JSON.stringify({questions:[row]})+'\n```','stop').questions).toEqual([row]);
  });
  it.each(['{"metadata":{"questions":['+JSON.stringify(row)+'},',
    '{"topics":['+JSON.stringify(row)+'},',
    '{"questions":[{"question_number":"1(a)","question_text":"PRIVATE',
    'The provider returned no questions.'])('fails when no complete top-level question arrived: %#',body=>{
    expect(()=>parseGenerationContent(body,'length')).toThrow('truncated_before_first_question');
  });
  it('rejects malformed output not identified as truncated',()=>{
    expect(()=>parseGenerationContent('{"questions":['+JSON.stringify(row)+',','stop')).toThrow('invalid_provider_json');
  });
  it('does not choose an alias from a conflicting truncated envelope',()=>{
    expect(()=>parseGenerationContent('{"questions":['+JSON.stringify(row)+'],"parts":[{"question_number":"1(b)",','length')).toThrow('truncated_before_first_question');
  });
  it('does not ignore an invalid second alias in a truncated envelope',()=>{
    expect(()=>parseGenerationContent('{"questions":['+JSON.stringify(row)+'],"parts":"PRIVATE','length')).toThrow('truncated_before_first_question');
  });
  it.each(['{"questions":[['+JSON.stringify(row)+'],',
    '{"questions":[null,'+JSON.stringify(row)+',',
    '{"questions":['+JSON.stringify(row)+JSON.stringify(row)+','])('never flattens or skips invalid question elements in truncated data: %#',body=>{
    expect(()=>parseGenerationContent(body,'length')).toThrow('truncated_before_first_question');
  });
  it.each(['',null,{},[]])('distinguishes absent content from an empty question array: %#',content=>{
    expect(()=>parseGenerationContent(content,'stop')).toThrow('empty_provider_content');
  });
});
