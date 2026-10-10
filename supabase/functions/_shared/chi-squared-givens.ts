import {flattenAnswerKey} from './model-question-normalization.ts';

export const CHI_SQUARED_5_PERCENT = [0,3.841,5.991,7.815,9.488,11.070,12.592,14.067,15.507,16.919,18.307];
const NUMBER = String.raw`[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?`;
const NUMBER_END = String.raw`(?!\d|\.\d|e[+-]?\d)`;
const DF = String.raw`(?:degrees? of freedom|\bdf\b)`;
const LEVEL = String.raw`(?:significance(?: level)?|significant(?: level)?|alpha|α)`;
const unique = (values:number[]) => [...new Set(values)];

/** Representation changes only. No missing values or expected results are
 * inferred. Whitespace/markup must not change a mathematical relationship. */
function mathText(text:string):string {
  return text.replace(/<sup>\s*2\s*<\/sup>/gi,'^2').replace(/<[^>]*>/g,' ')
    .replace(/&(?:nbsp|thinsp);/gi,' ').replace(/&minus;/gi,'-').replace(/&chi;/gi,'χ')
    .replace(/&(?:Sigma|sum);/g,'Σ').replace(/&alpha;/gi,'α').replace(/&#178;/g,'²')
    .normalize('NFKC').replace(/[−–]/g,'-').replace(/\\(?:left|right)\b/g,'')
    .replace(/\^\s*\{\s*2\s*\}/g,'^2').replace(/\\chi\s*\^\s*2/gi,'χ2')
    .replace(/(?:χ|\bX)\s*\^?\s*2\b/gi,'χ2').replace(/\bchi[- ]squared?\b/gi,'χ2')
    .replace(/\\alpha\b/g,'α').replace(/\\sum\b/g,'Σ')
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,'($1)/($2)')
    .replace(/\\(?:text|mathrm)\s*\{([^{}]+)\}/g,'$1')
    .replace(/\\[%]/g,'%').replace(/\*\*/g,'').replace(/[${}]/g,'').replace(/\s+/g,' ').trim();
}
const values = (text:string,pattern:string):number[] => [...text.matchAll(new RegExp(pattern,'gi'))].map(m=>Number(m[1]));
const criticalQualifierBefore=(text:string,index:number)=>new RegExp(String.raw`\bcritical\s+(?:χ2\s+)?value\b(?:(?![;!?]|\.\s)[\s\S]){0,160}${NUMBER}\s*%?\s*$`,'i').test(text.slice(0,index));

export interface ChiSquaredGivens {
  degreesOfFreedom:number[];
  criticalValues:number[];
  significanceLevels:number[];
  missing:string[];
}

/** Bind numbers to their actual labels/assignments, including qualifiers.
 * Never select a nearby number because it equals the expected critical value.
 * Preserve multiple claims so conflicting givens cannot be silently ignored. */
