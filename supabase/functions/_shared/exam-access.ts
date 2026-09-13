/** Central access decision; SQL also enforces direct database access. */
export interface ExamAccess {
  hasAccess: boolean;
  isOwner: boolean;
  isManager: boolean;
  isAssigned: boolean;
  gradesReleased: boolean;
  deadline: string | null;
}
export async function requireExamAccess(client: any, examId: string, userId: string): Promise<ExamAccess> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(examId ?? '')) {
    throw new ExamRequestError(400, 'Invalid exam ID');
  }
  const { data, error } = await client.rpc('exam_access_info', { p_exam_id: examId, p_user_id: userId });
  if (error) throw new ExamRequestError(503, 'Exam access could not be verified. Please retry.');
  if (!data?.hasAccess) throw new ExamRequestError(403, 'You do not have access to this exam.');
  return data as ExamAccess;
}
export class ExamRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function mayReadSolutions(access: ExamAccess, status?: string | null): boolean {
  return access.isManager || (status === 'graded' && access.gradesReleased);
}
const PRIVATE_KEYS = new Set([
  'correctanswer','correctanswers','answer','answers','answerkey','markscheme','markingscheme',
  'workedsolution','solution','solutions','rationale','numericalanswer','modelanswer',
  'expectedanswer','expectedanswers','expectedpoints','correctpoints','iscorrect','markingdata',
  'plottinganswer','sketchanswer','feedback','score','methodmarks','accuracymarks',
  'correctinputs','expectedpoint','expectedpath','markingformula','keyfeatures','correct',
  'expectedfeatures','referenceanswer','gradingrubric','rubric',
]);
/** Strip known solution metadata recursively, including JSON stored as text. */
export function stripSolutionData(value: any): any {
  if (Array.isArray(value)) return value.map(stripSolutionData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !PRIVATE_KEYS.has(key.replace(/[^a-z]/gi, '').toLowerCase()))
    .map(([key, item]) => [key, stripSolutionData(item)]));
  if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
    try { return JSON.stringify(stripSolutionData(JSON.parse(value))); } catch { /* ordinary text */ }
  }
  return value;
}
const QUESTION_FIELDS = [
  'id','exam_id','question_number','question_type','question_text','marks','options',
  'diagram_config','figure_urls','has_figures','has_tables','data_type','graph_description',
  'table_data','generated_diagram_url','diagram_type','circuit_type','circuit_description',
  'needs_diagram','question_latex','has_math','scenario_context','command_verb',
  'parent_question_number','root_question_number','topic_tag','profile_id','insert_figures',
];
export function studentQuestion(question: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(QUESTION_FIELDS.filter(key => key in question)
    .map(key => [key, stripSolutionData(question[key])]));
}
