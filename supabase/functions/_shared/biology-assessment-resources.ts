/** Scientific inputs belong to the saved question. Never invent them in a renderer. */
export const BIOLOGY_DIAGRAM_TYPES = new Set([
  'animal_cell', 'plant_cell', 'bacterial_cell', 'neuron', 'heart', 'dna_helix',
  'mitosis', 'punnett_square', 'food_web', 'food_chain', 'ecological_pyramid', 'enzyme_substrate',
]);
const object = (value: unknown): Record<string, any> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
const normal = (value: unknown) => String(value ?? '').trim().toLowerCase();
const stable = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  object(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export const isBiologyDiagram = (value: unknown): boolean => BIOLOGY_DIAGRAM_TYPES.has(object(value)?.type);

/** Complete dominance, one autosomal locus only. No guessed parents or traits. */
export function monohybridCross(parent1: unknown, parent2: unknown) {
  const parents = [parent1, parent2];
  if (!parents.every(p => typeof p === 'string' && /^([a-z])\1$/i.test(p))) return null;
  const [a, b] = parents as [string, string];
  if (a[0].toLowerCase() !== b[0].toLowerCase()) return null;
  const top = [...a], side = [...b];
  const offspring = side.map(s => top.map(t => [t, s].sort((x, y) =>
    Number(y === y.toUpperCase()) - Number(x === x.toUpperCase())).join('')));
  const flat = offspring.flat();
  const dominant = flat.filter(genotype => /[A-Z]/.test(genotype)).length;
  const recessive = 4 - dominant;
  const gcd = (x: number, y: number): number => y ? gcd(y, x % y) : x;
  const divisor = gcd(dominant, recessive) || 1;
  return { top, side, offspring, dominantPercent: dominant * 25, recessivePercent: recessive * 25,
    ratio: `${dominant / divisor}:${recessive / divisor}` };
}

/** Validation-only evidence from explicit genotype notation; never used to draw a figure. */
export function statedMonohybridParents(text: string): [string, string] | null {
  if (!/\b(cross(?:ed|ing)?|mat(?:ed|ing)|breed(?:ing)?|offspring)\b/i.test(text)) return null;
  const pairs = [...text.matchAll(/\b([a-z])\1\b/gi)].map(match => match[0]);
  return pairs.length === 2 && monohybridCross(pairs[0], pairs[1]) ? [pairs[0], pairs[1]] : null;
}
const sameParents = (a: string[], b: string[]) => {
  const key = (parents: string[]) => parents.map(p => [...p].sort().join('')).sort().join('|');
  return key(a) === key(b);
};

/** Only explicit arrow notation; never a dictionary of guessed organisms. */
export function statedFoodChain(text: string): string[] | null {
  const match = text.match(/\bfood chain\s*(?:is|:)?\s*([a-z][a-z -]{0,60}(?:\s*(?:→|->)\s*[a-z][a-z -]{0,60}){1,11})(?=[.!?\n]|$)/i);
  if (!match) return null;
  const names = match[1].split(/\s*(?:→|->)\s*/).map(name => name.trim());
  return new Set(names.map(normal)).size === names.length ? names : null;
}

export interface BiologyResourceIssue {
  code: 'invalid_resource' | 'conflicting_resource_data' | 'answer_mismatch';
  detail: string;
}

export function biologyDiagramIssues(value: unknown, questionText = ''): BiologyResourceIssue[] {
  const config = object(value);
  if (!config || !isBiologyDiagram(config)) return [];
  const invalid = (detail: string): BiologyResourceIssue[] => [{code: 'invalid_resource', detail}];
  if (config.type === 'punnett_square') {
    if (config.crossType && config.crossType !== 'monohybrid') return invalid('Assessment Punnett figures currently support an explicit monohybrid cross only. Supply a validated resource for other inheritance models.');
    if (!monohybridCross(config.parent1, config.parent2)) return invalid('Punnett figure requires two explicit valid genotypes at the same locus; do not default to Aa × Aa.');
    const stated = statedMonohybridParents(questionText);
    if (stated && !sameParents(stated, [config.parent1, config.parent2])) return [{code: 'conflicting_resource_data', detail: 'The Punnett parents disagree with the cross stated in the question. Repair the resource and key together.'}];
  }
  if (config.type === 'neuron') {
    if (!['relay', 'sensory', 'motor', 'bipolar'].includes(config.variant)) return invalid('A neurone figure must specify its variant instead of defaulting to a motor neurone.');
    const mentioned = new Set([...questionText.matchAll(/\b(relay|sensory|motor|bipolar)\s+neurones?\b/gi)].map(m => m[1].toLowerCase()));
    if (mentioned.size === 1 && !mentioned.has(config.variant)) return invalid('The saved neurone variant does not match the neurone named by the question.');
  }
  if (config.type === 'food_chain' || config.type === 'food_web') {
    const organisms = config.organisms;
    if (!Array.isArray(organisms) || organisms.length < 2 || organisms.length > 12 ||
        organisms.some(o => typeof o !== 'string' || !o.trim()) || new Set(organisms.map(normal)).size !== organisms.length) {
      return invalid('Food diagrams require 2–12 distinct named organisms; no default grass/rabbit/fox scenario.');
    }
    const stated = statedFoodChain(questionText);
    if (stated && config.type === 'food_chain' && stable(stated.map(normal)) !== stable(organisms.map(normal))) {
      return [{code:'conflicting_resource_data', detail:'The saved food chain differs from the organisms/order stated in the question.'}];
    }
    if (config.type === 'food_web') {
      if (!Array.isArray(config.feedingLinks) || !config.feedingLinks.length || config.feedingLinks.some((link: any) =>
        !link || !organisms.includes(link.from) || !organisms.includes(link.to) || link.from === link.to)) {
        return invalid('A food web needs explicit valid feedingLinks from the food organism to its consumer. Do not infer links from trophic keywords.');
      }
    }
  }
  if (config.type === 'ecological_pyramid') return invalid('An ecological pyramid requires quantitative levels and its own validated renderer; a generic food web is not a pyramid.');
  return [];
}

/** Explicit saved figures only. Invalid legacy figures must not become different, invented figures. */
export function savedBiologyDiagram(question: {diagram_config?: unknown; diagramConfig?: unknown; question_text?: unknown}) {
  const configs = [question.diagram_config, question.diagramConfig].filter(isBiologyDiagram) as Record<string, any>[];
  if (!configs.length) return null;
  if (configs.length > 1 && stable(configs[0]) !== stable(configs[1])) return null;
  const config = configs[0];
  return biologyDiagramIssues(config, String(question.question_text ?? '')).length ? null : config;
}

/** Optional public INPUT contract carried inside chart_data/diagram_config.
 * The result is checked against the private key; it is never added to the stimulus. */
export function biologyCalculationResult(resource: unknown): {value?: number; issue?: string} {
  const r = object(resource), c = object(r?.biology_calculation);
  if (!c) return {};
  if (c.kind === 'monohybrid_percentage') {
    const cross = monohybridCross(c.parent1, c.parent2);
    if (!cross || !['dominant', 'recessive'].includes(c.target)) return {issue: 'Genetic calculation needs explicit same-locus parent genotypes and target dominant/recessive.'};
    if (r?.type === 'data_table') {
      const cells = Array.isArray(r.rows) ? r.rows.flat().map(String) : [];
      if (cells.filter(value => /^([a-z])\1$/i.test(value.trim())).length !== 2 ||
          /offspring|phenotyp(?:e|ic) ratio|percentage/i.test(String(r.headers)) || cells.some(value => /\d\s*%/.test(value))) {
        return {issue: 'A parental-genotype stimulus must contain given parents, not completed offspring, ratios or percentages.'};
      }
      const remaining = [...cells];
      for (const parent of [c.parent1, c.parent2]) {
        const index = remaining.findIndex(value => value.trim() === parent);
        if (index < 0) return {issue: 'The parental genotype table must contain both declared parent genotypes as given data.'};
        remaining.splice(index, 1);
      }
    }
    return {value: c.target === 'dominant' ? cross.dominantPercent : cross.recessivePercent};
  }
  if (c.kind === 'biomass_transfer') {
    if (r?.type !== 'data_table' || !Array.isArray(r.headers) || !Array.isArray(r.rows) ||
        !Number.isInteger(c.organismColumn) || !Number.isInteger(c.valueColumn) ||
        c.organismColumn < 0 || c.valueColumn < 0 || c.organismColumn === c.valueColumn ||
        c.organismColumn >= r.headers.length || c.valueColumn >= r.headers.length ||
        !normal(c.from) || !normal(c.to) || normal(c.from) === normal(c.to) || !normal(c.unit)) {
      return {issue: 'Biomass transfer requires a data table, distinct source/recipient organisms, column indices and one common biomass unit.'};
    }
    const unit = r.units?.[c.valueColumn] ?? String(r.headers[c.valueColumn]).match(/\(([^)]+)\)\s*$/)?.[1];
    if (normal(unit) !== normal(c.unit)) return {issue: 'The biomass calculation unit must match the unit printed in the selected table column.'};
    const find = (name: string) => r.rows.filter((row: any) => Array.isArray(row) && normal(row[c.organismColumn]) === normal(name));
    const from = find(c.from), to = find(c.to);
    if (from.length !== 1 || to.length !== 1) return {issue: 'The biomass calculation names must each resolve to one table row.'};
    const number = (v: unknown) => typeof v === 'number' ? v : typeof v === 'string' && /^[+-]?\d+(?:\.\d+)?$/.test(v.trim()) ? Number(v) : NaN;
    const source = number(from[0][c.valueColumn]), recipient = number(to[0][c.valueColumn]);
    if (!Number.isFinite(source) || !Number.isFinite(recipient) || source <= 0 || recipient < 0 || recipient > source) return {issue: 'Biomass transfer needs finite compatible measurements: source > 0 and 0 ≤ transferred biomass ≤ source.'};
    return {value: recipient / source * 100};
  }
  return {issue: 'Unsupported Biology calculation contract.'};
}

