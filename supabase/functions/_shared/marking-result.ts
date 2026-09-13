/** A transport/model failure is not evidence of an incorrect student answer. */
export function validatedGrade(value: unknown, marks: number): {score:number;feedback:string;isCorrect:boolean;methodMarks?:number;accuracyMarks?:number;correctAnswers?:unknown} {
  const v=value as Record<string,unknown>;
  if (!v || typeof v.score!=='number' || !Number.isFinite(v.score) || v.score<0 || v.score>marks ||
    typeof v.feedback!=='string' || !v.feedback.trim() || typeof v.isCorrect!=='boolean') {
    throw new Error('Invalid marking response');
  }
  for(const key of ['methodMarks','accuracyMarks']) {
    if(v[key]!==undefined && (typeof v[key]!=='number' || !Number.isFinite(v[key]) || Number(v[key])<0 || Number(v[key])>marks))
      throw new Error('Invalid marking breakdown');
  }
  return {...v,score:v.score,feedback:v.feedback,isCorrect:v.score===marks} as ReturnType<typeof validatedGrade>;
}
