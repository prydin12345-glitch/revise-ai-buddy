import {canonicalMcqAnswer, coerceMcqOptions, mcqComparable} from '../../supabase/functions/_shared/model-question-normalization';

/** Display only an already released private key; never choose among ambiguous options. */
export function releasedMcqKeyIndex(answer: unknown, rawOptions: unknown): number | null {
  if (typeof answer !== 'string' || !answer.trim()) return null;
  const options=coerceMcqOptions({options:rawOptions});
  if (!options || options.length<3 || options.some(option=>!option.trim())) return null;
  const identities=options.map(mcqComparable);
  if (new Set(identities).size!==options.length) return null;
  const canonical=canonicalMcqAnswer(answer,options);
  const index=identities.indexOf(mcqComparable(canonical));
  return index<0?null:index;
}
