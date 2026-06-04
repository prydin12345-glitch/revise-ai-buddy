export type ChatIntent =
  | 'exam_review'
  | 'quiz_review'
  | 'general_review'
  | 'performance'
  | 'general';

const EXAM_REVIEW_PATTERNS = [
  /review.*exam/i,
  /exam.*review/i,
  /go through.*exam/i,
  /what.*get wrong.*exam/i,
  /exam.*what.*wrong/i,
  /how did i do.*exam/i,
  /exam.*how did i do/i,
  /my.*exam.*result/i,
  /look at.*exam/i,
  /check.*exam/i,
];

const QUIZ_REVIEW_PATTERNS = [
  /review.*quiz/i,
  /quiz.*review/i,
  /go through.*quiz/i,
  /practice.*review/i,
  /review.*practice/i,
  /what.*get wrong.*quiz/i,
  /quiz.*what.*wrong/i,
  /how did i do.*quiz/i,
  /quiz.*how did i do/i,
  /my.*quiz.*result/i,
  /look at.*practice/i,
];

const GENERAL_REVIEW_PATTERNS = [
  /what (have i|did i) get wrong/i,
  /where (am i|have i been) (going wrong|struggling|making mistakes)/i,
  /review my (recent|latest|last)/i,
  /go through (my|what) (i got wrong|mistakes|errors)/i,
  /what (should i|do i need to) (work on|improve|focus on|revise)/i,
  /how (have i|am i) (been doing|performing|getting on)/i,
  /my (recent|latest) (results|scores|performance)/i,
  /show me (what|where) i went wrong/i,
  /help me (understand|go through) (what|where) i (got|went) wrong/i,
];

const PERFORMANCE_PATTERNS = [
  /how (am i|have i been) doing/i,
  /my (overall|recent) (performance|progress|scores)/i,
  /how (well|badly) (am i|have i been) doing/i,
  /my (stats|statistics|results)/i,
  /progress (report|summary|overview)/i,
];

export const detectIntent = (message: string): ChatIntent => {
  if (EXAM_REVIEW_PATTERNS.some(p => p.test(message))) return 'exam_review';
  if (QUIZ_REVIEW_PATTERNS.some(p => p.test(message))) return 'quiz_review';
  if (GENERAL_REVIEW_PATTERNS.some(p => p.test(message))) return 'general_review';
  if (PERFORMANCE_PATTERNS.some(p => p.test(message))) return 'performance';
  return 'general';
};

export const isReviewIntent = (intent: ChatIntent): boolean =>
  intent === 'exam_review' ||
  intent === 'quiz_review' ||
  intent === 'general_review';
