import { OCR_GATEWAY_BIOLOGY_ID } from './assessment-tier.ts';
import type { PaperPlan } from './paper-contract-types.ts';
import type { CandidatePart, QuestionDefect } from './question-contract-validator.ts';
import { validateBiologyPlan } from './biology-plan-validator.ts';
export { canonicalPartNumber } from './biology-plan-validator.ts';

/** Compatibility entry point for the existing OCR tests and callers. */
export function validateGatewayPlan(rows: CandidatePart[], plan?: PaperPlan | null): QuestionDefect[] {
  return plan?.courseId === OCR_GATEWAY_BIOLOGY_ID ? validateBiologyPlan(rows, plan) : [];
}
