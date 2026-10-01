import { coerceMcqOptions, canonicalMcqAnswer, readAnswerKey } from './model-question-normalization.ts';

const normalise = (value:string):string => value.trim().replace(/\s+/g,' ').toLowerCase();

/** Validate the saved key before any marking calls. Never guess an answer from
 * explanations or award a mark for matching two invalid/empty strings. */
export function singleChoiceKey(question:unknown):{options:string[];index:number;letter:string} {
  const options=coerceMcqOptions(question)??[];
  const values=options.map(normalise);
  if(options.length!==4||values.some(v=>!v||/^[a-d]$/.test(v))||new Set(values).size!==4)
    throw new Error('Single-select question needs four distinct choices; use descriptive option text, not bare A-D labels.');
  const answer=canonicalMcqAnswer(readAnswerKey(question),options);
  const index=values.indexOf(normalise(answer));
  if(index<0)throw new Error('Single-select question has no unambiguous matching private key.');
  return {options,index,letter:String.fromCharCode(65+index)};
}

/** A selected letter or exact saved option earns one mark; multiple choices,
 * blanks and unrecognised responses earn zero. No model call is needed. */
export function markSingleChoice(question:unknown,answer:unknown) {
  const key=singleChoiceKey(question);
  const text=typeof answer==='string'?answer.trim():'';
  const letter=/^[A-D]$/i.test(text)?text.toUpperCase().charCodeAt(0)-65:-1;
  const selected=letter>=0?letter:key.options.map(normalise).indexOf(normalise(text));
  const isCorrect=selected===key.index;
  return {score:isCorrect?1:0,isCorrect,
    feedback:isCorrect?'Correct!':`${text?'Incorrect.':'No answer provided.'} Correct answer: ${key.letter}) ${key.options[key.index]}`};
}
