import {afterEach,expect,it,vi} from 'vitest';
import {createContext,useContext,cloneElement} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ExamProfileModal} from '@/components/stats/ExamProfileModal';
import {resolveProfileContext} from '@/lib/profile-context';
import {biologyPaperDisplay,gatewaySectionHeading,biologyResponseNotice} from '@/lib/biology-paper-display';
import {unifiedPlottingData} from '@/lib/ocr-unified-plotting';
import {OCR_ALEVEL_BIOLOGY_ID} from '@/lib/assessment-tier';
import {PaperSectionHeading} from '@/components/exams/PaperSectionHeading';
import {OcrUnifiedPaperLabel} from '@/components/exams/OcrUnifiedPaperLabel';
import {ocrPaper3Fixture,ocrPaper3Snapshot} from '../../supabase/tests/ocr-alevel-paper3-fixtures';
import {ocrAlevelSnapshot} from '../../supabase/tests/ocr-alevel-fixtures';
import {ocrPaper2Snapshot} from '../../supabase/tests/ocr-alevel-paper2-fixtures';
import {ocrPaper2V2Snapshot} from '../../supabase/tests/ocr-alevel-paper2-v2-fixtures';
import {generateExamPDF} from '@/lib/exam-pdf-generator';
import {serializeGraphPlottingResponse,parseGraphResponse} from '@/components/graph/types';
vi.mock('@/hooks/useUserPreferences',()=>({useUserPreferences:()=>({preferences:{preferred_educational_level:'level3'}})}));
vi.mock('@/components/ui/popover',()=>{
  const Context=createContext<any>({open:false,onOpenChange:()=>{}});
  return {Popover:({open,onOpenChange,children}:any)=><Context.Provider value={{open,onOpenChange}}>{children}</Context.Provider>,
    PopoverTrigger:({children}:any)=>{const ctx=useContext(Context);return cloneElement(children,{onClick:()=>ctx.onOpenChange(!ctx.open)});},
    PopoverContent:({children}:any)=>useContext(Context).open?<div>{children}</div>:null};
});
vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});
afterEach(cleanup);
const base={profile_name:'My OCR paper',topics:['My practical notes'],question_count:8,written_question_count:8,time_limit_minutes:45,educational_tier:'A-Level',assessment_tier:null};
function editor(initial:any=base){const save=vi.fn(),view=render(<ExamProfileModal open onOpenChange={()=>{}} subjectName="Biology Higher" subjectColor="#3388cc" examBoard="OCR" availableTopics={base.topics} onSave={save} initialData={initial}/>);return {...view,save};}
function apply(mode:'full_mock'|'short_practice'){
  fireEvent.change(screen.getByLabelText('OCR Biology course'),{target:{value:OCR_ALEVEL_BIOLOGY_ID}});
  fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:'paper_3'}});
  fireEvent.click(screen.getByRole('button',{name:mode==='full_mock'?/^Full mock/:/^Short practice/}));
  fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
}
it.each(['full_mock','short_practice'] as const)('saves and reopens explicit untiered Paper 3 %s with correct totals',mode=>{
  const {save,unmount}=editor(),{plan,snapshot}=ocrPaper3Fixture(mode);apply(mode);
  for(const number of [1,2,3])expect(screen.getByRole('option',{name:new RegExp(`Paper ${number}`)})).not.toBeDisabled();
  expect(screen.queryByRole('button',{name:'Higher'})).toBeNull();expect(screen.queryByRole('button',{name:'Foundation'})).toBeNull();
  expect(screen.getByText(/Paper 3: Unified biology.*70 marks.*1 hour 30 minutes/)).toBeVisible();
  expect(screen.getByText(/Short practice:.*20 marks \/ 26 minutes.*Examly development template/)).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));const args=save.mock.calls[0];
  expect(args[2]).toBe(plan.partCount);expect(args[4]).toBe(plan.durationMinutes);expect(args[5].assessmentTier).toBe('not_tiered');
  expect(args[5].mcqCount).toBe(0);expect(args[6]).toBe(plan.partCount);expect(args[7].parentQuestionCount).toBe(plan.parentCount);expect(args[1]).toHaveLength(6);
  expect(args[5].paperBlueprint.paperContract).toEqual(snapshot.paper_contract);expect(args[5].paperBlueprint.courseSelection.paperId).toBe('paper_3');
  unmount();const next=editor({...base,topics:args[1],question_count:args[2],written_question_count:args[6],mcq_count:0,time_limit_minutes:args[4],assessment_tier:'not_tiered',paper_blueprint:args[5].paperBlueprint,question_structure:args[7].questionStructure});
  expect(screen.getByLabelText('Biology paper')).toHaveValue('paper_3');expect(screen.queryByText('Use these settings')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));expect(next.save.mock.calls[0][5].paperBlueprint.paperContract).toEqual(snapshot.paper_contract);
  const ctx=resolveProfileContext({subjectName:'Biology',profile:{id:'p',exam_board:'OCR',educational_tier:'level3',assessment_tier:'not_tiered',paper_blueprint:args[5].paperBlueprint}});
  expect(ctx.configurationError).toBeNull();expect(ctx.componentCode).toBe('H420/03');expect(ctx.assessmentTierSupported).toBe(false);
});
it('preserves manual topics/count/time in Custom with explicit Paper 3 identity',()=>{
  const {save}=editor({...base,paper_blueprint:{courseSelection:{courseId:OCR_ALEVEL_BIOLOGY_ID,paperId:'paper_3'}}});fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
  const args=save.mock.calls[0];expect(args[1]).toEqual(base.topics);expect(args[2]).toBe(8);expect(args[4]).toBe(45);expect(args[5].paperBlueprint.courseSelection.paperId).toBe('paper_3');expect(args[5].paperBlueprint.paperContract).toBeUndefined();
});
it.each([ocrAlevelSnapshot(),ocrPaper2Snapshot(),ocrPaper2V2Snapshot()])('reopens and resaves the existing $component_code contract v$paper_contract.contractVersion unchanged',snapshot=>{
  const {save}=editor({...base,assessment_tier:'not_tiered',paper_blueprint:{paperContract:snapshot.paper_contract,courseSelection:{courseId:OCR_ALEVEL_BIOLOGY_ID,paperId:snapshot.paper_id}}});
  expect(screen.getByLabelText('Biology paper')).toHaveValue(snapshot.paper_id);
  fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));expect(save.mock.calls[0][5].paperBlueprint.paperContract).toEqual(snapshot.paper_contract);
});
it('labels screen/review without Section A/B or tier and retains OCR extended notices',()=>{
  const c=ocrPaper3Snapshot();expect(biologyPaperDisplay(c)?.label).toContain('H420/03 · Unified biology');expect(biologyPaperDisplay(c)?.label).not.toMatch(/Higher|Foundation/);
  expect(gatewaySectionHeading(c,'1(a)')).toBeNull();expect(gatewaySectionHeading(c,'2(a)','1(d)')).toBeNull();expect(biologyResponseNotice(c,'2(d)')).toContain('line of reasoning');
  render(<PaperSectionHeading context={c} number="2(d)"/>);expect(screen.queryByText(/Section [AB]/)).toBeNull();
});
it('labels saved Custom and ordinary practice identities without inventing a full-mock plan',()=>{
  const context={...ocrPaper3Snapshot('custom'),paper_contract:null};
  render(<OcrUnifiedPaperLabel context={context}/>);expect(screen.getByText(/H420\/03 · Unified biology/)).toBeVisible();
  cleanup();render(<OcrUnifiedPaperLabel context={{...context,component_code:'H420/02'}}/>);expect(screen.queryByText(/Unified biology/)).toBeNull();
});
it('exports H420/03 identity and unsolved public table without private keys or invented sections',async()=>{
  const f=ocrPaper3Fixture(),questions=f.rows.slice(0,4).map(q=>({...q,correct_answer:'PRIVATE OCR P3 KEY'}));
  const pdf=await generateExamPDF({title:'Unified synthetic export',subject:'Biology',generation_context:f.snapshot,questions:questions as any},{includeWorkingSpace:false});
  const content=pdf.output();expect(content).toContain('H420/03');expect(content).toContain('Unified biology');expect(content).toContain('Initial enzyme activity');expect(content).not.toContain('PRIVATE OCR P3 KEY');expect(content).not.toContain('Section A');expect(content).not.toContain('Section B');
});
it('builds only a blank public plotting response and retains existing save/restore serialisation',()=>{
  const f=ocrPaper3Fixture(),q=f.rows[1],data=unifiedPlottingData(f.snapshot,q)!;
  expect(data.graphType).toBe('plotting');expect(data.plottingAnswer).toBeUndefined();expect(JSON.stringify(data)).not.toMatch(/expectedPoints|correct_answer|Final statistic/);
  expect((data.graphConfig as any).series).toBeUndefined();expect(data.graphConfig.xLabel).toContain('Temperature');
  expect(unifiedPlottingData(ocrPaper2Snapshot(),q)).toBeNull();expect(unifiedPlottingData(f.snapshot,f.rows[2])).toBeNull();expect(unifiedPlottingData(f.snapshot,{...q,diagram_config:null})).toBeNull();
  const points=[{x:10,y:2},{x:20,y:5}];expect(parseGraphResponse(serializeGraphPlottingResponse(points))).toMatchObject({_type:'graph_plotting',points});
});
