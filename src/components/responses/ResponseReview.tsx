import { MathRenderer } from '@/components/MathRenderer';
import { ResponseInput } from './ResponseInput';
import { ResponseResources } from './ResponseResources';
import { readResponseAnswer, responseKeyLines, responseTargetLabel, type ResponseQuestionView } from '@/lib/response-view';
export function ResponseReview({question,answerText,solutionsReleased}:{question:ResponseQuestionView;answerText?:string|null;solutionsReleased:boolean}) {
  if (!question.response_definition) return null;
  const definition=question.response_definition;
  return <div className="space-y-4">
    <ResponseResources resources={question.response_resources}/>
    <div><h3 className="mb-2 font-medium">Your answer</h3><ResponseInput questionId={question.id} definition={definition} value={readResponseAnswer(question,answerText)} disabled/></div>
    {solutionsReleased && question.response_result && <section aria-label="Marks by part" className="space-y-2">{question.response_result.units.map(unit => <div key={unit.unitId} className="rounded-md border border-border p-3"><p className="font-medium">{responseTargetLabel(definition,unit.targetIds)} — {unit.score}/{unit.maxMarks}</p><MathRenderer content={unit.feedback}/></div>)}</section>}
    {solutionsReleased && question.response_key && <section className="rounded-md border border-border bg-muted/30 p-3"><h3 className="mb-2 font-medium">Mark scheme</h3>{responseKeyLines(definition,question.response_key).map((line,index) => <MathRenderer key={index} content={line}/>)}</section>}
  </div>;
}
