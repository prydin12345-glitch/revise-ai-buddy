const hasOwn = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);
/** Bounded SI quantity parsing, shared by private calculation and figure checks.
 * Unsupported syntax returns null; a parse is not a claim of scientific validity.
 */
export interface PhysicsQuantity {
  value: number;
  siValue: number;
  unit: string;
  /** kg, m, s, A, K, mol, cd exponents. */
  dimension: number[];
  /** Half a unit in the last written decimal place, before/after SI conversion. */
  rounding: number;
  siRounding: number;
}
export interface ExtractedPhysicsQuantity extends PhysicsQuantity {
  raw: string;
  index: number;
  end: number;
}
const superscripts: Record<string, string> = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+' };
export function normalizePhysicsMath(raw: string): string {
  let text = raw.slice(0, 20000)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, run => '^' + [...run].map(char => superscripts[char]).join(''))
    .replace(/[−–]/g, '-').replace(/µ/g, 'μ')
    .replace(/\\(?:times|cdot)\b/g, '*').replace(/[×·]/g, '*')
    .replace(/\\(?:left|right)\b/g, '').replace(/\\[()[\]]/g, '')
    .replace(/\\(?:mu|Omega|ohm)\b/g, match => match === '\\mu' ? 'μ' : 'Ω')
    .replace(/°/g, 'deg')
    .replace(/\\pm\b/g, '±').replace(/\\[,;! ]/g, ' ')
    .replace(/\\(?:quad|qquad)\b/g, ' ').replace(/[$]/g, '');
  for (let i = 0; i < 4; i++) text = text.replace(/\\(?:mathrm|text|mathit|operatorname)\s*\{([^{}]*)\}/g, '$1');
  return text.replace(/\^\s*\{\s*([-+]?\d+)\s*\}/g, '^$1').replace(/\s+/g, ' ').trim();
}
export const PHYSICS_NUMBER_PATTERN = '[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:\\s*\\*\\s*10\\s*\\^\\s*[-+]?\\d+|[eE][-+]?\\d+)?';
export function parsePhysicsNumber(raw: unknown): {value: number; rounding: number} | null {
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const text = normalizePhysicsMath(String(raw)).replace(/\s+/g, '');
  if (text.length > 80) return null;
  const match = text.match(/^([-+]?(?:\d+(?:\.\d*)?|\.\d+))(?:(?:\*10\^)([-+]?\d+)|[eE]([-+]?\d+))?$/);
  if (!match) return null;
  const exponent = Number(match[2] ?? match[3] ?? 0), value = Number(match[1]) * 10 ** exponent;
  if (Math.abs(exponent) > 100 || !Number.isFinite(value)) return null;
  const decimals = match[1].split('.')[1]?.length ?? 0;
  return {value, rounding: 0.5 * 10 ** (exponent - decimals)};
}
type Unit = {scale: number; dimension: number[]};
const dimensionless = (): number[] => [0, 0, 0, 0, 0, 0, 0];
const unit = (dimension: number[], scale = 1): Unit => ({dimension, scale});
const UNITS: Record<string, Unit> = {
  kg: unit([1,0,0,0,0,0,0]), g: unit([1,0,0,0,0,0,0], 0.001),
  m: unit([0,1,0,0,0,0,0]), s: unit([0,0,1,0,0,0,0]),
  A: unit([0,0,0,1,0,0,0]), K: unit([0,0,0,0,1,0,0]),
  mol: unit([0,0,0,0,0,1,0]), cd: unit([0,0,0,0,0,0,1]),
  Hz: unit([0,0,-1,0,0,0,0]), N: unit([1,1,-2,0,0,0,0]),
  Pa: unit([1,-1,-2,0,0,0,0]), J: unit([1,2,-2,0,0,0,0]),
  W: unit([1,2,-3,0,0,0,0]), C: unit([0,0,1,1,0,0,0]),
  V: unit([1,2,-3,-1,0,0,0]), Ω: unit([1,2,-3,-2,0,0,0]),
  ohm: unit([1,2,-3,-2,0,0,0]), F: unit([-1,-2,4,2,0,0,0]),
  S: unit([-1,-2,3,2,0,0,0]), Wb: unit([1,2,-2,-1,0,0,0]),
  T: unit([1,0,-2,-1,0,0,0]), H: unit([1,2,-2,-2,0,0,0]),
  Bq: unit([0,0,-1,0,0,0,0]), Gy: unit([0,2,-2,0,0,0,0]),
  Sv: unit([0,2,-2,0,0,0,0]), eV: unit([1,2,-2,0,0,0,0], 1.602176634e-19),
  rad: unit(dimensionless()), sr: unit(dimensionless()), '%': unit(dimensionless(), .01),
  deg: unit(dimensionless(), Math.PI / 180),
  min: unit([0,0,1,0,0,0,0], 60), h: unit([0,0,1,0,0,0,0], 3600),
  L: unit([0,3,0,0,0,0,0], .001), l: unit([0,3,0,0,0,0,0], .001),
};
const PREFIXES: Record<string, number> = {Y:1e24,Z:1e21,E:1e18,P:1e15,T:1e12,G:1e9,M:1e6,k:1e3,h:1e2,da:1e1,d:1e-1,c:1e-2,m:1e-3,μ:1e-6,u:1e-6,n:1e-9,p:1e-12,f:1e-15,a:1e-18};
function atomUnit(symbol: string): Unit | null {
  if (hasOwn(UNITS, symbol)) return UNITS[symbol];
  for (const prefix of ['da', ...Object.keys(PREFIXES).filter(p => p !== 'da')]) {
    const base = symbol.slice(prefix.length);
    if (symbol.startsWith(prefix) && hasOwn(UNITS, base) && !['kg','%','min','h'].includes(base))
      return {...UNITS[base], scale: PREFIXES[prefix] * UNITS[base].scale};
  }
  return null;
}
export function parsePhysicsUnit(raw: string): Unit | null {
  if (typeof raw !== 'string' || raw.length > 160) return null;
  const text = normalizePhysicsMath(raw).replace(/\bper\b/g, '/').replace(/\s*([*/])\s*/g, '$1').trim();
  if (!text || text === '1' || text === 'dimensionless') return unit(dimensionless());
  // Each slash applies to the immediately following atom. Use negative powers
  // for compound denominators; ambiguous unbracketed denominators are rejected.
  const tokens = text.match(/[A-Za-zμΩ%]+(?:\s*\^?\s*[-+]?\d+)?|[*/]|\s+/g);
  if (!tokens || tokens.join('') !== text || tokens.length > 40) return null;
  let scale = 1, dim = dimensionless(), sign = 1, expectAtom = true, denominator = false;
  for (const token of tokens) {
    if (/^\s+$/.test(token)) continue;
    if (token === '*' || token === '/') {
      if (expectAtom || (token === '/' && denominator)) return null;
      sign = token === '/' ? -1 : 1; denominator ||= token === '/'; expectAtom = true; continue;
    }
    if (!expectAtom && denominator) return null;
    const match = token.match(/^([A-Za-zμΩ%]+)(?:\s*\^?\s*([-+]?\d+))?$/);
    if (!match) return null;
    const base = atomUnit(match[1]), power = Number(match[2] ?? 1) * sign;
    if (!base || !Number.isInteger(power) || Math.abs(power) > 12) return null;
    scale *= base.scale ** power;
    dim = dim.map((d, i) => d + base.dimension[i] * power);
    expectAtom = false; sign = 1;
  }
  return expectAtom || !Number.isFinite(scale) || !scale ? null : {scale, dimension: dim};
}
export function parsePhysicsQuantity(raw: string): PhysicsQuantity | null {
  if (typeof raw !== 'string' || raw.length > 300) return null;
  const text = normalizePhysicsMath(raw).replace(/^±\s*/, '').trim();
  const match = text.match(new RegExp('^(' + PHYSICS_NUMBER_PATTERN + ')\\s*(.*?)$'));
  if (!match) return null;
  const number = parsePhysicsNumber(match[1]), parsedUnit = parsePhysicsUnit(match[2]);
  if (!number || !parsedUnit) return null;
  return {...number, unit: match[2], dimension: parsedUnit.dimension, siValue: number.value * parsedUnit.scale, siRounding: number.rounding * Math.abs(parsedUnit.scale)};
}
export function samePhysicsDimension(a: number[], b: number[]): boolean {
  return a.length === 7 && b.length === 7 && a.every((v, i) => Math.abs(v - b[i]) < 1e-10);
}
export function physicsQuantitiesEquivalent(a: PhysicsQuantity, b: PhysicsQuantity): boolean {
  return samePhysicsDimension(a.dimension, b.dimension) && Math.abs(a.siValue - b.siValue) <= Math.max(1e-12 * Math.max(Math.abs(a.siValue), Math.abs(b.siValue)), Math.min(a.siRounding, b.siRounding)) * (1 + 1e-9);
}
/** Conservatively extracts unit-bearing values only. Indices refer to the
 * normalized text; use normalizePhysicsMath before slicing that text. */
