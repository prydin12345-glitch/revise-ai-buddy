// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {analyseGroupRepair} from '../functions/_shared/prepare-group-repair';

const scope={subject:'Physics',examBoard:'AQA',educationalLevel:'A-level',assessmentTier:'not_tiered' as const};
const circuit={type:'circuit',nodes:[{id:'a',x:0,y:0}],wires:[{from:'a',to:'a',component:'capacitor'}]};
const graph={type:'line_chart',xAxisLabel:'Time / s',yAxisLabel:'Potential difference / V',datasets:[{label:'Discharge',data:[{x:0,y:12},{x:2,y:7.3}]}]};
const original={id:'part-1',question_number:'1',question_type:'short_answer',marks:2,topic_tag:'Capacitance',
  question_text:'A capacitor has capacitance 80 microfarads and is charged to 12 V. Calculate its stored energy.',
  correct_answer:'0.00576 J',diagram_config:circuit,requires_resource:true};
const repaired={question_number:'1',context:'A capacitor has capacitance 80 microfarads and is charged to 12 V.',
  task:'Calculate its stored energy.',correct_answer:'E = 0.5 C V² = 0.00576 J.',diagram_config:null};
const apply=(part:any=repaired,row:any=original,required=new Set<string>(),allow=new Set(['1']))=>
  analyseGroupRepair([row],[part],scope,required,new Set(['1']),'full_group',allow);

describe('removing an invalid optional circuit requires trusted authorization and a complete rewrite',()=>{
  it('accepts a self-contained complete task and key only with the server allowlist',()=>{
    const before=structuredClone(original),result=apply();
    expect(result.ok).toBe(true);expect(result.diagnostics).toEqual([]);
    expect(result.replacements['1']).toMatchObject({id:'part-1',question_number:'1',marks:2,diagram_config:null,requires_resource:false,
      correct_answer:repaired.correct_answer});
    expect(result.replacements['1'].question_text).toContain('80 microfarads');
    expect(original).toEqual(before);
    expect(apply(repaired,original,new Set(),new Set()).ok).toBe(false);
  });
  it('clears all invalid circuit aliases rather than letting an old alias render again',()=>{
    const result=apply(repaired,{...original,diagramConfig:circuit,chart_data:circuit});
    expect(result.ok).toBe(true);
    expect(result.replacements['1']).toMatchObject({diagram_config:null,diagramConfig:null,chart_data:null});
  });
  it.each([
    ['missing task',{...repaired,task:'A capacitor stores energy.'},'missing_task'],
    ['missing private key',{...repaired,correct_answer:''},'missing_answer'],
    ['retained figure reference',{...repaired,task:'Use Figure 1 to calculate the energy.'},'missing_required_resource'],
    ['unnumbered graph dependency',{...repaired,task:'Use the graph to determine the energy.'},'missing_required_resource'],
  ])('rejects %s rather than keeping a stale key or unresolved dependency',(_name,part,code)=>{
    const result=apply(part);expect(result.ok).toBe(false);expect(result.replacements).toEqual({});
    expect(result.diagnostics.some(item=>item.code===code)).toBe(true);
  });
  it('does not allow removal when the plan requires a graph or table',()=>{
    const result=apply(repaired,original,new Set(['1']));
    expect(result.ok).toBe(false);expect(result.diagnostics[0].code).toBe('missing_required_resource');
  });
  it.each([
    ['valid graph',{...original,diagram_config:graph}],
    ['valid table',{...original,diagram_config:{type:'data_table',headers:['Time / s','Voltage / V'],rows:[[0,12],[2,7.3]]}}],
    ['topology-dependent circuit',{...original,question_text:'The circuit shown has two capacitors connected in parallel. Calculate the total capacitance.'}],
  ])('preserves a %s even if mistakenly included in a removal allowlist',(_name,row)=>{
    const result=apply(repaired,row);expect(result.ok).toBe(false);
    expect(result.diagnostics.some(item=>item.code==='missing_required_resource')).toBe(true);
  });
  it('does not turn a task-only fix into a resource-removal rewrite',()=>{
    const result=analyseGroupRepair([original],[{question_number:'1',task:'Calculate the stored energy.',correct_answer:'0.00576 J'}],scope,
      new Set(),new Set(['1']),'task_only',new Set(['1']));
    expect(result.ok).toBe(true);expect(result.replacements['1'].diagram_config).toEqual(circuit);
    expect(result.replacements['1'].requires_resource).toBe(true);
  });
});
