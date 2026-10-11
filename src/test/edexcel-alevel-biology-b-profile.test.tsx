import {renderProfileBasics} from "./profile-test-render";
import {afterEach,expect,it,vi} from 'vitest';
import {createContext,useContext,cloneElement} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ExamProfileModal} from '@/components/stats/ExamProfileModal';
import {TimeWheelPicker} from '@/components/stats/TimeWheelPicker';
import BiologyDiagramDraw from '@/components/biology/BiologyDiagramDraw';
import {EDEXCEL_ALEVEL_BIOLOGY_B_ID as B,EDEXCEL_ALEVEL_BIOLOGY_A_ID as A} from '@/lib/assessment-tier';
import {resolveProfileContext} from '@/lib/profile-context';
import {biologyPaperDisplay,edexcelBiologyBPaperLabel,biologyResponseNotice,gatewaySectionHeading} from '@/lib/biology-paper-display';
import {unifiedPlottingData} from '@/lib/ocr-unified-plotting';
import {generateExamPDF} from '@/lib/exam-pdf-generator';
import {edexcelBFixture,edexcelBSnapshot} from '../../supabase/tests/edexcel-alevel-biology-b-fixtures';
vi.mock('@/hooks/useUserPreferences',()=>({useUserPreferences:()=>({preferences:{preferred_educational_level:'level3'}})}));
vi.mock('@/components/ui/popover',()=>{const Context=createContext<any>({open:false,onOpenChange:()=>{}});return {Popover:({open,onOpenChange,children}:any)=><Context.Provider value={{open,onOpenChange}}>{children}</Context.Provider>,PopoverTrigger:({children}:any)=>{const c=useContext(Context);return cloneElement(children,{onClick:()=>c.onOpenChange(!c.open)});},PopoverContent:({children}:any)=>useContext(Context).open?<div>{children}</div>:null};});
vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});
afterEach(cleanup);
it('preserves an exact Biology B Custom duration without changing the default timer choices',()=>{
  const change=vi.fn(),view=render(<TimeWheelPicker value="42" onChange={change} subjectColor="#246746" preserveExactValue/>);
  expect(screen.getByRole('option',{name:'42 min'})).toHaveAttribute('aria-selected','true');
  view.rerender(<TimeWheelPicker value="29" onChange={change} subjectColor="#246746" preserveExactValue/>);
  expect(screen.getByRole('option',{name:'29 min'})).toHaveAttribute('aria-selected','true');
  expect(screen.queryByRole('option',{name:'42 min'})).toBeNull();
  fireEvent.click(screen.getByRole('option',{name:'45 min'}));expect(change).toHaveBeenCalledWith('45');
  view.rerender(<TimeWheelPicker value="42" onChange={change} subjectColor="#246746"/>);
  expect(screen.queryByRole('option',{name:'42 min'})).toBeNull();
});
it.each(['full_mock','short_practice'] as const)('renders the %s saved diagram with only anonymous target letters',mode=>{
  const diagram=edexcelBFixture(mode).rows.find(q=>['heart','plant_cell'].includes(q.diagram_config?.type))!;
  const {container}=render(<BiologyDiagramDraw config={diagram.diagram_config}/>);
  expect([...container.querySelectorAll('svg text')].map(el=>el.textContent)).toEqual('ABCDEFGHIJK'.split(''));
  expect(container.textContent).not.toMatch(/Left atrium|Ventricle|SVC|Nucleus|Chloroplast/i);
});
const base={profile_name:'Biology B mock',topics:['Biological Molecules'],question_count:9,written_question_count:7,mcq_count:2,time_limit_minutes:42,educational_tier:'level3',assessment_tier:null,question_structure:'standalone',include_tables:true,include_graphs:false,mcq_options_count:4,mcq_position:'end',mark_distribution:{2:3,4:4},calculator_policy:'not_allowed'};
function editor(initial:any=base){const save=vi.fn(),view=renderProfileBasics(<ExamProfileModal open onOpenChange={()=>{}} subjectName="Biology" subjectColor="#246746" examBoard="Pearson Edexcel" availableTopics={base.topics} onSave={save} initialData={initial}/>);return {...view,save};}
function select(){fireEvent.change(screen.getByLabelText('Pearson Edexcel Biology qualification'),{target:{value:B}});fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:'9bi0_01'}});}
function apply(mode='full_mock'){select();fireEvent.click(screen.getByRole('button',{name:mode==='full_mock'?/^Full mock/:/^Short practice/}));fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));}
function stored(args:any[]){return {...base,topics:args[1],question_count:args[2],time_limit_minutes:args[4],assessment_tier:args[5].assessmentTier,mcq_count:args[5].mcqCount,mcq_position:args[5].mcqPosition,mark_distribution:args[5].markDistribution,calculator_policy:args[5].calculatorPolicy,written_question_count:args[6],paper_blueprint:args[5].paperBlueprint,question_structure:args[7].questionStructure,parent_question_count:args[7].parentQuestionCount,max_parts_per_question:args[7].maxPartsPerQuestion,include_graphs:args[7].includeGraphs,include_tables:args[7].includeTables};}
it('exposes distinct B and unavailable A; generic Edexcel Biology cannot save a guessed qualification',()=>{
  editor();expect(screen.getByRole('option',{name:/Biology A.*not available/})).toBeDisabled();expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  select();expect(screen.getByRole('option',{name:'Paper 1 — Advanced Biochemistry, Microbiology and Genetics (9BI0/01)'})).toBeVisible();
  expect(screen.queryByRole('button',{name:'Higher'})).toBeNull();expect(screen.queryByRole('button',{name:'Foundation'})).toBeNull();
  expect(resolveProfileContext({subjectName:'Biology',profile:{id:'synthetic',exam_board:'Pearson Edexcel',educational_tier:'level3',paper_blueprint:{courseSelection:{courseId:A,paperId:'9bi0_01'}}}}).configurationError).toMatch(/not available/);
});
it.each(['full_mock','short_practice'])('saves and reopens %s with exact untiered identity and computed totals',mode=>{
  const {save,unmount}=editor();apply(mode);
  expect(screen.getAllByText(mode==='full_mock'?/90 marks, 105 minutes/:/25 marks, 29 minutes/)[0]).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));const args=save.mock.calls[0];
  expect(args[2]).toBe(mode==='full_mock'?36:9);expect(args[4]).toBe(mode==='full_mock'?105:29);expect(args[5].assessmentTier).toBe('not_tiered');expect(args[5].mcqPosition).toBe('mixed');
  expect(args[5].paperBlueprint.paperContract).toEqual(edexcelBSnapshot(mode).paper_contract);
  unmount();const reopened=editor(stored(args));expect(screen.getByLabelText('Biology paper')).toHaveValue('9bi0_01');
  fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));expect(reopened.save.mock.calls[0][5].paperBlueprint.paperContract).toEqual(args[5].paperBlueprint.paperContract);
});
it('restores complete Custom choices after conversion, save and reopen',()=>{
  const {save,unmount}=editor();apply();fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));const guided=save.mock.calls[0];unmount();
  const reopened=editor(stored(guided));fireEvent.click(screen.getByRole('button',{name:/^Custom/}));fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));const c=reopened.save.mock.calls[0];
  expect(c[1]).toEqual(base.topics);expect(c[2]).toBe(9);expect(c[4]).toBe(42);expect(c[6]).toBe(7);expect(c[5].mcqCount).toBe(2);expect(c[5].mcqPosition).toBe('end');expect(c[5].calculatorPolicy).toBe('not_allowed');expect(c[5].markDistribution).toEqual(base.mark_distribution);
  expect(c[7].includeGraphs).toBe(false);expect(c[7].includeTables).toBe(true);expect(c[5].paperBlueprint.courseSelection.paperId).toBe('9bi0_01');expect(c[5].paperBlueprint.paperContract).toBeUndefined();
});
it('uses correct cover/review/practice labels and blank plotting data without sections or disclosed answers',()=>{
  const f=edexcelBFixture();expect(biologyPaperDisplay(f.snapshot)?.label).toContain('Pearson Edexcel A Level Biology B · 9BI0/01');expect(edexcelBiologyBPaperLabel(edexcelBSnapshot('custom'))).toContain('Advanced Biochemistry');
  expect(edexcelBiologyBPaperLabel({...f.snapshot,component_code:'9BN0/01'})).toBeNull();expect(gatewaySectionHeading(f.snapshot,'1(a)')).toBeNull();expect(biologyResponseNotice(f.snapshot,'9(d)')).toContain('coherent');
  const grid=unifiedPlottingData(f.snapshot,f.rows.find(q=>q.question_number==='5(c)')!)!;expect(grid.graphType).toBe('plotting');expect(grid.plottingAnswer).toBeUndefined();expect(JSON.stringify(grid)).not.toContain('correct_answer');
});
it('prints the wrapped B identity, required resources and no private schemes/answers',async()=>{
  const f=edexcelBFixture(),pdf=await generateExamPDF({title:'Synthetic Biology B export',subject:'Biology',generation_context:f.snapshot,questions:f.rows.filter(q=>!q.diagram_config||q.diagram_config.type==='data_table').map(q=>({...q,correct_answer:'PRIVATE PEARSON KEY'})) as any},{includeWorkingSpace:false});
  const output=pdf.output();expect(output).toContain('9BI0/01');expect(output).toContain('Biology B');expect(output).toContain('Biochemistry');expect(output).toContain('Time Allowed: 105 minutes');expect(output).not.toContain('PRIVATE PEARSON KEY');expect(output).not.toContain('Section A');expect(output).not.toContain('Section B');
});
