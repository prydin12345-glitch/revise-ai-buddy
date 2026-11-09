const hasOwn = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);
import {
  extractPhysicsQuantities, normalizePhysicsMath, parsePhysicsNumber,
  parsePhysicsQuantity, parsePhysicsUnit, PHYSICS_NUMBER_PATTERN,
  physicsQuantitiesEquivalent, samePhysicsDimension, type PhysicsQuantity,
} from './physics-quantities.ts';
import {markSchemeConsistencyIssues} from './mark-scheme-consistency.ts';
import {chartIssues, resolveQuestionResources, type ResourceQuestion} from './question-resources.ts';
import {chartAxisLabels, conflictingAxisLabels} from './chart-axis-labels.ts';
export {parsePhysicsQuantity, extractPhysicsQuantities, physicsQuantitiesEquivalent} from './physics-quantities.ts';

export type PhysicsCalculationIssue = {
  code: 'invalid_calculation' | 'unverified_calculation' | 'contradictory_mark_scheme';
  detail: string;
};
export type PhysicsExpression = {input: string} | {constant: string} | {literal: number} |
  {op: 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'sqrt' | 'abs' | 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan' | 'exp' | 'ln' | 'log10'; args: PhysicsExpression[]};
export interface PhysicsCalculationCheck {
  label: string;
  inputs: {name: string; value: string | number; unit: string; source: 'stem' | 'constant' | 'resource'; quote?: string; constant?: string; resource_ref?: PhysicsResourceReference}[];
  expression: PhysicsExpression;
  result: {value: string | number; unit: string; significant_figures?: number; decimal_places?: number};
  /** Exact quantity in the final answer (or the selected MCQ option). */
  answer_quote: string;
  /** Required when a worked solution exists; exact recomputed quantity in it. */
  working_quote?: string;
}
type Obj = Record<string, unknown>;
const object = (value: unknown): Obj => value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {};
const text = (value: unknown): string => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
const answerValue = (part: Obj): unknown => ['correct_answer','expected_answer','answer','model_answer'].map(key => part[key]).find(item => item != null);
function decode(value: unknown): Obj {
  if (typeof value !== 'string') return object(value);
  if (value.length > 60000 || !value.trim().startsWith('{')) return {};
  try { return object(JSON.parse(value)); } catch { return {}; }
}
export interface PhysicsResourceReference {
  field: 'diagram_config' | 'diagramConfig' | 'chart_data' | 'table_data';
  /** Zero-based displayed row/column, excluding table headers. */
  row?: number;
  column?: number;
  /** Zero-based series/point index; only publicly drawn coordinates. */
  dataset?: number;
  point?: number;
  axis?: 'x' | 'y';
}
export interface GroundedPhysicsResourceQuantity {
  ref: PhysicsResourceReference;
  quote: string;
  quantity: PhysicsQuantity;
}
function declaredUnit(label: unknown): string | null {
  const normalized = normalizePhysicsMath(text(label));
  const candidate = normalized.match(/\(([^()]*)\)\s*$/)?.[1] ?? normalized.match(/\/\s*(.+)$/)?.[1];
  return candidate && parsePhysicsUnit(candidate) ? candidate.trim() : null;
}
/** Public resource inputs only. No private keys, answers, desired graph points,
 * plotting domains or schematic coordinates can become numerical evidence.
 * Other resource gates still own question relevance and drawing semantics. */
export function groundedPhysicsResourceQuantities(raw: unknown): GroundedPhysicsResourceQuantity[] {
  const part = object(raw), resolved = resolveQuestionResources(part as ResourceQuestion);
  if (resolved.issues.length) return [];
  const fields = ['diagram_config','diagramConfig','chart_data','table_data'] as const;
  const resources = fields.map(field => ({field,value:decode(part[field])})).filter(({value}) => ['line_chart','data_table'].includes(text(value.type)));
  if (!resources.length) return [];
  if (resources.some(({value}) => chartIssues(value).length > 0)) return [];
  const projection = (value: Obj): string => JSON.stringify(value.type === 'line_chart' ?
    {type:value.type,labels:chartAxisLabels(value),datasets:value.datasets} : {type:value.type,headers:value.headers,units:value.units,rows:value.rows});
  if (resources.some(({value}) => projection(value) !== projection(resources[0].value))) return [];
  const result: GroundedPhysicsResourceQuantity[] = [];
  for (const {field,value} of resources) {
    if (value.type === 'data_table') {
      if (!Array.isArray(value.headers) || !Array.isArray(value.rows) || value.rows.length > 200 || value.headers.length > 30) return [];
      const headers = value.headers, units = Array.isArray(value.units) ? value.units : [];
      for (let row = 0; row < value.rows.length; row++) {
        const cells = value.rows[row];
        if (!Array.isArray(cells) || cells.length !== headers.length) return [];
        const rowUnit = declaredUnit(cells[0]);
        for (let column = 0; column < cells.length; column++) {
          const cell = text(cells[column]), cellQuantity = parsePhysicsQuantity(cell);
          const explicit = text(units[column]).trim();
          if (explicit && !parsePhysicsUnit(explicit)) return [];
          const headerUnit = explicit || declaredUnit(headers[column]), knownUnit = headerUnit ?? rowUnit;
          if (!cellQuantity) continue;
          let quote: string;
          if (cellQuantity.unit) {
            if (knownUnit && !samePhysicsDimension(cellQuantity.dimension,parsePhysicsUnit(knownUnit)!.dimension)) return [];
            quote = cell;
          } else {
            if (!knownUnit) continue;
            quote = cell + ' ' + knownUnit;
          }
          const quantity = parsePhysicsQuantity(quote); if (!quantity) return [];
          result.push({ref:{field,row,column},quote,quantity});
        }
      }
    } else {
      if (conflictingAxisLabels(value) || !Array.isArray(value.datasets) || value.datasets.length > 20 || value.xKind === 'categorical') return [];
      const labels = chartAxisLabels(value), axisUnits = {x:declaredUnit(labels.xLabel),y:declaredUnit(labels.yLabel)};
      if (!axisUnits.x || !axisUnits.y) return [];
      for (let dataset = 0; dataset < value.datasets.length; dataset++) {
        const points = object(value.datasets[dataset]).data;
        if (!Array.isArray(points) || points.length < 2 || points.length > 1000) return [];
        for (let point = 0; point < points.length; point++) {
          const coordinates = object(points[point]);
          for (const axis of ['x','y'] as const) {
            const coordinate = coordinates[axis];
            if (typeof coordinate !== 'number' || !Number.isFinite(coordinate)) return [];
            const bounds = value[axis === 'x' ? 'domainX' : 'domainY'];
            if (bounds !== undefined && (!Array.isArray(bounds) || bounds.length !== 2 || !bounds.every(n => typeof n === 'number' && Number.isFinite(n)) || bounds[0] >= bounds[1] || coordinate < bounds[0] || coordinate > bounds[1])) return [];
            const quote = String(coordinate) + ' ' + axisUnits[axis], quantity = parsePhysicsQuantity(quote);
            if (!quantity) return [];
            result.push({ref:{field,dataset,point,axis},quote,quantity});
          }
        }
      }
    }
  }
  return result;
}
function resourceReferenceKey(raw: unknown): string | null {
  const ref = object(raw), keys = Object.keys(ref).sort();
  if (!['diagram_config','diagramConfig','chart_data','table_data'].includes(text(ref.field))) return null;
  const integer = (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value) && value >= 0;
  if (keys.join(',') === 'column,field,row' && integer(ref.row) && integer(ref.column)) return JSON.stringify([ref.field,ref.row,ref.column]);
  if (keys.join(',') === 'axis,dataset,field,point' && ['x','y'].includes(text(ref.axis)) && integer(ref.dataset) && integer(ref.point)) return JSON.stringify([ref.field,ref.dataset,ref.point,ref.axis]);
  return null;
}
function plainKey(value: unknown, depth = 0): string {
  if (depth > 5) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.slice(0, 50).map(item => plainKey(item, depth + 1)).join('\n');
  return Object.entries(object(value)).filter(([key]) => !['calculation_checks','newphysics_generation_version'].includes(key))
    .slice(0, 50).map(([key, item]) => key + ': ' + plainKey(item, depth + 1)).join('\n');
}
/** Reads both fresh model metadata and persisted private answer envelopes.
 * Does not import normalization: normalization itself uses these helpers. */
export function readPhysicsCalculationKey(raw: unknown): {answer: string; working: string; checks: unknown} {
  const part = object(raw);
  const value = answerValue(part) ?? raw;
  const envelope = decode(value), isEnvelope = hasOwn(envelope, 'calculation_checks');
  const finalValue = isEnvelope ? envelope.answer ?? envelope.final_answer ?? envelope.correct_answer : value;
  const answer = plainKey(finalValue);
  const workings = [envelope.worked_solution, envelope.working, envelope.mark_scheme, envelope.marking_scheme,
    part.worked_solution, part.working, part.mark_scheme, part.marking_scheme, part.rubric].map(value => plainKey(value)).filter(Boolean);
  return {answer, working: [...new Set(workings)].join('\n'), checks: part.calculation_checks ?? envelope.calculation_checks};
}
/** Preserve private evidence using the existing correct_answer database column.
 * Call only for newly generated content; this never migrates a saved exam. */
export function physicsCalculationPrivateKey(raw: unknown, answerOverride?: string): unknown {
  const part = object(raw), key = readPhysicsCalculationKey(raw);
  if (key.checks === undefined) return answerOverride ?? answerValue(part) ?? raw;
  const source = decode(answerValue(part));
  const joinPrivate = (values: unknown[]): string => [...new Set(values.map(value => plainKey(value)).filter(Boolean))].join('\n');
  const worked = joinPrivate([source.worked_solution,source.working,part.worked_solution,part.working]);
  const scheme = joinPrivate([source.mark_scheme,source.marking_scheme,part.mark_scheme,part.marking_scheme,part.rubric]);
  return JSON.stringify({answer: answerOverride ?? key.answer,
    ...(worked ? {worked_solution: worked} : {}), ...(scheme ? {mark_scheme: scheme} : {}),
    calculation_checks: key.checks});
}
type Evaluated = {value: number; dimension: number[]};
const DIMENSIONLESS = [0,0,0,0,0,0,0];
const KNOWN_CONSTANTS: Record<string, {value: number; unit: string}> = {
  pi: {value: Math.PI, unit: ''},
  c: {value: 299792458, unit: 'm s^-1'},
  h: {value: 6.62607015e-34, unit: 'J s'},
  e: {value: 1.602176634e-19, unit: 'C'},
  G: {value: 6.67430e-11, unit: 'N m^2 kg^-2'},
  k_B: {value: 1.380649e-23, unit: 'J K^-1'},
  N_A: {value: 6.02214076e23, unit: 'mol^-1'},
  electron_mass: {value: 9.1093837139e-31, unit: 'kg'},
  proton_mass: {value: 1.67262192595e-27, unit: 'kg'},
};
function knownConstant(name: string): Evaluated | null {
  if (!hasOwn(KNOWN_CONSTANTS, name)) return null;
  const constant = KNOWN_CONSTANTS[name], parsed = parsePhysicsUnit(constant.unit)!;
  return {value: constant.value * parsed.scale, dimension: parsed.dimension};
}
class CalculationError extends Error {}
function fail(message: string): never { throw new CalculationError(message); }
function evaluate(expression: unknown, inputs: Map<string, Evaluated>, used: Set<string>, state: {nodes: number; constants?: Set<string>} = {nodes: 0}, depth = 0): Evaluated {
  if (++state.nodes > 96 || depth > 12) fail('The calculation expression exceeds the bounded arithmetic limits.');
  const node = object(expression), keys = Object.keys(node);
  let result: Evaluated;
  if (keys.length === 1 && typeof node.input === 'string') {
    const input = inputs.get(node.input); if (!input) fail('The expression references an unknown input.');
    used.add(node.input); result = input;
  } else if (keys.length === 1 && typeof node.constant === 'string') {
    const constant = knownConstant(node.constant); if (!constant) fail('The expression names an unsupported physical constant.');
    state.constants?.add(node.constant);
    result = constant;
  } else if (keys.length === 1 && typeof node.literal === 'number') {
    // Literal leaves are mathematical coefficients, never arbitrary supplied
    // measurements or model-chosen final values disguised as verification.
    if (!(Number.isInteger(node.literal) && Math.abs(node.literal) <= 12) && ![.5,100].includes(node.literal))
      fail('Put physical measurements in grounded inputs; arbitrary numeric expression literals are not permitted.');
    result = {value: node.literal, dimension: DIMENSIONLESS};
  } else {
    if (keys.length !== 2 || typeof node.op !== 'string' || !Array.isArray(node.args)) fail('Use the supported arithmetic expression tree; code and free-form expressions are not evaluated.');
    const arity: Record<string, number[]> = {add:[2,6],subtract:[2,2],multiply:[2,6],divide:[2,2],power:[2,2],sqrt:[1,1],abs:[1,1],sin:[1,1],cos:[1,1],tan:[1,1],asin:[1,1],acos:[1,1],atan:[1,1],exp:[1,1],ln:[1,1],log10:[1,1]};
    if (!hasOwn(arity, node.op)) fail('The calculation contains an unsupported arithmetic operation.');
    const [min,max] = arity[node.op]; if (node.args.length < min || node.args.length > max) fail('The arithmetic operation has the wrong number of arguments.');
    const args = node.args.map(arg => evaluate(arg, inputs, used, state, depth + 1)), a = args[0], b = args[1];
    switch (node.op) {
      case 'add': case 'subtract':
        if (args.some(arg => !samePhysicsDimension(a.dimension, arg.dimension))) fail('Addition/subtraction combines incompatible physical units.');
        result = {value: node.op === 'add' ? args.reduce((sum,arg) => sum + arg.value, 0) : a.value - b.value, dimension: a.dimension}; break;
      case 'multiply':
        result = args.reduce((acc,arg) => ({value: acc.value * arg.value, dimension: acc.dimension.map((d,i) => d + arg.dimension[i])}), {value:1,dimension:[...DIMENSIONLESS]}); break;
      case 'divide':
        if (b.value === 0) fail('The calculation divides by zero.');
        result = {value:a.value / b.value,dimension:a.dimension.map((d,i) => d - b.dimension[i])}; break;
      case 'power':
        if (!samePhysicsDimension(b.dimension, DIMENSIONLESS) || Math.abs(b.value) > 12 || !Number.isInteger(b.value * 2)) fail('A power must be a bounded integer or half-integer dimensionless exponent.');
        result = {value:a.value ** b.value,dimension:a.dimension.map(d => d * b.value)}; break;
      case 'sqrt': result = {value:Math.sqrt(a.value),dimension:a.dimension.map(d => d / 2)}; break;
      case 'abs': result = {value:Math.abs(a.value),dimension:a.dimension}; break;
      case 'sin': case 'cos': case 'tan': case 'asin': case 'acos': case 'atan': case 'exp': case 'ln': case 'log10': {
        if (!samePhysicsDimension(a.dimension, DIMENSIONLESS)) fail('Trigonometric, exponential and logarithmic arguments must be dimensionless; angles are converted to radians.');
        if (node.op === 'tan' && Math.abs(Math.cos(a.value)) < 1e-12) fail('The tangent is undefined at this angle.');
        if (['asin','acos'].includes(node.op) && Math.abs(a.value) > 1) fail('An inverse trigonometric argument is outside its real domain.');
        if (['ln','log10'].includes(node.op) && a.value <= 0) fail('A logarithm requires a strictly positive argument.');
        if (node.op === 'exp' && Math.abs(a.value) > 230) fail('The exponential exceeds the supported numeric range.');
        const operations = {sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,exp:Math.exp,ln:Math.log,log10:Math.log10};
        result = {value:operations[node.op as keyof typeof operations](a.value),dimension:[...DIMENSIONLESS]};
        break;
      }
      default: return fail('Unsupported calculation.');
    }
  }
  if (!Number.isFinite(result.value) || result.dimension.some(d => !Number.isFinite(d) || Math.abs(d) > 48) || Math.abs(result.value) > 1e100 || (result.value !== 0 && Math.abs(result.value) < 1e-100)) fail('The calculation is non-finite or exceeds numeric limits.');
  return result;
}
/** Only structured bounded arithmetic is interpreted. Never eval/Function. */
export function evaluatePhysicsExpression(expression: unknown, inputs: Record<string, {value: string | number; unit: string}>): {value: number; dimension: number[]} {
  const variables = new Map<string, Evaluated>();
  for (const [name, input] of Object.entries(inputs)) {
    const q = parsePhysicsQuantity(String(input.value) + ' ' + input.unit); if (!q) fail('Unsupported input quantity.');
    variables.set(name, {value:q.siValue,dimension:q.dimension});
  }
  return evaluate(expression, variables, new Set());
}
function splitWorking(answer: string, separate: string): {final: string; working: string} {
  const marker = answer.search(/\b(?:working(?:\s+out)?|worked\s+solution|method|mark(?:ing)?\s+scheme|solution)\s*[:\n]/i);
  return {final: marker >= 0 ? answer.slice(0,marker) : answer,
    working: [marker >= 0 ? answer.slice(marker) : '', separate].filter(Boolean).join('\n')};
}
function selectedMcq(part: Obj, answer: string): string | null {
  let options = part.options;
  if (!Array.isArray(options)) {
    const mapped = object(options), keys = Object.keys(mapped);
    if (!keys.length || !keys.every(key => /^[A-Z]$/i.test(key))) return null;
    options = keys.map(key => ({label:key,text:mapped[key]}));
  }
  const items = (options as unknown[]).map(item => {
    const obj = object(item), body = text(typeof item === 'object' ? obj.text ?? obj.value ?? obj.answer ?? obj.option : item);
    const label = text(obj.label ?? obj.id ?? obj.key ?? obj.letter).match(/^([A-Z])[.)]?$/i)?.[1].toUpperCase() ??
      body.match(/^\s*([A-Z])[.)]\s+/i)?.[1].toUpperCase();
    return {label,body:body.replace(label ? new RegExp('^\\s*'+label+'[.)]\\s+') : /(?!)^/, '')};
  });
  const labelled = items.filter(item => item.label);
  if (labelled.length && (labelled.length !== items.length || new Set(labelled.map(item => item.label)).size !== items.length)) return null;
  const ordered = labelled.length ? [...items].sort((a,b) => a.label!.localeCompare(b.label!)) : items;
  if (labelled.length && ordered.some((item,index) => item.label !== String.fromCharCode(65+index))) return null;
  const label = answer.trim().split(/[\n:]/)[0].match(/^(?:option\s+)?\(?([A-Z])\)?[.)]?$/i)?.[1].toUpperCase();
  if (label) return ordered[label.charCodeAt(0)-65]?.body ?? null;
  const normalized = normalizePhysicsMath(answer);
  const matching = ordered.map(item => item.body).filter(option => normalizePhysicsMath(option) === normalized);
  return matching.length === 1 ? matching[0] : null;
}
function quantityWithin(quote: unknown, host: string): PhysicsQuantity | null {
  if (typeof quote !== 'string' || !quote.trim() || quote.length > 300) return null;
  const normalized = normalizePhysicsMath(quote);
  const parsed = parsePhysicsQuantity(normalized), normalizedHost = normalizePhysicsMath(host);
  if (!parsed) return null;
  const hostQuantities = extractPhysicsQuantities(normalizedHost);
  for (let index = normalizedHost.indexOf(normalized); index >= 0; index = normalizedHost.indexOf(normalized,index+1)) {
    const before = normalizedHost.slice(0,index), after = normalizedHost.slice(index+normalized.length);
    // A substring of a different mantissa, sign, exponent, variable or unit is
    // not a source quote: 12V must never be sourced from 112V, nor m from mA.
    if (/[A-Za-z_\d.^+\-]$/.test(before) || /^[A-Za-z_\d^]|^\.\d/.test(after)) continue;
    const numericStart = index + (normalized.startsWith('±') ? normalized.indexOf(normalized.replace(/^±\s*/, '')) : 0);
    const hostQuantity = hostQuantities.find(q => q.index === numericStart);
    if (hostQuantity && !physicsQuantitiesEquivalent(parsed,hostQuantity)) continue;
    if (!hostQuantity && parsed.unit) continue;
    return parsed;
  }
  return null;
}
const CONSTANT_NAMES: Record<string, string[]> = {
  pi:['π','pi'],c:['c','speed of light'],h:['h','Planck constant',"Planck's constant"],
  e:['e','elementary charge','electron charge'],G:['G','gravitational constant'],
  k_B:['k_B','Boltzmann constant'],N_A:['N_A','Avogadro constant'],
  electron_mass:['electron_mass','electron mass'],proton_mass:['proton_mass','proton mass'],
};
function stemSpecifiesConstant(stem: string, name: string): boolean {
  const normalized = normalizePhysicsMath(stem);
  return (CONSTANT_NAMES[name] ?? []).some(alias => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp('(?:^|[^A-Za-z_])'+escaped+'\\s*(?:(?:=|:)|(?:is|of|as|to be|has the value)\\s+)\\s*[-+]?\\d').test(normalized);
  });
}
function labelledWorkingIssues(label: string, result: PhysicsQuantity, working: string): PhysicsCalculationIssue[] {
  const aliases: Record<string,string[]> = {power:['P'],mass:['m','M'],energy:['E'],current:['I'],resistance:['R'],
    force:['F'],speed:['v'],velocity:['v'],acceleration:['a'],frequency:['f'],period:['T'],momentum:['p']};
  const names = [label,...(aliases[label.trim().toLowerCase()] ?? [])];
  const lines = working.split(/[\n;]/), matches: PhysicsQuantity[] = [];
  for (const line of lines) {
    if (/\b(?:alternative|example|ECF|carried.forward|instead|if|incorrect|wrong|do not accept|not accepted)\b/i.test(line)) continue;
    const assignment = line.trim().match(/^([A-Za-z][A-Za-z0-9_ ]{0,45})\s*(?:=|:)\s*(.+)$/);
    if (!assignment || !names.some(name => name === assignment[1].trim() || name.length > 1 && name.toLowerCase() === assignment[1].trim().toLowerCase())) continue;
    const quantities = extractPhysicsQuantities(assignment[2]);
    // Only a direct numeric assignment, not intermediate algebra.
    const q = quantities[0];
    if (q && q.index === 0 && samePhysicsDimension(result.dimension,q.dimension)) matches.push(q);
  }
  const last = matches.at(-1);
  if (!last || Math.abs(last.siValue-result.siValue) <= Math.max(last.siRounding,result.siRounding,Math.abs(result.siValue)*1e-12)) return [];
  return [{code:'contradictory_mark_scheme',detail:'The final '+label+' conflicts with the last explicitly named value in its own worked solution. Repair the answer, working and marking guidance together.'}];
}
function numericTolerance(result: Obj, quantity: PhysicsQuantity): number {
  const sf = result.significant_figures, dp = result.decimal_places;
  if (sf !== undefined && dp !== undefined) fail('Specify significant_figures or decimal_places, not both.');
  let writtenRounding = quantity.rounding;
  if (sf !== undefined) {
    if (!Number.isInteger(sf) || Number(sf) < 2 || Number(sf) > 12) fail('Significant figures must be between 2 and 12.');
    if (quantity.value === 0) fail('Use decimal_places for zero results.');
    writtenRounding = .5 * 10 ** (Math.floor(Math.log10(Math.abs(quantity.value))) - Number(sf) + 1);
  }
  if (dp !== undefined) {
    if (!Number.isInteger(dp) || Number(dp) < 0 || Number(dp) > 12) fail('Decimal places must be between 0 and 12.');
    writtenRounding = .5 * 10 ** -Number(dp);
  }
  // The model cannot create an arbitrary acceptance interval. Without explicit
  // rounding, a sparse integer answer does not authorize a 50% tolerance.
  if (sf === undefined && dp === undefined && quantity.value !== 0 && writtenRounding > Math.abs(quantity.value) * .05)
    fail('State the intended result rounding explicitly for a low-precision numeric answer.');
  const scale = quantity.value ? Math.abs(quantity.siValue / quantity.value) : parsePhysicsUnit(quantity.unit)!.scale;
  return Math.min(writtenRounding, quantity.rounding) * Math.abs(scale) + Math.abs(quantity.siValue) * 1e-12;
}
/** Conservative numeric-operation lines only; no algebra or arbitrary prose. */
export function explicitPhysicsArithmeticIssues(raw: string): PhysicsCalculationIssue[] {
  const issues: PhysicsCalculationIssue[] = [];
  const numberToken = new RegExp('^(?:' + PHYSICS_NUMBER_PATTERN + ')');
  for (const line of normalizePhysicsMath(raw).split(/;|\n/).slice(0,100)) {
    // A numeric substitution begins after =/: or at the start of a line.
    const pieces = line.split('=');
    for (let i = 0; i < pieces.length - 1; i++) {
      if (/\b(?:alternative|example|ECF|carried.forward|instead|if|incorrect|wrong|do not accept|not accepted)\b/i.test(pieces.slice(0,i+1).join('='))) continue;
      const candidate = pieces[i].replace(/^.*:\s*/, '').trim();
      if (!candidate || candidate.length > 160 || !/^[\d.()+\-*/^eE\s]+$/.test(candidate) || !/[+*/^]|\d\s*-\s*\d/.test(candidate)) continue;
      const rhs = pieces[i+1].trim().match(numberToken), expected = rhs && parsePhysicsNumber(rhs[0]);
      if (!expected) continue;
      if (/^\s*[+*/^\-]\s*[\d.(]/.test(pieces[i+1].trim().slice(rhs![0].length))) continue;
      try {
        const computed = evaluateNumericText(candidate);
        if (Math.abs(computed - expected.value) > expected.rounding + Math.abs(computed) * 1e-10)
          issues.push({code:'contradictory_mark_scheme',detail:'An explicit numeric substitution in the private working does not equal its stated result. Recalculate the arithmetic, final answer and marking guidance together.'});
      } catch { /* Unsupported prose/algebra is not declared verified. */ }
    }
  }
  return issues.slice(0, 5);
}
function evaluateNumericText(raw: string): number {
  const tokens = raw.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?|[()+\-*/^]/g);
  if (!tokens || tokens.join('') !== raw.replace(/\s+/g, '') || tokens.length > 64) fail('Unsupported numeric text.');
  let index = 0, nodes = 0;
  const parse = (min = 0, depth = 0): number => {
    if (++nodes > 64 || depth > 12) fail('Arithmetic limit.');
    const token = tokens[index++]; let left: number;
    if (token === '+' || token === '-') left = (token === '-' ? -1 : 1) * parse(3, depth + 1);
    else if (token === '(') { left = parse(0,depth + 1); if (tokens[index++] !== ')') fail('Unbalanced arithmetic.'); }
    else { left = Number(token); if (token === undefined || !Number.isFinite(left)) fail('Invalid numeric token.'); }
    const precedence: Record<string,number> = {'+':1,'-':1,'*':2,'/':2,'^':4};
    while (index < tokens.length && hasOwn(precedence,tokens[index]) && precedence[tokens[index]] >= min) {
      const op = tokens[index++], right = parse(precedence[op] + (op === '^' ? 0 : 1),depth + 1);
      if (op === '/' && right === 0) fail('Division by zero.');
      if (op === '^' && Math.abs(right) > 100) fail('Power limit.');
      left = op === '+' ? left + right : op === '-' ? left - right : op === '*' ? left * right : op === '/' ? left / right : left ** right;
      if (!Number.isFinite(left) || Math.abs(left) > 1e100) fail('Numeric bound.');
    }
    return left;
  };
  const result = parse(); if (index !== tokens.length) fail('Unexpected arithmetic token.'); return result;
}
export interface PhysicsCalculationContext {
  /** Actual assembled student-visible stem, including trusted parent context. */
  stem?: string;
  /** Callers opt in for new Physics generation, never historical saved exams. */
  requireChecks?: boolean;
}
/** Recomputes supported arithmetic and units, not the scientific correctness of
 * an arbitrary chosen formula. Missing/unsupported evidence is repairable,
 * never silently relabelled "verified". No AI call is made by this gate. */
