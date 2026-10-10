import type {PaperPlan,PlannedPart} from './biology-paper-contract.ts';
import type {UnifiedPart} from './ocr-alevel-biology-paper3-contract.ts';

/** Prompt example only. Never inject these illustrative counts into a question
 * or treat them as recovered data. Actual model output must pass every gate. */
export function chiSquaredTableShapeExample(id?:string) {
  return {type:'data_table',...(id?{id}:{}),
    headers:['Category','Observed count (O)','Expected count (E)'],
    rows:[['Category A',18,20],['Category B',22,20]],
    caption:'Sampled counts and fixed-model predictions'};
}

/** Runtime schema guidance, outside the frozen versioned paper instructions.
 * Explicit saved course/component routing keeps every other paper unchanged. */
export function ocrPaper3StatisticsInstructions(plan:PaperPlan|null|undefined,parts:readonly PlannedPart[],field:'chart_data'|'diagram_config'):string {
  if(plan?.courseId!=='ocr_alevel_biology_a_h420'||plan.paperId!=='paper_3')return '';
  return parts.filter(p=>(p as UnifiedPart).unifiedSkill==='statistical_analysis').map(p=>
    `CHI-SQUARED COUNT-TABLE SHAPE Q${p.questionNumber}: ${field} must be a data_table containing category COUNT DATA, not a table of statistical instructions. `+
    `Do not put the hypothesis, formula, df, significance or critical value in headers; state them as text in this part's context or rendered caption. `+
    `The base shape uses headers ["Category","Observed count (O)","Expected count (E)"] and 2–11 non-empty category rows. Extra model columns must be clearly separate; every row has exactly one scalar cell per header. `+
    `Observed counts are non-negative whole numbers; expected counts are numbers at least five; the two column totals agree. `+
    `Example ${field}: ${JSON.stringify(chiSquaredTableShapeExample(p.resourceId))}. This illustrates JSON shape only; these are not recovered measurements and must not be copied as another question's data. `+
    `Write original synthetic counts appropriate to this investigation, or retain an existing recoverable dataset exactly during repair. If the original data is absent, rewrite the complete parent group as new synthetic material and recalculate every dependent private key. `+
    `When only the givens or private key need repair, retain the valid table including O/E headings, model-ratio columns and a verified final Total row; do not replace it with the illustrative example. `+
    `Use a fixed model specified independently of these observations, not Hardy-Weinberg allele frequencies fitted from this same sample. `+
    `State a substantive null hypothesis (H₀), χ² = Σ((O − E)²/E), O/E definitions, 5% significance, numeric df = category count minus one and the matching numeric critical value. `+
    `Return a separately stated Calculate task requiring working and an evidence-based conclusion, with a matching PRIVATE final statistic and method/conclusion credit. `+
    `Do not leave rows empty, replace counts with hypothesis/critical-value text, or put computed statistics, working or conclusions in the public resource.`
  ).join('\n');
}
