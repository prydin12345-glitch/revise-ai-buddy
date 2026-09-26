import { biologyPaperOptions } from '../../../supabase/functions/_shared/biology-course-packs';
import { canonicalCourseId, OCR_21C_BIOLOGY_ID } from '@/lib/assessment-tier';

export function BiologyPaperSelector({courseId, value, tier, onChange}: {
  courseId: string | null; value: string | null; tier: 'foundation' | 'higher' | null;
  onChange: (paperId: string) => void;
}) {
  const options = biologyPaperOptions(courseId);
  if (options.length < 2) return null;
  // Keep the legacy AQA default. Newly supported courses require an explicit
  // paper; a display name such as "Biology Higher Paper 2" is never a selection.
  const selectedId = value ?? (canonicalCourseId(courseId) === 'aqa_gcse_biology' ? 'paper_1' : '');
  const selected = options.find(pack => pack.paperId === selectedId);
  return <div className="space-y-2">
    <label htmlFor="biology-paper" className="text-sm font-medium">Biology paper</label>
    <select id="biology-paper" className="w-full rounded-md border bg-background p-2 text-sm"
      value={selectedId} onChange={event => onChange(event.target.value)}>
      {!selectedId && <option value="" disabled>{courseId === OCR_21C_BIOLOGY_ID ? 'Choose Breadth or Depth' : 'Choose Paper 1 or Paper 2'}</option>}
      {options.map(pack => <option key={pack.id} value={pack.paperId}>{pack.definition(tier).displayName}</option>)}
    </select>
    {selected && <p className="text-xs text-muted-foreground">
      {selected.definition(tier).topics.join(' · ')}.
      {selected.definition(tier).componentCode ? ` Component ${selected.definition(tier).componentCode}.` : ''}
    </p>}
  </div>;
}
