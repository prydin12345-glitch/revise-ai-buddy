import {useState} from 'react';
import {afterEach,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MathRenderer} from '@/components/MathRenderer';
import {BiologyEssayAnswer} from '@/components/exams/BiologyEssayAnswer';
import {generateExamPDF} from '@/lib/exam-pdf-generator';
import {alevelPaper3Fixture,essayResource} from '../../supabase/tests/aqa-alevel-paper3-fixtures';
afterEach(cleanup);
it('renders each public title once and hides the private scheme',()=>{
  const q=alevelPaper3Fixture().rows.at(-1),{container}=render(<MathRenderer content={q.question_text} question={q}/>);
  for(const t of essayResource.titles)expect(container.textContent?.split(t.title)).toHaveLength(2);
  expect(container.textContent).not.toContain('PRIVATE');expect(container.textContent).toContain('EITHER');expect(container.textContent).toContain('OR');
});
it('preserves the essay while changing the selected title and restores the saved answer',()=>{
  let saved='';function Editor(){const [value,setValue]=useState('');return <BiologyEssayAnswer value={value} onChange={v=>{saved=v;setValue(v);}}/>;}
  const view=render(<Editor/>);expect(screen.getByRole('textbox',{name:'Your essay'})).toBeDisabled();
  fireEvent.click(screen.getByRole('radio',{name:'Title A'}));fireEvent.change(screen.getByRole('textbox'),{target:{value:'My detailed answer'}});
  fireEvent.click(screen.getByRole('radio',{name:'Title B'}));expect(screen.getByRole('textbox')).toHaveValue('My detailed answer');expect(saved).toBe('[Essay B]\n\nMy detailed answer');
  view.unmount();render(<BiologyEssayAnswer value={saved} onChange={()=>{}}/>);expect(screen.getByRole('radio',{name:'Title B'})).toBeChecked();expect(screen.getByRole('textbox')).toHaveValue('My detailed answer');
});
it.each([false,true])('prints public essay titles with diagrams=%s without exposing keys',async includeDiagrams=>{
  const {snapshot,rows}=alevelPaper3Fixture(),pdf=await generateExamPDF({title:'Synthetic Paper 3',generation_context:snapshot,questions:[rows.at(-1)]},{includeDiagrams,includeWorkingSpace:false});
  const raw=pdf.output();expect(raw).toContain('7402/3');expect(raw).toContain('EITHER');expect(raw).toContain('Title A');expect(raw).toContain('Title B');expect(raw).not.toContain('PRIVATE ESSAY');expect(raw).not.toContain('Higher Tier');
});
it('paginates essay writing space and puts optional private guidance after the questions',async()=>{
  const {snapshot,rows}=alevelPaper3Fixture(),data={title:'Synthetic Paper 3',generation_context:snapshot,questions:[rows.at(-1)]};
  const clean=await generateExamPDF(data,{includeWorkingSpace:true}),withKey=await generateExamPDF(data,{includeWorkingSpace:true,includeAnswerKey:true});
  expect(clean.getNumberOfPages()).toBeGreaterThan(3);expect(withKey.getNumberOfPages()).toBeGreaterThan(clean.getNumberOfPages());
  const raw=withKey.output();expect(raw.indexOf('PRIVATE ESSAY')).toBeGreaterThan(raw.indexOf('ANSWER KEY'));expect(raw).not.toContain('biology_essay_key');
});
it('keeps long table headings, measurement units, zero readings and captions in the PDF',async()=>{
  const {snapshot,rows}=alevelPaper3Fixture('short_practice'),q=rows[0];
  q.diagram_config={type:'data_table',headers:['Elapsed time after application of the experimental treatment','Mean mass of material transferred into the receiving vessel'],units:['minutes','mg'],rows:[[0,0],[10,20]],caption:'A visible caption for the investigation.'};
  const pdf=await generateExamPDF({title:'Long table',generation_context:snapshot,questions:[q]},{includeDiagrams:false,includeWorkingSpace:false}),raw=pdf.output();
  expect(raw).toContain('experimental');expect(raw).toContain('treatment');expect(raw).toContain('minutes');expect(raw).toContain('receiving');expect(raw).toContain('mg');expect(raw).toContain('(0)');expect(raw).toContain('A visible caption');
});
