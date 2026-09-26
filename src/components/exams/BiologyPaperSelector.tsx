import {biologyPaperOptions} from '../../../supabase/functions/_shared/biology-course-packs';
import {canonicalCourseId,OCR_21C_BIOLOGY_ID,WJEC_BIOLOGY_ID} from '@/lib/assessment-tier';
import {WJEC_GRADE_RANGES,WJEC_UNIT3_VERSIONS} from '../../../supabase/functions/_shared/wjec-biology-specification';
export function BiologyPaperSelector({courseId,value,tier,onChange}:{
  courseId:string|null;value:string|null;tier:'foundation'|'higher'|null;onChange:(paperId:string)=>void;
}) {
  const options=biologyPaperOptions(courseId);
  if(options.length<2)return null;
  // Only AQA retains its legacy Paper 1 default. All newer courses need a choice.
  const selectedId=value??(canonicalCourseId(courseId)==='aqa_gcse_biology'?'paper_1':'');
  const selected=options.find(pack=>pack.paperId===selectedId),wjec=courseId===WJEC_BIOLOGY_ID;
  return <div className="space-y-2">
    <label htmlFor="biology-paper" className="text-sm font-medium">{wjec?'Biology unit':'Biology paper'}</label>
    <select id="biology-paper" className="w-full rounded-md border bg-background p-2 text-sm" value={selectedId} onChange={event=>onChange(event.target.value)}>
      {!selectedId&&<option value="" disabled>{wjec?'Choose Unit 1 or Unit 2':courseId===OCR_21C_BIOLOGY_ID?'Choose Breadth or Depth':'Choose Paper 1 or Paper 2'}</option>}
      {options.map(pack=><option key={pack.id} value={pack.paperId}>{pack.definition(tier).displayName}</option>)}
      {wjec&&<option value="unit_3" disabled>Unit 3 — practical assessment (not generated)</option>}
    </select>
    {selected&&<p className="text-xs text-muted-foreground">{selected.definition(tier).topics.join(' · ')}.
      {selected.definition(tier).componentCode?` Component ${selected.definition(tier).componentCode}.`:''}</p>}
    {wjec&&<div className="space-y-1 text-xs text-muted-foreground">
      <p>Wales GCSE · {tier?`${tier==='foundation'?'Foundation':'Higher'} grades ${WJEC_GRADE_RANGES[tier]}`:'Foundation C–G · Higher A*–D'} · English-medium questions.</p>
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