export function parseChiSquaredGivens(source:string):ChiSquaredGivens {
  const text=mathText(source);
  const symbolicDf=String.raw`(?:(?:[kn]|(?:number of )?categories)\s*-\s*1\s*=\s*)?`;
  const forwardDf=String.raw`${DF}\s*(?:\([^()]*\)\s*)?(?:(?:of|is|are|=|:)\s*)?${symbolicDf}(${NUMBER})${NUMBER_END}(?!%)`;
  const degreesOfFreedom=unique([
    ...[...text.matchAll(new RegExp(forwardDf,'gi'))]
      // In "critical value for 1 df is 3.841", the 1 belongs to df and
      // the 3.841 belongs to critical value; it is not a second df claim.
      .filter(m=>!criticalQualifierBefore(text,m.index!))
      .map(m=>Number(m[1])),
    ...values(text,String.raw`(${NUMBER})\s*${DF}`),
  ]);
  const threshold=String.raw`(?:(?:p|alpha|α)\s*=\s*${NUMBER}|${LEVEL}\s*(?:of|is|=|:)?\s*${NUMBER}\s*%?|${NUMBER}\s*%\s*(?:significance(?: level)?)?)`;
  const dfQualifier=String.raw`(?:${NUMBER}\s*${DF}|${DF}\s*=\s*${NUMBER})`;
  const qualifier=String.raw`(?:${dfQualifier}|${threshold})`;
  // A parenthesis can contain both labelled qualifiers, e.g.
  // "critical value (for df=1, α=0.05): 3.84". Consume only explicit
  // df/threshold declarations; the result still follows the closing bracket.
  const prefixedQualifier=String.raw`(?:(?:at|for|with)\s+(?:the\s+)?)?${qualifier}`;
  const qualifierList=String.raw`${prefixedQualifier}(?:\s*(?:,|;|\band\b)\s*${prefixedQualifier})*`;
  const qualifiers=String.raw`(?:(?:\(\s*${qualifierList}\s*\)|(?:at|for|with|and)\s+(?:the\s+)?${qualifier})\s*)*`;
  const criticalValues=unique(values(text,String.raw`\bcritical\s+(?:χ2\s+)?value\s*${qualifiers}(?:(?:of|is|=|:)\s*)?(${NUMBER})${NUMBER_END}(?!%|\s*${DF})`));
  const levels:number[]=[];
  const levelPatterns=[
    String.raw`${LEVEL}\s*(?:(?:of|is|=|:|at)\s*)?(?:(?:p|alpha|α)\s*=\s*)?(${NUMBER})\s*(%)?`,
    String.raw`(${NUMBER})\s*(%)?\s*(?:significance(?: level)?|significant(?: level)?|alpha|α)`,
    String.raw`\bp\s*=\s*(${NUMBER})\s*(%)?`,
    String.raw`\bcritical\s+(?:χ2\s+)?value\s*\(\s*(${NUMBER})\s*(%)\s*\)`,
  ];
  for(const [index,pattern] of levelPatterns.entries())for(const m of text.matchAll(new RegExp(pattern,'gi'))) {
    // "critical value at 5% significance level is 3.841" states one
    // threshold and one critical value, not significance levels 5% and 3.841.
    if(index===0&&criticalQualifierBefore(text,m.index!))continue;
    levels.push(Number(m[1])/(m[2]?100:1));
  }
  const significanceLevels=unique(levels);
  // The formula must supply the sum of squared observed-minus-expected
  // differences divided by expected counts, not just a named test/statistic.
  const formula=/Σ\s*(?:[({]\s*)+O\s*-\s*E\s*(?:[)}]\s*)+\^?2\s*(?:[)}]\s*)*\/\s*[(]?\s*E\b/i.test(text);
  const paired=/\bO\s+and\s+E\s+(?:are|represent|denote)\s+(?:the\s+)?observed\s+and\s+expected\s+(?:counts|frequencies|values)(?:\s*,)?\s+respectively\b/i.test(text);
  const definition=(symbol:string,word:string)=>paired||new RegExp(String.raw`(?:\b${symbol}\b\s*(?:(?:=|:|,|-|is|represents|denotes|stands for)\s*)?(?:the\s+)?${word}\b|\b${word}(?:\s+(?:counts?|frequenc(?:y|ies)|values?))?\s*\(?${symbol}\b)`,'i').test(text);
  const hypothesisLabel=String.raw`(?:\bnull hypothesis(?:\s*\(\s*H\s*_?\s*0\s*\))?|\bH\s*_?\s*0)`;
  const hypotheses=[...text.matchAll(new RegExp(String.raw`${hypothesisLabel}\s*(?:is|:|=|states(?: that)?|that)\s*([^.;!?]+)`,'gi'))];
  const suppliedHypothesis=hypotheses.some(m=>/[a-z]{2,}/i.test(m[1])&&
    !/^(?:use\b|χ2\b|Σ|significance\b|degrees? of freedom\b|critical value\b|[OE]\s*[:=])/i.test(m[1]));
  const checks:[string,boolean][]=[
    ['chi-squared formula',formula],['O = observed definition',definition('O','observed')],
    ['E = expected definition',definition('E','expected')],
    ['null hypothesis',suppliedHypothesis],
    ['numeric significance level',significanceLevels.length>0],
    ['numeric degrees of freedom',degreesOfFreedom.length>0],
    ['numeric critical value',criticalValues.length>0],
  ];
  return {degreesOfFreedom,criticalValues,significanceLevels,missing:checks.filter(([,present])=>!present).map(([name])=>name)};
}

/** Use the same lossless private-key normalizer as generation/repair. Only
 * explicit result labels count; unrelated method/critical/mark numbers do not.
 * Conflicting final values remain visible to the numerical gate. */
export function chiSquaredFinalStatistics(key:unknown):number[] {
  const text=mathText(flattenAnswerKey(key));
  const results:number[]=[];
  const isThreshold=(index:number)=>/critical\s+(?:value\s+)?(?:of\s+)?$/i.test(text.slice(Math.max(0,index-40),index).trim());
  const label=String.raw`(?:\b(?:final\s+)?statistic|χ2|\banswer)`;
  for(const m of text.matchAll(new RegExp(String.raw`${label}\s*(?:(?:is|=|:)\s*)(${NUMBER})${NUMBER_END}(?!\s*[+*/^]|\s*-\s*\d)`,'gi'))) {
    // "critical value of χ² = ..." is a threshold, not the calculated result.
    if(isThreshold(m.index!))continue;
    results.push(Number(m[1]));
  }
  // A worked equality may end with its explicit final result. Do not parse
  // the first term of "χ² = 0.1 + 0.1 = 0.2" as the final statistic.
  for(const m of text.matchAll(new RegExp(String.raw`${label}\s*(?:=|:)\s*[\d\s.()+*/^ΣOEe-]{1,250}\s*=\s*(${NUMBER})${NUMBER_END}(?!\s*[+*/^]|\s*-\s*\d)`,'gi')))if(!isThreshold(m.index!))results.push(Number(m[1]));
  return unique(results);
}