export function extractPhysicsQuantities(raw: string): ExtractedPhysicsQuantity[] {
  const text = normalizePhysicsMath(raw), out: ExtractedPhysicsQuantity[] = [];
  const pattern = new RegExp(PHYSICS_NUMBER_PATTERN, 'g');
  for (const match of text.matchAll(pattern)) {
    if (out.length >= 100) break;
    const before = text.slice(0, match.index), offset = match.index! + match[0].length;
    if (/[A-Za-z_^\d.]$/.test(before)) continue;
    const suffix = text.slice(offset).match(/^\s*[A-Za-zμΩ%]+(?:\s*\^?\s*[-+]?\d+)?(?:\s*(?:[*/]\s*|\s+)[A-Za-zμΩ%]+(?:\s*\^?\s*[-+]?\d+)?)*/)?.[0];
    if (!suffix) continue;
    // A greedy unit candidate can consume prose. Remove whole trailing tokens,
    // never a suffix of an unsupported symbol ("meters" must not become m).
    const pieces = suffix.trim().split(/\s+/);
    for (let count = pieces.length; count > 0; count--) {
      const unitText = pieces.slice(0, count).join(' ');
      const consumed = suffix.indexOf(unitText) + unitText.length;
      const candidate = match[0] + suffix.slice(0, consumed), parsed = parsePhysicsQuantity(candidate);
      if (!parsed) continue;
      out.push({...parsed, raw: candidate, index: match.index!, end: match.index! + candidate.length}); break;
    }
  }
  return out;
}
