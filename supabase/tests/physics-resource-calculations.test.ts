// @vitest-environment node
import {expect, it} from 'vitest';
import {evaluatePhysicsExpression, physicsCalculationIssues} from '../functions/_shared/physics-calculation-integrity';

function tableCalculation() {
  return {
    question_type:'short_answer', question_text:'Use the measurements in the table to calculate the electrical power.',
    diagram_config:{type:'data_table',headers:['Potential difference (V)','Current (A)'],rows:[[12,2]]},
    correct_answer:{answer:'24.0 W',worked_solution:'P = VI = 24.0 W',calculation_checks:[{
      label:'power',inputs:[
        {name:'v',value:'12',unit:'V',source:'resource',quote:'12 V',resource_ref:{field:'diagram_config',row:0,column:0}},
        {name:'i',value:'2',unit:'A',source:'resource',quote:'2 A',resource_ref:{field:'diagram_config',row:0,column:1}},
      ],expression:{op:'multiply',args:[{input:'v'},{input:'i'}]},result:{value:'24.0',unit:'W',significant_figures:3},answer_quote:'24.0 W',working_quote:'24.0 W',
    }]},
  };
}
it('keeps qualitative evaluation and unit-expression MCQs distinct from numerical calculations', () => {
  expect(physicsCalculationIssues({question_text:'Evaluate the method used to determine the spring constant.',correct_answer:'Repeated readings reduce random uncertainty; check for hysteresis and systematic errors.'})).toEqual([]);
  expect(physicsCalculationIssues({question_type:'mcq',question_text:'Which is a unit equivalent to the tesla?',options:['N A^-1 m^-1','N A m','N m A^-1','N A^-1 m'],correct_answer:'A'})).toEqual([]);
  expect(physicsCalculationIssues({question_text:'Evaluate the energy from the measurements.',correct_answer:'24 J'}).some(issue => issue.code === 'unverified_calculation')).toBe(true);
});
it('recomputes from actual public measurement cells without putting their derived answer in the stem', () => {
  expect(physicsCalculationIssues(tableCalculation())).toEqual([]);
});
it('rejects changed, unitless or conflicting resource data and references to private expected data', () => {
  const changed = tableCalculation(); changed.diagram_config.rows[0][0] = 20;
  expect(physicsCalculationIssues(changed).length).toBeGreaterThan(0);
  const unitless = tableCalculation(); unitless.diagram_config.headers = ['Potential difference','Current'];
  expect(physicsCalculationIssues(unitless).length).toBeGreaterThan(0);
  const conflicting = {...tableCalculation(),chart_data:{type:'data_table',headers:['Potential difference (V)','Current (A)'],rows:[[30,2]]}};
  expect(physicsCalculationIssues(conflicting).length).toBeGreaterThan(0);
  const hidden: any = tableCalculation();
  hidden.diagram_config.correct_chart_data = structuredClone(hidden.diagram_config);
  hidden.correct_answer.calculation_checks[0].inputs[0].resource_ref.field = 'correct_chart_data';
  expect(physicsCalculationIssues(hidden).length).toBeGreaterThan(0);
});
it('evaluates bounded trigonometric and exponential Physics expressions in SI units', () => {
  const vertical = evaluatePhysicsExpression({op:'multiply',args:[{input:'u'},{op:'sin',args:[{input:'angle'}]}]}, {u:{value:20,unit:'m s^-1'},angle:{value:30,unit:'deg'}});
  expect(vertical.value).toBeCloseTo(10);
  expect(vertical.dimension).toEqual([0,1,-1,0,0,0,0]);
  const decay = evaluatePhysicsExpression({op:'multiply',args:[{input:'v'},{op:'exp',args:[{op:'divide',args:[{op:'multiply',args:[{literal:-1},{input:'t'}]},{input:'tau'}]}]}]}, {v:{value:12,unit:'V'},t:{value:4,unit:'s'},tau:{value:2,unit:'s'}});
  expect(decay.value).toBeCloseTo(12 * Math.exp(-2));
  expect(evaluatePhysicsExpression({op:'ln',args:[{input:'ratio'}]},{ratio:{value:2,unit:''}}).value).toBeCloseTo(Math.log(2));
});
it('rejects dimensionful function arguments, undefined tangent, invalid inverse/log domains and exponential overflow', () => {
  for (const [op,value,unit] of [['sin',3,'m'],['ln',-1,''],['asin',2,''],['exp',1000,''],['tan',90,'deg']] as const)
    expect(() => evaluatePhysicsExpression({op,args:[{input:'x'}]},{x:{value,unit}})).toThrow();
});
