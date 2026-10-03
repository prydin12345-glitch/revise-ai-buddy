import {it,expect} from 'vitest';
import {generateExamPDF} from '@/lib/exam-pdf-generator';
import {responseFormatCases} from './fixtures/response-format-cases';
import {writeFileSync,mkdirSync} from 'node:fs';
const exam={title:'Structured response examples',subject:'Biology',questions:responseFormatCases};
it('prints each shared stimulus once and blank response areas without saved answers or keys',async()=>{
 const pdf=await generateExamPDF({...exam,questions:exam.questions.map(q=>({...q,response_snapshot:{revision:1,response:null}}))});const bytes=pdf.output();
 expect(bytes).toContain('Tick two boxes.');expect(bytes).toContain('Answer grid');expect(bytes).toContain('Tube X: calculate the rate');expect(bytes.match(/Shared experiment data/g)).toHaveLength(1);expect(bytes).not.toContain('PRIVATE SAMPLE');expect(bytes).not.toContain('ANSWER KEY');
 if(process.env.RESPONSE_PDF_QA_DIR){mkdirSync(process.env.RESPONSE_PDF_QA_DIR,{recursive:true});writeFileSync(`${process.env.RESPONSE_PDF_QA_DIR}/response-formats-blank.pdf`,Buffer.from(pdf.output('arraybuffer')));}
});
it('prints an authorised key on separate pages while the question scaffold stays blank',async()=>{
 const pdf=await generateExamPDF(exam,{includeAnswerKey:true});const bytes=pdf.output();expect(bytes).toContain('ANSWER KEY');expect(bytes.match(/PRIVATE SAMPLE/g)).toHaveLength(1);
 const beforeKey=bytes.slice(0,bytes.indexOf('(ANSWER KEY)'));expect(beforeKey).not.toContain('PRIVATE SAMPLE');expect(beforeKey).not.toContain('tolerance');
 if(process.env.RESPONSE_PDF_QA_DIR)writeFileSync(`${process.env.RESPONSE_PDF_QA_DIR}/response-formats-key.pdf`,Buffer.from(pdf.output('arraybuffer')));
});
it('cannot invent a missing stimulus or expose a key that the service withheld',async()=>{
 const withheld=exam.questions.map(({response_key,...q})=>q);const pdf=await generateExamPDF({...exam,questions:withheld},{includeAnswerKey:true});expect(pdf.output()).not.toContain('PRIVATE SAMPLE');
 const broken={...exam.questions[3],response_resources:[]};await expect(generateExamPDF({...exam,questions:[broken]})).rejects.toThrow(/Missing|missing/);
});
it('paginates long grids and repeats readable headers',async()=>{
 const q=structuredClone(exam.questions[1]);if(q.response_definition.kind!=='grid')throw new Error('grid');q.response_definition.rows=Array.from({length:45},(_,i)=>({id:'row_'+i,label:'Property '+i}));
 const pdf=await generateExamPDF({...exam,questions:[q]});expect(pdf.getNumberOfPages()).toBeGreaterThan(2);expect(pdf.output().match(/\(Property\)/g)!.length).toBeGreaterThan(1);
});
