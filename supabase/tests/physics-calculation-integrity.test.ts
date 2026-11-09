// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {
  evaluatePhysicsExpression, explicitPhysicsArithmeticIssues, physicsCalculationIssues,
  physicsCalculationPrivateKey, readPhysicsCalculationKey, type PhysicsCalculationCheck,
} from '../functions/_shared/physics-calculation-integrity';
import {
  extractPhysicsQuantities, parsePhysicsQuantity, parsePhysicsUnit,
  physicsQuantitiesEquivalent, samePhysicsDimension,
} from '../functions/_shared/physics-quantities';

const uncertaintyStem = 'An original laboratory sample has specific heat capacity 977 J kg^-1 K^-1 and percentage uncertainty 4.42%. Calculate its absolute uncertainty.';
const uncertaintyCheck = (): PhysicsCalculationCheck => ({
  label:'absolute uncertainty',
  inputs:[{name:'c',value:'977',unit:'J kg^-1 K^-1',source:'stem',quote:'977 J kg^-1 K^-1'},
    {name:'p',value:'4.42',unit:'%',source:'stem',quote:'4.42%'}],
  expression:{op:'multiply',args:[{input:'c'},{input:'p'}]},
  result:{value:'43',unit:'J kg^-1 K^-1',significant_figures:2},
  answer_quote:'±43 J kg^-1 K^-1', working_quote:'43.1834 J kg^-1 K^-1',
});
const validUncertainty = () => ({question_text:uncertaintyStem,
  correct_answer:'Absolute uncertainty: ±43 J kg^-1 K^-1.\nWorking:\n0.0442 × 977 = 43.1834 J kg^-1 K^-1.\nAbsolute uncertainty: ±43 J kg^-1 K^-1. Accept ±40 to ±45.',
  calculation_checks:[uncertaintyCheck()]});
const energyCheck = (): PhysicsCalculationCheck => ({label:'power',inputs:[
  {name:'v',value:'12.0',unit:'V',source:'stem',quote:'12.0 V'},
  {name:'i',value:'2.00',unit:'A',source:'stem',quote:'2.00 A'},
],expression:{op:'multiply',args:[{input:'v'},{input:'i'}]},result:{value:'24.0',unit:'W',significant_figures:3},answer_quote:'24.0 W'});
const energyPart = () => ({question_text:'A lamp has potential difference 12.0 V and current 2.00 A. Calculate its power.',correct_answer:'24.0 W',calculation_checks:[energyCheck()]});

