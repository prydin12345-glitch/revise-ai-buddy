import type { AssessmentTier } from '@/lib/assessment-tier';
import {biologyPaperOptions} from '../../../supabase/functions/_shared/biology-course-packs';
import {canonicalCourseId,AQA_ALEVEL_BIOLOGY_ID,OCR_ALEVEL_BIOLOGY_ID,OCR_21C_BIOLOGY_ID,WJEC_BIOLOGY_ID} from '@/lib/assessment-tier';
import {WJEC_GRADE_RANGES,WJEC_UNIT3_VERSIONS} from '../../../supabase/functions/_shared/wjec-biology-specification';
export function BiologyPaperSelector({courseId,value,tier,onChange}:{
  courseId:string|null;value:string|null;tier:AssessmentTier|null;onChange:(paperId:string)=>void;
}) {
  const options=biologyPaperOptions(courseId);
  const alevel=courseId===AQA_ALEVEL_BIOLOGY_ID;
  const ocrAlevel=courseId===OCR_ALEVEL_BIOLOGY_ID;
  if(options.length<2&&!alevel&&!ocrAlevel)return null;
  // Only AQA retains its legacy Paper 1 default. All newer courses need a choice.
  const selectedId=value??(canonicalCourseId(courseId)==='aqa_gcse_biology'?'paper_1':'');
  const selected=options.find(pack=>pack.paperId===selectedId),wjec=courseId===WJEC_BIOLOGY_ID;
  return <div className="space-y-2">
    <label htmlFor="biology-paper" className="text-sm font-medium">{wjec?'Biology unit':'Biology paper'}</label>
    <select id="biology-paper" className="w-full rounded-md border bg-background p-2 text-sm" value={selectedId} onChange={event=>onChange(event.target.value)}>
      {!selectedId&&<option value="" disabled>{ocrAlevel?'Choose Paper 1 — Biological processes':wjec?'Choose Unit 1 or Unit 2':courseId===OCR_21C_BIOLOGY_ID?'Choose Breadth or Depth':alevel?'Choose Paper 1, Paper 2 or Paper 3':'Choose Paper 1 or Paper 2'}</option>}
      {options.map(pack=><option key={pack.id} value={pack.paperId}>{pack.definition(tier).displayName}</option>)}

      {ocrAlevel&&<><option value="paper_2" disabled>Paper 2 — Biological diversity (not available yet)</option><option value="paper_3" disabled>Paper 3 — Unified biology (not available yet)</option></>}
      {wjec&&<option value="unit_3" disabled>Unit 3 — practical assessment (not generated)</option>}
    </select>
    {selected&&<p className="text-xs text-muted-foreground">{selected.definition(tier).topics.join(' · ')}.
      {selected.definition(tier).componentCode?` Component ${selected.definition(tier).componentCode}.`:''}</p>}
    {ocrAlevel&&<div className="space-y-1 text-xs text-muted-foreground">
      <p>OCR A-level Biology A H420 · Untiered. AS H020 is a separate qualification.</p>
      <p>Paper 1: Modules 1, 2, 3 and 5 · 100 marks · 2 hours 15 minutes. Section A: 15 one-mark MCQs. Section B: 85 structured marks.</p>
      <p>Short practice: five MCQs and six written parts, 25 marks / 34 minutes. Specification version 4.1 (April 2026). This written practice does not award the practical endorsement.</p>
    </div>}
    {alevel&&<div className="space-y-1 text-xs text-muted-foreground">
      <p>AQA A-level Biology 7402 · Untiered. AS Biology 7401 is a separate qualification.</p>
      <p>{selectedId==='paper_3'?'Paper 3: Topics 1–8; 78 marks, 2 hours. 38 structured + 15 experimental analysis + ONE 25-mark essay chosen from two titles. Short practice: 40 marks, 70 minutes, retaining the full essay.':selectedId==='paper_2'?'Paper 2: Topics 5–8 and relevant practical skills; 91 marks, 2 hours. Includes one 15-mark comprehension question.':'Paper 1: Topics 1–4 and relevant practical skills; 91 marks, 2 hours. Includes 15 extended-response marks.'}</p>
      <p>Specification version 1.6 (July 2026). This written practice does not award the practical endorsement.</p>
    </div>}
    {wjec&&<div className="space-y-1 text-xs text-muted-foreground">
      <p>Wales GCSE · {tier&&tier!=='not_tiered'?`${tier==='foundation'?'Foundation':'Higher'} grades ${WJEC_GRADE_RANGES[tier]}`:'Foundation C–G · Higher A*–D'} · English-medium questions.</p>
      <p>Units 1 and 2: each 80 marks, 1 hour 45 minutes and 45% of the qualification.</p>
      <details>
        <summary className="cursor-pointer">Specification and Unit 3 cohort change</summary>
        <p>Written units follow the February 2026 specification (version 3); Units 1 and 2 are unchanged.</p>
        <p>Unit 3 is untiered, worth 10%, and requires a centre-based practical assessment. It is not generated here.</p>
        <p>Before September 2026 entry: Practical Assessment, {WJEC_UNIT3_VERSIONS.before_september_2026.marks} marks (version 2).</p>
        <p>From September 2026 entry: Scientific Enquiry, {WJEC_UNIT3_VERSIONS.from_september_2026.marks} marks, first award 2028 (version 3). Choose one enquiry; practical and written tasks each take one hour.</p>
        <p>Your cohort is not inferred from today's date. Mock raw scores are not official grades or UMS.</p>
      </details>
    </div>}
  </div>;
}