export function physicsCalculationIssues(raw: unknown, context: PhysicsCalculationContext = {}): PhysicsCalculationIssue[] {
  const part = object(raw), key = readPhysicsCalculationKey(raw), stem = context.stem ?? [part.context,part.question_text,part.task].map(text).filter(Boolean).join('\n');
  const split = splitWorking(key.answer,key.working), selected = selectedMcq(part,split.final);
  const finalAnswer = selected ?? split.final;
  const issues: PhysicsCalculationIssue[] = [
    ...markSchemeConsistencyIssues({correct_answer:split.final,mark_scheme:split.working}),
    ...explicitPhysicsArithmeticIssues(split.working),
  ];
  const numericalFinal = !!parsePhysicsQuantity(finalAnswer) || extractPhysicsQuantities(finalAnswer).length > 0;
  const calculationTask = /\b(?:calculate|compute|work out|convert|show that)\b/i.test(stem) ||
    /\b(?:determine|find|estimate|evaluate|what is|which is)\b/i.test(stem) && numericalFinal ||
    numericalFinal ||
    /^(?:calculation|numerical|numeric)$/i.test(text(part.question_type));
  const checks = key.checks;
  if (checks === undefined || (Array.isArray(checks) && checks.length === 0)) {
    if (calculationTask && context.requireChecks !== false) issues.push({code:'unverified_calculation',detail:'This new Physics numerical task has no grounded calculation_checks. Supply supported arithmetic, units, source quotes and final/working answer links, or repair the task; its arithmetic has not been verified.'});
    return uniqueIssues(issues);
  }
  if (!Array.isArray(checks) || checks.length > 12) return uniqueIssues([...issues,{code:'invalid_calculation',detail:'calculation_checks must be a bounded array of at most 12 supported numerical checks.'}]);
  const covered: PhysicsQuantity[] = [];
  let publicResourceQuantities: GroundedPhysicsResourceQuantity[] | undefined;
  for (let index = 0; index < checks.length; index++) {
    const check = object(checks[index]), label = text(check.label).slice(0,80) || String(index+1);
    try {
      if (!Array.isArray(check.inputs) || !check.inputs.length || check.inputs.length > 20) fail('Provide 1 to 20 grounded numerical inputs.');
      const inputs = new Map<string, Evaluated>();
      for (const rawInput of check.inputs) {
        const input = object(rawInput), name = text(input.name);
        if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name) || inputs.has(name)) fail('Calculation input names must be distinct simple identifiers.');
        if (typeof input.unit !== 'string') fail('Every input needs an explicit unit (empty for dimensionless).');
        const q = parsePhysicsQuantity(text(input.value) + ' ' + input.unit); if (!q) fail('An input uses an unsupported number or SI unit.');
        if (input.source === 'stem') {
          const quote = quantityWithin(input.quote,stem);
          if (!quote || !physicsQuantitiesEquivalent(q,quote)) fail('A calculation input does not match its exact quantity quote in the student-visible stem. Do not invent givens or cite private working as a source.');
        } else if (input.source === 'resource') {
          publicResourceQuantities ??= groundedPhysicsResourceQuantities(part);
          const ref = resourceReferenceKey(input.resource_ref);
          const matched = ref && publicResourceQuantities.find(entry => resourceReferenceKey(entry.ref) === ref);
          if (!matched || normalizePhysicsMath(text(input.quote)) !== normalizePhysicsMath(matched.quote) || !physicsQuantitiesEquivalent(q,matched.quantity))
            fail('A resource input does not match the declared public table cell or plotted coordinate with explicit units. Private answers, hidden expected plots, schematic positions and invalid/conflicting resources are not givens.');
        } else if (input.source === 'constant') {
          const constant = knownConstant(text(input.constant));
          if (stemSpecifiesConstant(stem,text(input.constant))) fail('This physical constant is explicitly supplied in the stem; cite that given instead of overriding it with the constant registry.');
          if (!constant || !samePhysicsDimension(constant.dimension,q.dimension) || Math.abs(constant.value-q.siValue) > Math.min(q.siRounding, Math.abs(constant.value)*.001) + Math.abs(constant.value)*1e-12)
            fail('A claimed known constant is unsupported or has the wrong value/unit.');
        } else fail('Each input must cite a stem quantity, a validated public graph/table reading, or a supported known physical constant.');
        inputs.set(name,{value:q.siValue,dimension:q.dimension});
      }
      const used = new Set<string>(), usedConstants = new Set<string>();
      const computed = evaluate(check.expression,inputs,used,{nodes:0,constants:usedConstants});
      if ([...usedConstants].some(name => stemSpecifiesConstant(stem,name))) fail('The expression overrides a physical constant explicitly supplied by the stem. Use a grounded stem input for that constant.');
      if (!used.size || [...inputs.keys()].some(name => !used.has(name))) fail('The expression must use all declared grounded inputs; unrelated inputs cannot certify a fabricated answer.');
      const result = object(check.result);
      if (typeof result.unit !== 'string') fail('The recomputed result needs an explicit SI unit.');
      const q = parsePhysicsQuantity(text(result.value) + ' ' + result.unit); if (!q) fail('The result uses an unsupported number or SI unit.');
      if (!samePhysicsDimension(computed.dimension,q.dimension)) fail('The formula dimensions do not match the final answer unit.');
      if (Math.abs(computed.value-q.siValue) > numericTolerance(result,q)) fail('The claimed final value does not match the deterministically recomputed expression at the stated rounding.');
      const linked = quantityWithin(check.answer_quote,finalAnswer);
      if (!linked || !physicsQuantitiesEquivalent(q,linked)) fail('The check result is not linked to the actual final answer or selected MCQ option. Repair the final answer and working together.');
      if (split.working) {
        const worked = quantityWithin(check.working_quote,split.working);
        if (!worked || !samePhysicsDimension(computed.dimension,worked.dimension) || Math.abs(computed.value-worked.siValue) > worked.siRounding + Math.abs(computed.value)*1e-12)
          fail('The worked solution is missing an exact quantity link or conflicts with the recomputed result.');
        issues.push(...labelledWorkingIssues(label,q,split.working));
      }
      covered.push(linked);
    } catch (error) {
      issues.push({code:'invalid_calculation',detail:'Calculation '+label+': '+(error instanceof CalculationError ? error.message : 'Unsupported calculation metadata; regenerate the private verification evidence.')});
    }
  }
  const finals = extractPhysicsQuantities(finalAnswer);
  const normalizedFinal = normalizePhysicsMath(finalAnswer);
  const residualNumbers = [...normalizedFinal.matchAll(new RegExp(PHYSICS_NUMBER_PATTERN,'g'))].filter(match => {
    const start = match.index!, end = start + match[0].length;
    if (finals.some(q => start >= q.index && end <= q.end)) return false;
    const before = normalizedFinal.slice(0,start), after = normalizedFinal.slice(end);
    if (/[A-Za-z_^\d.]$/.test(before)) return false;
    if (/^\s*(?:marks?\b|significant figures\b|decimal places\b|s\.?f\.?\b|d\.?p\.?\b)/i.test(after)) return false;
    const q = parsePhysicsQuantity(match[0]);
    return !q || !covered.some(result => physicsQuantitiesEquivalent(q,result));
  });
  if (!covered.length || residualNumbers.length || finals.some(q => !covered.some(result => physicsQuantitiesEquivalent(q,result))))
    issues.push({code:'unverified_calculation',detail:'Every numerical quantity claimed in the final answer/selected option must be covered by a valid recomputed check. Unsupported or unlinked numerical answers require repair.'});
  return uniqueIssues(issues);
}
function uniqueIssues(issues: PhysicsCalculationIssue[]): PhysicsCalculationIssue[] {
  return issues.filter((issue,index) => issues.findIndex(other => other.code === issue.code && other.detail === issue.detail) === index);
}
export function physicsCalculationPromptInstructions(): string {
  return `PHYSICS PRIVATE NUMERICAL INTEGRITY (all newly generated numerical tasks, including MCQs):
Return correct_answer as a private JSON object {"answer":"final answer or MCQ letter","worked_solution":"method with substituted values, correct SI units and final quantity","calculation_checks":[...]} for each numerical task. Non-numerical explanations may keep their ordinary key and omit calculation_checks.
Each check is {"label":"quantity","inputs":[{"name":"v","value":"12.0","unit":"V","source":"stem","quote":"12.0 V"}],"expression":{"op":"multiply","args":[{"input":"v"},{"input":"i"}]},"result":{"value":"24.0","unit":"W","significant_figures":3},"answer_quote":"24.0 W","working_quote":"24.0 W"}. This is a schema example; supply every actual input used. Quotes must be exact quantity-only substrings of the visible stem, final answer (the selected option for MCQ), and private worked solution respectively. For apparatus diagrams, put numerical givens in the visible stem as well so their source can be checked. Never cite your own working as a given.
An input read from a public saved data_table or line_chart may instead use source:"resource", resource_ref:{field:"diagram_config",row:0,column:1} (table, zero-based row excludes headers) or resource_ref:{field:"chart_data",dataset:0,point:1,axis:"y"} (plotted coordinate). Resource fields allowed: diagram_config, diagramConfig, chart_data, table_data. Give quote as the exact displayed scalar followed by its explicit header/row-label/axis unit, e.g. "12 V"; include units in table units/header/row label and both graph axes. These inputs must reference actual visible validated resource cells/coordinates. Do not repeat a graph-reading answer in the prose merely to ground it; cite its plotted coordinate. Hidden expected plotting data, private answer fields, diagram coordinates, derived gradients/areas and arbitrary interpolated readings cannot be cited as source inputs; derive supported quantities from actual public readings using the expression tree.
Expression leaves are {"input":"name"}, {"constant":"pi"}, or mathematical coefficients {"literal":2}; permitted operators are add, subtract, multiply, divide, power (integer/half-integer exponent within ±12), sqrt, abs, sin, cos, tan, asin, acos, atan, exp, ln, log10, with args arrays. Trigonometric angles use radians after SI conversion (explicit deg inputs are supported); inverse trig outputs radians. Exponential/log arguments must be dimensionless and in their real domains. Coefficients are integers -12..12, 0.5 or 100 only; physical data belong in grounded inputs. Use all declared inputs. No code, arbitrary expression strings, eval, invented constants, acceptance intervals or model-provided verification assertions.
Supported constant names: pi, c, h, e, G, k_B, N_A, electron_mass, proton_mass. A rounded known-constant input may instead use source:"constant", constant:"G", value:"6.67e-11", unit:"N m^2 kg^-2"; any constant explicitly supplied by the question must cite its exact stem quantity. SI prefixes, scientific notation, compound SI powers and % are supported. Use negative powers for compound denominators (e.g. J kg^-1 K^-1). Set significant_figures (2..12) OR decimal_places (0..12); tolerance is derived and bounded, never self-declared. Provide a check for every final numerical quantity and ensure all working and marking statements agree. The check proves the submitted arithmetic and dimensions, not the scientific choice of formula; unsupported calculations must be repaired, never labelled verified.`;
}