describe('Physics SI quantity parsing',()=>{
  it('parses SI compound dimensions, prefixes, percentages and scientific notation',()=>{
    expect(parsePhysicsQuantity('±43 J kg^-1 K^-1')?.dimension).toEqual([0,2,-2,0,-1,0,0]);
    expect(parsePhysicsQuantity('3.21 × 10^{15} m³ s⁻²')?.siValue).toBe(3.21e15);
    expect(parsePhysicsQuantity('$2.50\\,\\mathrm{mA}$')?.siValue).toBe(.0025);
    expect(parsePhysicsQuantity('4.42%')?.siValue).toBeCloseTo(.0442);
    expect(parsePhysicsQuantity('200 μF')?.siValue).toBeCloseTo(.0002);
    expect(parsePhysicsQuantity('90deg')?.siValue).toBeCloseTo(Math.PI/2);
    expect(parsePhysicsQuantity('0.20 m/s')?.dimension).toEqual([0,1,-1,0,0,0,0]);
  });
  it('compares conversions without accepting invented input precision or wrong dimensions',()=>{
    expect(physicsQuantitiesEquivalent(parsePhysicsQuantity('2.50 mA')!,parsePhysicsQuantity('0.00250 A')!)).toBe(true);
    expect(physicsQuantitiesEquivalent(parsePhysicsQuantity('2.5 mA')!,parsePhysicsQuantity('2.54 mA')!)).toBe(false);
    expect(physicsQuantitiesEquivalent(parsePhysicsQuantity('3.21 kg')!,parsePhysicsQuantity('3.21 m')!)).toBe(false);
    expect(samePhysicsDimension(parsePhysicsUnit('N m^2 kg^-2')!.dimension,[-1,3,-2,0,0,0,0])).toBe(true);
  });
  it('rejects ambiguous/unsupported units and non-finite or unsafe syntax',()=>{
    for(const raw of ['NaN m','Infinity m','1e500 m','2 meters','3 m/(s kg)','4 °C','1; globalThis.secret()','2 m/s/kg']) expect(parsePhysicsQuantity(raw)).toBeNull();
  });
  it('extracts separate quantities without swallowing adjacent prose or percentages',()=>{
    const values=extractPhysicsQuantities(uncertaintyStem);
    expect(values.map(q=>q.siValue)).toEqual([977,.0442]);
    expect(extractPhysicsQuantities('Voltage 12.0 V; current 2.00 A.')).toHaveLength(2);
  });
});
describe('deterministic Physics private calculation checks',()=>{
  it('recomputes the uncertainty example and accepts the corrected rounded answer',()=>{
    expect(physicsCalculationIssues(validUncertainty())).toEqual([]);
  });
  it('blocks the reported ±30 headline against its ±43 working and accepted range',()=>{
    const part=validUncertainty();part.correct_answer=part.correct_answer.replace('±43','±30');
    const issues=physicsCalculationIssues(part);
    expect(issues.some(issue=>issue.code==='contradictory_mark_scheme')).toBe(true);
    expect(issues.some(issue=>issue.code==='invalid_calculation')).toBe(true);
  });
  it('rejects fabricated matching evidence for a wrong uncertainty rather than trusting model assertions',()=>{
    const part=validUncertainty();part.correct_answer='Absolute uncertainty: ±30 J kg^-1 K^-1.\nWorking:\nAbsolute uncertainty: ±30 J kg^-1 K^-1.';
    part.calculation_checks[0].result.value='30';part.calculation_checks[0].answer_quote='±30 J kg^-1 K^-1';part.calculation_checks[0].working_quote='±30 J kg^-1 K^-1';
    expect(physicsCalculationIssues(part).some(issue=>issue.detail.includes('recomputed expression'))).toBe(true);
  });
  it('recomputes orbital mass using the supplied R and G and rejects the reported conflicting headline',()=>{
    const rcheck:PhysicsCalculationCheck={label:'orbital ratio',inputs:[{name:'R',value:'3.21e15',unit:'m^3 s^-2',source:'stem',quote:'3.21 × 10^15 m^3 s^-2'}],expression:{input:'R'},result:{value:'3.21e15',unit:'m^3 s^-2',significant_figures:3},answer_quote:'3.21 × 10^15 m^3 s^-2',working_quote:'3.21 × 10^15 m^3 s^-2'};
    const mass:PhysicsCalculationCheck={label:'mass',inputs:[...rcheck.inputs,{name:'G',value:'6.67e-11',unit:'N m^2 kg^-2',source:'stem',quote:'6.67 × 10^-11 N m^2 kg^-2'}],
      expression:{op:'divide',args:[{op:'multiply',args:[{literal:4},{op:'power',args:[{constant:'pi'},{literal:2}]},{input:'R'}]},{input:'G'}]},
      result:{value:'1.90e27',unit:'kg',significant_figures:3},answer_quote:'1.90 × 10^27 kg',working_quote:'1.90 × 10^27 kg'};
    const part={question_text:'For an original orbital example, R is 3.21 × 10^15 m^3 s^-2. Calculate planet mass using G = 6.67 × 10^-11 N m^2 kg^-2.',
      correct_answer:'R = 3.21 × 10^15 m^3 s^-2; M = 1.90 × 10^27 kg.\nWorking:\nR = 3.21 × 10^15 m^3 s^-2; M = 1.90 × 10^27 kg.',calculation_checks:[rcheck,mass]};
    expect(physicsCalculationIssues(part)).toEqual([]);
    part.correct_answer=part.correct_answer.replace('3.21','2.91').replace('1.90','1.72');
    expect(physicsCalculationIssues(part).filter(issue=>issue.code==='contradictory_mark_scheme')).toHaveLength(2);
  });
  it('accepts equivalent scientific notation and appropriate explicit decimal rounding',()=>{
    const part=energyPart();part.correct_answer='0.0240 kW';part.calculation_checks[0].result={value:'0.0240',unit:'kW',decimal_places:4};part.calculation_checks[0].answer_quote='0.0240 kW';
    expect(physicsCalculationIssues(part)).toEqual([]);
  });
  it('checks input quantities against exact visible stem quotes and dimensional units',()=>{
    const wrongValue=energyPart();wrongValue.calculation_checks[0].inputs[0].value='14';
    expect(physicsCalculationIssues(wrongValue).some(issue=>issue.detail.includes('student-visible stem'))).toBe(true);
    const invented=energyPart();invented.calculation_checks[0].inputs[0].quote='14.0 V';invented.calculation_checks[0].inputs[0].value='14.0';
    expect(physicsCalculationIssues(invented).some(issue=>issue.detail.includes('student-visible stem'))).toBe(true);
    const wrongUnit=energyPart();wrongUnit.calculation_checks[0].result.unit='J';
    expect(physicsCalculationIssues(wrongUnit).some(issue=>issue.detail.includes('dimensions'))).toBe(true);
  });
  it('does not accept fabricated expressions or unrelated source quantities as verification',()=>{
    const part=energyPart();part.calculation_checks[0].expression={literal:24};
    expect(physicsCalculationIssues(part).some(issue=>issue.detail.includes('arbitrary numeric expression literals'))).toBe(true);
    part.calculation_checks[0].expression={input:'v'};
    expect(physicsCalculationIssues(part).some(issue=>issue.detail.includes('all declared grounded inputs'))).toBe(true);
  });
  it('requires every claimed final quantity to be covered, not only a convenient correct number',()=>{
    const part=energyPart();part.correct_answer='24.0 W; energy = 500 J';
    expect(physicsCalculationIssues(part).some(issue=>issue.code==='unverified_calculation')).toBe(true);
  });
  it('checks correct MCQ letter against the selected numerical option',()=>{
    const part={...energyPart(),question_type:'mcq',correct_answer:'B',options:['12.0 W','24.0 W','36.0 W','48.0 W']};
    expect(physicsCalculationIssues(part)).toEqual([]);
    part.correct_answer='A';
    expect(physicsCalculationIssues(part).some(issue=>issue.code==='invalid_calculation')).toBe(true);
  });
  it('links the worked solution rather than merely verifying a detached metadata result',()=>{
    const part=energyPart();Object.assign(part,{worked_solution:'P = 48.0 W.'});part.calculation_checks[0].working_quote='48.0 W';
    expect(physicsCalculationIssues(part).some(issue=>issue.detail.includes('worked solution'))).toBe(true);
  });
  it('preserves the private envelope across persistence and canonical MCQ answer overrides',()=>{
    const part={...energyPart(),correct_answer:'B',worked_solution:'P = 24.0 W.',mark_scheme:'Award 1 mark for 24.0 W.'};part.calculation_checks[0].working_quote='24.0 W';
    const persisted=physicsCalculationPrivateKey(part,'24.0 W');
    const read=readPhysicsCalculationKey({correct_answer:persisted});
    expect(read.answer).toBe('24.0 W');expect(read.working).toContain('Award 1 mark');expect(read.checks).toHaveLength(1);
    expect(physicsCalculationIssues({question_text:part.question_text,correct_answer:persisted})).toEqual([]);
    expect(physicsCalculationPrivateKey({correct_answer:'An explanation.'})).toBe('An explanation.');
  });
  it('flags unsupported or absent verification for numerical tasks while leaving explanations and historical calls alone',()=>{
    expect(physicsCalculationIssues({question_text:'Explain why the 12 V lamp gets hot.',correct_answer:'Electrical work transfers energy to thermal stores.'})).toEqual([]);
    expect(physicsCalculationIssues({question_text:'Calculate the value.',correct_answer:'$\\frac{14}{3}$'}).map(issue=>issue.code)).toContain('unverified_calculation');
    expect(physicsCalculationIssues({question_text:'Calculate the power.',correct_answer:'24 W'},{requireChecks:false})).toEqual([]);
  });
  it('derives bounded rounding tolerances and refuses model-specified giant tolerance shortcuts',()=>{
    const part=energyPart();part.correct_answer='50.0 W';part.calculation_checks[0].result.value='50.0';part.calculation_checks[0].answer_quote='50.0 W';Object.assign(part.calculation_checks[0].result,{tolerance:1e50});
    expect(physicsCalculationIssues(part).some(issue=>issue.detail.includes('recomputed expression'))).toBe(true);
    part.calculation_checks[0].result.significant_figures=0;
    expect(physicsCalculationIssues(part).some(issue=>issue.detail.includes('Significant figures'))).toBe(true);
  });
});
describe('bounded arithmetic evaluator',()=>{
  it('supports square roots, arithmetic and compatible dimensions',()=>{
    expect(evaluatePhysicsExpression({op:'sqrt',args:[{op:'multiply',args:[{input:'x'},{input:'x'}]}]},{x:{value:'300',unit:'cm'}})).toEqual({value:3,dimension:[0,1,0,0,0,0,0]});
    expect(evaluatePhysicsExpression({op:'add',args:[{input:'x'},{input:'y'}]},{x:{value:'1',unit:'m'},y:{value:'10',unit:'cm'}}).value).toBeCloseTo(1.1);
  });
  it('rejects arbitrary code, prototype names, division by zero, huge powers, and incompatible addition',()=>{
    const bad:unknown[]=['globalThis.process.exit()', {op:'eval',args:[]},{input:'__proto__'},
      {op:'divide',args:[{literal:1},{literal:0}]},{op:'power',args:[{literal:2},{literal:100}]},
      {op:'add',args:[{input:'x'},{input:'t'}]},{literal:4,extra:'ignored?'}];
    for(const expression of bad) expect(()=>evaluatePhysicsExpression(expression,{x:{value:'1',unit:'m'},t:{value:'1',unit:'s'}})).toThrow();
  });
  it('bounds expression size and nesting',()=>{
    let deep:unknown={input:'x'};for(let i=0;i<20;i++)deep={op:'abs',args:[deep]};
    expect(()=>evaluatePhysicsExpression(deep,{x:{value:'1',unit:'m'}})).toThrow();
  });
  it('conservatively checks unambiguous numeric substitution lines, including scientific notation',()=>{
    expect(explicitPhysicsArithmeticIssues('0.0442 × 977 = 30 J kg^-1 K^-1')).toHaveLength(1);
    expect(explicitPhysicsArithmeticIssues('4 * (3 + 2) = 21')).toHaveLength(1);
    expect(explicitPhysicsArithmeticIssues('4 × 10^3 / 2 = 2e3')).toEqual([]);
    expect(explicitPhysicsArithmeticIssues('M = 4π²R/G = 1.90e27 kg. Alternative example 2 * 3.')).toEqual([]);
    expect(explicitPhysicsArithmeticIssues('The qualitative comparison is an explanation.')).toEqual([]);
  });
});
