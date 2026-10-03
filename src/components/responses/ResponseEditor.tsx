import { MathRenderer } from '@/components/MathRenderer';
import { ResponseInput } from './ResponseInput';
import { ResponseResources } from './ResponseResources';
import type { ResponseQuestionView } from '@/lib/response-view';
import type { useResponseDrafts } from '@/hooks/useResponseDrafts';
export function ResponseEditor({question,drafts,disabled=false}:{question:ResponseQuestionView&{question_text:string};drafts:ReturnType<typeof useResponseDrafts>;disabled?:boolean}) {
  const session=drafts.get(question.id);
  if(!question.response_definition)return null;
  return <div className="space-y-4">
    <MathRenderer content={question.question_text}/>
    <ResponseResources resources={question.response_resources}/>
    {session ? <ResponseInput questionId={question.id} definition={question.response_definition} value={session.response} onChange={value=>drafts.update(question.id,value)} disabled={disabled || session.status==='conflict'}/> : <p role="status">Loading your answer…</p>}
    {!disabled && session && <div aria-live="polite" className="text-sm text-muted-foreground">
      {session.status==='saving'||session.status==='dirty'?'Saving…':session.status==='saved'?'Saved':session.status==='conflict'?'This answer changed in another session. Your local answer is shown above.':'Your answer has not been saved. Retry before leaving.'}
      {drafts.error(question.id) && <p role="alert">{drafts.error(question.id)}</p>}
      {session.status==='error' && <button type="button" className="ml-2 min-h-11 underline" onClick={()=>void drafts.flush(question.id).catch(()=>{})}>Retry saving</button>}
      {session.status==='conflict' && <button type="button" className="ml-2 min-h-11 underline" onClick={()=>void drafts.useSaved(question.id).catch(()=>{})}>Use saved answer</button>}
    </div>}
  </div>;
}
