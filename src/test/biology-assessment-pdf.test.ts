import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup} from '@testing-library/react';
import {act} from 'react';
import ReactDOM from 'react-dom/client';
import {blankCross, mouseQuestion, parentTable, lakeQuestion} from '../../supabase/tests/fixtures/biology-resource-cases';

// Exercise real PDF layout and the actual React diagram, replacing only the
// browser's canvas capture. Live html2canvas rendering remains a preview check.
const capture = vi.hoisted(() => ({html:[] as string[],fail:false}));
vi.mock('html2canvas', () => ({default:async(element:HTMLElement) => {
  capture.html.push(element.innerHTML);
  if(capture.fail) throw new Error('Synthetic capture failure');
  return {width:600,height:500,toDataURL:()=>''};
}}));
import jsPDF from 'jspdf';
import {generateExamPDF} from '@/lib/exam-pdf-generator';

const exam = {title:'Biology resource regression',subject:'Biology',questions:[
  {...mouseQuestion,id:'mouse',diagram_config:blankCross,
    table_data:JSON.stringify([parentTable.headers,...parentTable.rows])},
  {...lakeQuestion,id:'lake'},
]};
beforeEach(() => {
  capture.html=[];capture.fail=false;
  const createRoot=ReactDOM.createRoot.bind(ReactDOM);
  vi.spyOn(ReactDOM,'createRoot').mockImplementation((container,options)=>{
    const root=createRoot(container,options);
    return {render:children=>act(()=>root.render(children)),unmount:()=>act(()=>root.unmount())};
  });
  // Image bytes are the capture adapter's responsibility. Test the real PDF
  // text, table routing, and the SVG handed to capture without a canvas addon.
  const pdfApi=jsPDF.API as unknown as Pick<jsPDF,'addImage'>;
  vi.spyOn(pdfApi,'addImage').mockImplementation(function(){return this;});
});
afterEach(() => {cleanup();vi.restoreAllMocks();});

describe('Biology PDF assessment output', () => {
  it('prints the biomass data once and supplies only an unsolved cross to capture', async () => {
    const pdf=await generateExamPDF(exam,{includeWorkingSpace:false});
    const bytes=pdf.output();
    expect(bytes).toContain('(1200)');
    expect(bytes).toContain('(180)');
    expect(bytes.match(/\(1200\)/g)).toHaveLength(1);
    expect(bytes).not.toContain('(ANSWER KEY)');
    expect(capture.html).toHaveLength(1);
    expect(capture.html[0]).toContain('Blank Punnett square');
    expect(capture.html[0]).not.toMatch(/50%|1:1|3:1|dominant|recessive/);
  });
  it('keeps the question figure blank even when a separate answer key is requested', async () => {
    const pdf=await generateExamPDF(exam,{includeWorkingSpace:false,includeAnswerKey:true});
    expect(pdf.output()).toContain('(ANSWER KEY)');
    expect(capture.html[0]).toContain('Blank Punnett square');
    expect(capture.html[0]).not.toMatch(/50%|1:1|3:1/);
  });
  it('refuses conflicting saved parents instead of printing a plausible substitute', async () => {
    const bad={...exam,questions:[{...exam.questions[0],diagram_config:{...blankCross,parent2:'Bb'}}]};
    await expect(generateExamPDF(bad)).rejects.toThrow('parents disagree');
    expect(capture.html).toHaveLength(0);
  });
  it('reports a failed Biology capture and removes its temporary DOM', async () => {
    capture.fail=true;
    const error=vi.spyOn(console,'error').mockImplementation(()=>{});
    await expect(generateExamPDF(exam)).rejects.toThrow('could not be rendered for printing');
    expect(document.querySelector('svg')).toBeNull();
    expect(error).toHaveBeenCalled();
  });
});