/** Accept normal answer prose and workings; do not require one magic field label. */
export function readPercentageResult(answer: string, target?: string): number | null {
  const text = answer.replace(/\\%/g, '%').replace(/[$*]/g, '');
  const number = '([+-]?\\d+(?:\\.\\d+)?)\\s*%';
  const labelled = [...text.matchAll(new RegExp('(?:final\\s+(?:answer|result)|answer|result)\\s*(?::|=|is)?\\s*' + number, 'gi'))];
  const equations = [...text.matchAll(new RegExp('=\\s*' + number, 'g'))];
  if (labelled.length) {
    const values = new Set(labelled.map(m => Number(m[1])));
    return values.size === 1 ? [...values][0] : null;
  }
  if (equations.length) return Number(equations[equations.length - 1][1]);
  if (target === 'dominant' || target === 'recessive') {
    const targetValue = text.match(new RegExp(number + '\\s*(?:of (?:the )?offspring (?:are|will be) )?' + target, 'i'));
    if (targetValue) return Number(targetValue[1]);
  }
  const values = new Set([...text.matchAll(new RegExp(number, 'g'))].map(m => Number(m[1])));
  return values.size === 1 ? [...values][0] : null;
}

/** Narrow, deterministic checks for the reported cross/calculation failures. */
export function biologyQuestionIssues(question: {question_text?: unknown; correct_answer?: unknown}, resource: unknown, groupChain?: string[], requireInputs = false): BiologyResourceIssue[] {
  const issues: BiologyResourceIssue[] = [];
  const text = String(question.question_text ?? ''), key = typeof question.correct_answer === 'string' ? question.correct_answer : '';
  const r = object(resource), c = object(r?.biology_calculation);
  const stated = statedMonohybridParents(text);
  const chain = statedFoodChain(text) ?? groupChain;
  if (chain && c?.kind === 'biomass_transfer' && Array.isArray(r?.rows)) {
    const names = new Set(chain.map(normal));
    if (!names.has(normal(c.from)) || !names.has(normal(c.to)) || r.rows.some((row: any) => !Array.isArray(row) || !names.has(normal(row[c.organismColumn])))) {
      issues.push({code:'conflicting_resource_data', detail:'The biomass table/calculation must use the organisms from this question group’s stated food chain.'});
    }
  }
  const expectedPercentage = stated && /\bexpected\b/i.test(text) && /\bpercent(?:age)?\b/i.test(text) && /\b(calculate|determine|work out)\b/i.test(text);
  const biomassTransfer = /\bbiomass\b/i.test(text) && /\b(percentage|efficiency)\b/i.test(text) && /\btransfer(?:red)?\b/i.test(text) && /\b(calculate|determine|work out)\b/i.test(text);
  if (requireInputs && ((expectedPercentage && c?.kind !== 'monohybrid_percentage') || (biomassTransfer && c?.kind !== 'biomass_transfer'))) {
    issues.push({code: 'invalid_resource', detail: 'This calculation needs a biology_calculation input contract in its saved resource, with a matching private Final answer: N% key. Preserve the task and provide its required given data.'});
  }
  if (stated) {
    if (c?.kind === 'monohybrid_percentage' && !sameParents(stated, [String(c.parent1), String(c.parent2)])) {
      issues.push({code: 'conflicting_resource_data', detail: 'The calculation parents disagree with the genotypes stated in the task.'});
    }
    const cross = monohybridCross(...stated)!;
    // Only a labelled dominant:recessive phenotype ratio, not an arbitrary worked fraction.
    const ratio = key.match(/\b(\d+)\s+dominant\s*:\s*(\d+)\s+recessive\b/i) ?? key.match(/phenotyp(?:e|ic)\s+ratio\s*(?:is|of|=|:)?\s*(\d+)\s*:\s*(\d+)/i);
    if (ratio && (Number(ratio[1]) + Number(ratio[2]) === 0 ||
      Math.abs(Number(ratio[1]) / (Number(ratio[1]) + Number(ratio[2])) * 100 - cross.dominantPercent) > .001)) {
      issues.push({code: 'answer_mismatch', detail: 'The private dominant:recessive phenotype ratio disagrees with the stated monohybrid cross.'});
    }
  }
  const result = biologyCalculationResult(resource);
  if (result.issue) issues.push({code: 'invalid_resource', detail: result.issue});
  if (c && /(?:final\s+answer|phenotyp(?:e|ic)\s+ratio|\banswer\s*(?:is|:))\s*[^.\n]*\d/i.test([text, r?.caption, r?.footnote].join('\n'))) {
    issues.push({code: 'invalid_resource', detail: 'A student-facing calculation stem/caption contains a worked answer or phenotype ratio.'});
  }
  if (result.value !== undefined && key) {
    const answer = readPercentageResult(key, c?.target);
    if (answer === null || Math.abs(answer - result.value) > 0.05) {
      issues.push({code: 'answer_mismatch', detail: 'Private calculation key needs an unambiguous final percentage agreeing with the saved inputs (within 0.05 percentage points). Include Final answer: N% with the working and marking points in the private key.'});
    }
  }
  return issues;
}