const isCount = (value:unknown):boolean =>
  (typeof value==='number'||typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))&&Number.isFinite(Number(value));
/** Ratio/percentage/probability columns describe the model, not counts. */
const NOT_COUNT_HEADER=/\b(?:ratios?|proportions?|percent(?:age)?s?|probabilit(?:y|ies)|fractions?)\b|%/i;
// Column names start with a count label/symbol. A sentence mentioning both
// observed and expected frequencies (e.g. a hypothesis) is not two columns.
const header=(word:string,symbol:string)=>new RegExp(String.raw`^\s*(?:${word}\b|(?:numbers?|counts?|frequenc(?:y|ies))\s+(?:of\s+)?${word}\b|${symbol}(?:\s*$|\s*\(\s*${word}\b)|(?:numbers?|counts?|frequenc(?:y|ies))\s*\(\s*${symbol}\s*\)\s*$)`,'i');
const OBSERVED_HEADER=header('observed','O'),EXPECTED_HEADER=header('expected','E');

export interface ChiSquaredTable {
  observed:number[];
  expected:number[];
  /** Specific, public-safe reasons the table cannot support the test. */
  issues:string[];
}

/** Locate the observed/expected count columns without guessing values.
 * A model ratio column (e.g. "Expected ratio") is never treated as the
 * expected-count column. One trailing Total row is not a category; it must
 * agree exactly with the category sums. */
export function readChiSquaredTable(t:{headers:string[];rows:unknown[][]}):ChiSquaredTable {
  const issues:string[]=[];
  if(!t.rows.length)return {observed:[],expected:[],issues:['No category count rows are supplied. Put the statistical givens in context or caption, not in headers; supply at least two rows of labelled categories with separate observed and expected counts.']};
  if(t.rows.some(row=>!Array.isArray(row)))return {observed:[],expected:[],issues:['Every category count row must be an array of cells in header order. Rebuild the complete count table rather than guessing missing cells.']};
  const totalRow=(row:unknown[])=>row.some(cell=>typeof cell==='string'&&/^\s*(?:grand\s+)?totals?\s*$/i.test(cell));
  const last=t.rows[t.rows.length-1];
  const hasTotal=t.rows.length>2&&!!last&&totalRow(last);
  const rows=hasTotal?t.rows.slice(0,-1):t.rows;
  if(rows.some(totalRow))issues.push('Only one Total row is allowed, as the final row.');
  const pick=(pattern:RegExp,name:string)=>{
    const matches=t.headers.map((h,i)=>({h:String(h),i})).filter(({h})=>pattern.test(h));
    const counts=matches.filter(({h})=>!NOT_COUNT_HEADER.test(h));
    if(!counts.length){issues.push(matches.length
      ?`The ${name} column header "${matches[0].h}" describes a ratio/proportion, not counts. Add a separate column headed "${name[0].toUpperCase()+name.slice(1)} count (${name==='observed'?'O':'E'})".`
      :`No column header names an ${name} count. Head the counts column "${name[0].toUpperCase()+name.slice(1)} count (${name==='observed'?'O':'E'})".`);return -1;}
    if(counts.length>1){issues.push(`More than one ${name} count column (${counts.map(c=>`"${c.h}"`).join(', ')}). Keep exactly one.`);return -1;}
    return counts[0].i;
  };
  const oi=pick(OBSERVED_HEADER,'observed'),ei=pick(EXPECTED_HEADER,'expected');
  if(oi>=0&&oi===ei)issues.push('Observed and expected counts need separate columns.');
  if(rows.length<2)issues.push('At least two categories are needed.');
  const observed:number[]=[],expected:number[]=[];
  if(oi>=0&&ei>=0&&oi!==ei)for(const [i,row] of rows.entries()){
    const o=row[oi],e=row[ei];
    if(!isCount(o)||!Number.isInteger(Number(o))||Number(o)<0)issues.push(`Row ${i+1}: observed count must be a non-negative whole number with no units or text in the cell.`);
    if(!isCount(e))issues.push(`Row ${i+1}: expected count must be a plain number with no units, ratio or text in the cell.`);
    else if(Number(e)<5)issues.push(`Row ${i+1}: expected count is below 5; merge or redesign categories so every expected count is at least 5.`);
    observed.push(Number(o));expected.push(Number(e));
  }
  if(hasTotal&&!issues.length){
    const sum=(xs:number[])=>xs.reduce((s,x)=>s+x,0);
    if(!isCount(last[oi])||!isCount(last[ei])||Number(last[oi])!==sum(observed)||Math.abs(Number(last[ei])-sum(expected))>1e-6)issues.push('The Total row must equal the sum of the category rows.');
  }
  return {observed,expected,issues};
}
