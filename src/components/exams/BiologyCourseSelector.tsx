import { getCourseOptions, OCR_GATEWAY_BIOLOGY_ID, type CourseLookup } from '@/lib/assessment-tier';
import { gatewayComponent } from '@/lib/biology-paper-contract';

export function BiologyCourseSelector({lookup, value, tier, onChange}: {
  lookup: CourseLookup; value: string | null; tier: 'foundation' | 'higher' | null;
  onChange: (courseId: string) => void;
}) {
  const options = getCourseOptions(lookup);
  if (options.length < 2) return null;
  return <div className="space-y-2">
    <label className="text-sm font-medium" htmlFor="biology-course">OCR Biology course</label>
    <select id="biology-course" className="w-full rounded-md border bg-background p-2 text-sm"
      value={value ?? ''} onChange={event => onChange(event.target.value)}>
      <option value="" disabled>Choose the course your school teaches</option>
      {options.map(course => <option key={course.id} value={course.id} disabled={course.generationAvailable === false}>
        {course.id === OCR_GATEWAY_BIOLOGY_ID ? 'Gateway Biology A' : 'Twenty First Century Biology B'}{course.generationAvailable === false ? ' — coming later' : ''}
      </option>)}
    </select>
    <p className="text-xs text-muted-foreground">Gateway Biology A: J247 · Twenty First Century Biology B: J257.</p>
    {value === OCR_GATEWAY_BIOLOGY_ID && <p className="text-xs text-muted-foreground">
      First paper: {tier ? `${gatewayComponent(tier)} · Paper ${tier === 'foundation' ? '1' : '3'}` : 'Paper 1 Foundation / Paper 3 Higher'}.
      {' '}B1 Cell level systems, B2 Scaling up, B3 Organism level systems, with practical skills.
      {' '}The second paper is coming later.
    </p>}
  </div>;
}