export const BIOLOGY_RESOURCE_RULES = `BIOLOGY ASSESSMENT RESOURCES:
The frontend renders SAVED resources only. Never rely on keyword detection to draw a figure. Follow each planned resource type; a food-chain picture does not replace a data table. Keep the same organisms, values, units and parent genotypes throughout a question group and its private keys.
Use chart_data type data_table for required tables. Include finite measurements and column units for calculations. Show no calculated answer, completed cross or phenotype ratio in the student-facing resource or caption. Keep worked solutions in correct_answer.
Punnett scaffolds, only where explicitly needed: diagram_config={type:"punnett_square",crossType:"monohybrid",parent1:"Bb",parent2:"bb",showGametes:false}. Use the ACTUAL parents; never default to two heterozygotes. The assessment grid is blank. Where the plan requires a table, retain a table of GIVEN parental genotypes/data instead of replacing it with a Punnett figure.
For a direct monohybrid percentage calculation, add biology_calculation to that table/figure: {kind:"monohybrid_percentage",parent1:"Bb",parent2:"bb",target:"dominant"}. For a biomass-transfer percentage from a table, add {kind:"biomass_transfer",from:"the exact source row name",to:"the exact recipient row name",organismColumn:0,valueColumn:1,unit:"g/m²"}, using the ACTUAL table columns and common unit. These objects contain inputs only. For either contract end the PRIVATE key with Final answer: N% (round to at least one decimal if needed), plus working and marking points. Never put the calculated result in a public field.
A neurone figure must specify variant relay/sensory/motor/bipolar and support the task. Describing a relay neurone's function needs no generic motor-neurone figure. Food chains use an explicit organisms array IN FEEDING ORDER; food webs additionally need feedingLinks:[{from:"food organism",to:"consumer"}]. Do not invent or substitute organisms. Avoid an ecological_pyramid diagram until a quantitative pyramid renderer is supported.`;
