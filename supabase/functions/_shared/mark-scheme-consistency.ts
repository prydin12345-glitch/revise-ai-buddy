/** Narrow private-key contradictions, not a scientific or arithmetic verifier.
 * Only compares explicitly named final quantities against their own working.
 * Never evaluates model-provided code, algebra or an arbitrary expression. */
export interface MarkSchemeConsistencyIssue {
  code: 'contradictory_mark_scheme';
  detail: string;
}
const numberPattern = '[-+]?\\d+(?:\\.\\d+)?(?:\\s*(?:×|\\*|\\\\times)\\s*10\\s*(?:\\^?\\s*\\{?\\s*[-+]?\\d+\\s*\\}?)|[eE][-+]?\\d+)?';
const unitPattern = '(?:kg|mol|Hz|Pa|Wb|Bq|Gy|Sv|eV|[gmsAKNJWTVCFΩ])(?:\\s*(?:\\^?\\s*[-+]?\\d+))?';
const superscripts:Record<string,string>={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+'};
function literalText(raw: string): string {
  return raw.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g,run=>'^'+[...run].map(char=>superscripts[char]).join(''))
    .replace(/\\(?:mathrm|text|mathit)\s*\{([^{}]*)\}/g,'$1')
    .replace(/\\[,;! ]/g,' ').replace(/[$]/g,'').replace(/[−–]/g,'-');
}
function numeric(literal:string):{value:number;rounding:number}|null{
  const clean=literal.replace(/[{} \t]/g,'').replace(/\\times|×/g,'*');
  const match=clean.match(/^([-+]?\d+(?:\.\d+)?)(?:(?:\*10\^?)([-+]?\d+)|[eE]([-+]?\d+))?$/);
  if(!match)return null;
  const exponent=Number(match[2]??match[3]??0), mantissa=Number(match[1]),value=mantissa*10**exponent;
  if(!Number.isFinite(value)||Math.abs(exponent)>100)return null;
  const decimals=match[1].split('.')[1]?.length??0;
  return {value,rounding:0.5*10**(exponent-decimals)};
}
type Quantity={key:string;unit:string;literal:string;value:number;rounding:number};
function quantities(text:string):Quantity[]{
  const out:Quantity[]=[];
  const assignments=new RegExp('(?:^|[;\\n])\\s*(?:final(?:\\s+answer)?\\s*[:=]\\s*)?([A-Za-z][A-Za-z0-9_{}^/ ]{0,30}?)\\s*(?:=|:)\\s*(?:±\\s*)?('+numberPattern+')\\s*('+unitPattern+')?','g');
  for(const match of text.matchAll(assignments)){
    const label=match[1].trim(), parsed=numeric(match[2]);
    if(!parsed||label.split(/\s+/).length>4)continue;
    const before=text.slice(Math.max(0,match.index!-80),match.index);
    if(/\b(?:alternative|example|ECF|carried.forward|instead|if)\b/i.test(before))continue;
    out.push({key:label.includes(' ')?label.toLowerCase():label,unit:(match[3]??'').replace(/\s+/g,''),literal:match[2],...parsed});
  }
  return out;
}
function uncertainty(text:string):{literal:string;value:number;rounding:number}|null{
  const match=text.match(new RegExp('\\b(?:absolute\\s+)?uncertainty\\s*(?:(?:is|of|=|:)\\s*)?(?:±|\\\\pm)\\s*('+numberPattern+')','i'));
  if(!match)return null;
  const n=numeric(match[1]);return n?{literal:match[1],...n}:null;
}
export function markSchemeConsistencyIssues(raw:unknown):MarkSchemeConsistencyIssue[]{
  const part=raw&&typeof raw==='object'?raw as Record<string,unknown>:{correct_answer:raw};
  const answer=['correct_answer','expected_answer','answer','model_answer'].map(key=>part[key]).find(value=>typeof value==='string'&&value.trim()) as string|undefined;
  if(!answer)return [];
  const text=literalText(answer), marker=text.search(/\b(?:working(?:\s+out)?|method|mark(?:ing)?\s+scheme)\s*[:\n]/i);
  const scheme=['mark_scheme','marking_scheme','rubric'].map(key=>part[key]).find(value=>typeof value==='string'&&value.trim()) as string|undefined;
  const finalText=marker>=0?text.slice(0,marker):text;
  const workingText=marker>=0?text.slice(marker):scheme?literalText(scheme):'';
  if(!workingText)return [];
  const issues:MarkSchemeConsistencyIssue[]=[];
  const finals=quantities(finalText), working=quantities(workingText);
  for(const final of finals){
    const matching=working.filter(q=>q.key===final.key&&q.unit===final.unit);
    const last=matching.at(-1);
    if(last&&Math.abs(last.value-final.value)>Math.max(final.rounding,last.rounding,Math.abs(final.value)*1e-10)){
      issues.push({code:'contradictory_mark_scheme',detail:'The private final answer for '+final.key+' conflicts with its own numerical working. Recalculate the task, final answer, units and marking guidance together.'});
    }
  }
  const initialUncertainty=uncertainty(finalText), workedUncertainty=uncertainty(workingText);
  if(initialUncertainty&&workedUncertainty&&Math.abs(initialUncertainty.value-workedUncertainty.value)>Math.max(initialUncertainty.rounding,workedUncertainty.rounding)){
    issues.push({code:'contradictory_mark_scheme',detail:'The private final uncertainty conflicts with the uncertainty in its own working. Recalculate the absolute/percentage uncertainty and accepted range together.'});
  }
  if(initialUncertainty){
    const range=workingText.match(new RegExp('\\baccept(?:ed)?\\s*(?:(?:answers?|range)\\s*(?:from|of)?\\s*)?[(:]?\\s*±?\\s*('+numberPattern+')\\s*(?:to|-)\\s*±?\\s*('+numberPattern+')','i'));
    const low=range&&numeric(range[1]),high=range&&numeric(range[2]);
    if(low&&high&&low.value<=high.value&&(initialUncertainty.value<low.value||initialUncertainty.value>high.value)){
      issues.push({code:'contradictory_mark_scheme',detail:'The private final uncertainty is outside its own explicitly accepted uncertainty range. Recalculate the final value and acceptance guidance together.'});
    }
  }
  return issues;
}
