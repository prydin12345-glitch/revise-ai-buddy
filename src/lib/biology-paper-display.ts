import { paperPlanForAttempt } from '../../supabase/functions/_shared/course-selection';
import { OCR_GATEWAY_BIOLOGY_ID } from '@/lib/assessment-tier';
import { canonicalPartNumber } from '../../supabase/functions/_shared/ocr-plan-validator';
import { isAqaPaper2 } from '../../supabase/functions/_shared/aqa-biology-paper2';

export function biologyPaperDisplay(context: unknown) {
  const gateway = gatewayPaperDisplay(context);
  if (gateway) return {...gateway, subject: 'Gateway Biology A'};
  try {
    const plan = paperPlanForAttempt(context);
    if (!plan || !isAqaPaper2(plan)) return null;
    return {plan, subject: 'Biology', label: `AQA Biology Paper 2 · ${plan.componentCode} · ${plan.tier === 'foundation' ? 'Foundation' : 'Higher'}`};
  } catch { return null; }
}

export function gatewayPaperDisplay(context: unknown) {
  try {
    const plan = paperPlanForAttempt(context);
    if (plan?.courseId !== OCR_GATEWAY_BIOLOGY_ID) return null;
    return {plan, label: `Gateway Biology A · ${plan.componentCode} · ${plan.tier === 'foundation' ? 'Foundation' : 'Higher'}`};
  } catch { return null; }
}
export function gatewaySectionHeading(context: unknown, questionNumber: string, previousNumber?: string): string | null {
  const display = gatewayPaperDisplay(context);
  if (!display) return null;
  const sectionFor = (number?: string) => display.plan.parts.find(p => canonicalPartNumber(p.questionNumber) === canonicalPartNumber(number))?.section;
  const section = sectionFor(questionNumber);
  if (!section || section === sectionFor(previousNumber)) return null;
  const marks = display.plan.parts.filter(p => p.section === section).reduce((n, p) => n + p.marks, 0);
  return `Section ${section} — ${section === 'A' ? 'Multiple choice' : 'Structured questions'} (${marks} marks)`;
}
