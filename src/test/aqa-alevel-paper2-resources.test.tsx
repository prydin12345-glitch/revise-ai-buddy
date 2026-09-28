import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {MathRenderer} from '@/components/MathRenderer';
import {InsertPanel} from '@/components/insert/InsertPanel';
import {generateExamPDF} from '@/lib/exam-pdf-generator';
import {comprehensionInsertFigures} from '@/lib/biology-comprehension';
import {alevelPaper2Fixture,readingParagraphs} from '../../supabase/tests/aqa-alevel-paper2-fixtures';
afterEach(cleanup);
it('opens the reading on the first part, numbers paragraphs and hides private keys',()=>{
  const q=alevelPaper2Fixture().rows.slice(-5)[0];const {container}=render(<MathRenderer content={q.question_text} question={q}/>);
  expect(container.querySelector('details')).toHaveAttribute('open');expect(screen.getByLabelText('Paragraph 6')).toBeInTheDocument();
  expect(container.textContent).toContain(q.question_text);expect(container.textContent).not.toContain('PRIVATE P2 KEY');
});
it('keeps the same source available in a collapsed panel on later parts',()=>{
  const q=alevelPaper2Fixture().rows.slice(-5)[1];const {container}=render(<MathRenderer content={q.question_text} question={q}/>);
  expect(container.querySelector('details')).not.toHaveAttribute('open');expect(container.textContent).toContain(readingParagraphs[0]);
});
it('places the source once in the insert, with its paragraph numbering',()=>{
  const figures=comprehensionInsertFigures(alevelPaper2Fixture().rows);const {container}=render(<InsertPanel figures={figures}/>);
  expect(figures).toHaveLength(1);expect(container.textContent?.split(readingParagraphs[0])).toHaveLength(2);
  expect(container.querySelectorAll('strong')).toHaveLength(6);
});
it.each([false,true])('prints the required source once when includeDiagrams=%s',async includeDiagrams=>{
  const {snapshot,rows}=alevelPaper2Fixture();const pdf=await generateExamPDF({title:'Synthetic Paper 2',generation_context:snapshot,questions:rows.slice(-5)},{includeDiagrams,includeWorkingSpace:false});
  const raw=pdf.output();expect(raw).toContain('7402/2');expect(raw).toContain('Comprehension');
  expect(raw.split('Researchers investigated')).toHaveLength(2);expect(raw).not.toContain('PRIVATE P2 KEY');expect(raw).not.toContain('Higher Tier');
  for(const letter of 'abcde')expect(raw).toContain(`\\(${letter}\\)`);
});
it('keeps the optional private answer section after the question passage',async()=>{
  const {snapshot,rows}=alevelPaper2Fixture();const pdf=await generateExamPDF({title:'Synthetic Paper 2',generation_context:snapshot,questions:rows.slice(-5)},{includeAnswerKey:true,includeWorkingSpace:false});
  const raw=pdf.output();expect(raw.split('Researchers investigated')).toHaveLength(2);
  expect(raw.indexOf('PRIVATE P2 KEY')).toBeGreaterThan(raw.indexOf('Researchers investigated'));
});
it('refuses to export conflicting stored copies instead of choosing a source',async()=>{
  const {snapshot,rows}=alevelPaper2Fixture();rows.at(-1).diagram_config={...rows.at(-1).diagram_config,title:'A different source'};
  await expect(generateExamPDF({title:'Invalid source',generation_context:snapshot,questions:rows.slice(-5)})).rejects.toThrow(/Conflicting/);
});
