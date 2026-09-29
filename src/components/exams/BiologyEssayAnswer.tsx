import { useId } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { parseBiologyEssayAnswer, serializeBiologyEssayAnswer } from '@/lib/biology-essay';
export function BiologyEssayAnswer({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}) {
 const id=useId(),answer=parseBiologyEssayAnswer(value);
 return <div className="space-y-3"><fieldset disabled={disabled} className="flex flex-wrap gap-4"><legend className="mb-2 text-sm font-medium">Choose ONE essay title</legend>{(['A','B'] as const).map(choice=><label key={choice} className="inline-flex items-center gap-2"><input type="radio" name={id} checked={answer.choice===choice} onChange={()=>onChange(serializeBiologyEssayAnswer(choice,answer.text))}/>Title {choice}</label>)}</fieldset>
 <Textarea aria-label="Your essay" rows={18} value={answer.text} disabled={disabled||!answer.choice} placeholder={answer.choice?'Write your essay here.':'Choose title A or B to begin.'} onChange={e=>answer.choice&&onChange(serializeBiologyEssayAnswer(answer.choice,e.target.value))}/></div>;
}
