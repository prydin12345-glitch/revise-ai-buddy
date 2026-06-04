export type ChatIntent =
  | 'exam_review'
  | 'quiz_review'
  | 'general_review'
  | 'performance'
  | 'general';

const EXAM_REVIEW_PATTERNS = [
  /review.*exam/i,
  /exam.*review/i,
  /go (through|over).*exam/i,
  /exam.*(go (through|over))/i,
  /look (at|over).*exam/i,
  /check.*exam/i,
  /exam.*results?/i,
  /how (did|have) i (do|done|perform).*exam/i,
  /exam.*how (did|have) i (do|done|perform)/i,
  /my.*exam.*score/i,
  /walk me through.*exam/i,
  /help me (with|understand|go through|work through).*exam/i,
  /what (did i|have i) got? wrong.*exam/i,
  /exam.*what (did i|have i) got? wrong/i,
  /analyse.*exam/i,
  /exam.*analysis/i,
];

const QUIZ_REVIEW_PATTERNS = [
  /review.*quiz/i,
  /quiz.*review/i,
  /go (through|over).*quiz/i,
  /quiz.*(go (through|over))/i,
  /look (at|over).*quiz/i,
  /check.*quiz/i,
  /review.*practice/i,
  /practice.*review/i,
  /how (did|have) i (do|done|perform).*quiz/i,
  /quiz.*how (did|have) i (do|done|perform)/i,
  /walk me through.*quiz/i,
  /help me (with|understand|go through|work through).*quiz/i,
  /what (did i|have i) got? wrong.*quiz/i,
  /quiz.*what (did i|have i) got? wrong/i,
  /go (through|over).*practice/i,
  /practice.*(go (through|over))/i,
];

const GENERAL_REVIEW_PATTERNS = [
  /what (have i|did i) (been )?get(ting)? wrong/i,
  /where (am i|have i been) (going wrong|struggling|making mistakes)/i,
  /what (are|were) my (mistakes|errors|wrong answers)/i,
  /show me (what|where) i went wrong/i,
  /show me my (mistakes|errors|wrong answers)/i,
  /review my (recent|latest|last|work|results?|performance)/i,
  /go (through|over) (my|what i got wrong|my mistakes)/i,
  /walk me through (my|what i got wrong|my mistakes)/i,
  /help me (understand|go through|work through|with) (my|what i got wrong)/i,
  /let'?s (go (through|over)|review|look at) (my|what i got wrong)/i,
  /can (we|you) (go (through|over)|review|look at) (my|what i got wrong)/i,
  /want to (work on|go over|review|look at) (my|what i got wrong)/i,
  /i (need|want) (help|to go over|to review|to understand) (my|what i got wrong)/i,
  /what (should i|do i need to) (work on|improve|focus on|revise)/i,
  /where (do i|am i) (need(ing)? to improve|struggling|weak)/i,
  /my (weak|problem) (areas?|topics?|subjects?)/i,
  /(fix|improve|work on) my (weak|wrong|mistakes?|errors?)/i,
  /explain (what|where) i (went|got) wrong/i,
  /tell me (what|where) i (went|got) wrong/i,
  /why did i (fail|get|score (low|badly|poorly))/i,
];

const PERFORMANCE_PATTERNS = [
  /how (am i|have i been) doing/i,
  /my (overall|recent) (performance|progress|scores?)/i,
  /how (well|badly) (am i|have i been) doing/i,
  /my (stats|statistics|results)/i,
  /progress (report|summary|overview)/i,
  /how (am i|have i been) (performing|getting on)/i,
  /give me (a )?(summary|overview|breakdown) of (my|how i)/i,
  /summarise? (my|how i)/i,
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
