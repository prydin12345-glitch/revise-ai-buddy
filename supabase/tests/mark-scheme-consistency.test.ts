// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {markSchemeConsistencyIssues} from '../functions/_shared/mark-scheme-consistency';
describe('explicit private mark-scheme contradictions',()=>{
  it('rejects the reported final uncertainty when its own working/range requires another value',()=>{
    expect(markSchemeConsistencyIssues({correct_answer:'Absolute uncertainty: ±30 J kg^-1 K^-1.\nWorking:\nAbsolute uncertainty: ±43 J kg^-1 K^-1.\nAccept ±40 to ±45.'}).map(x=>x.code)).toContain('contradictory_mark_scheme');
  });
  it('rejects repeated named numerical assignments whose final answer contradicts the method',()=>{
    const q={correct_answer:'M = 1.72 × 10^27 kg;\nk = 2.91 × 10^15.\nWorking:\nk = 3.21 × 10^15;\nM = 1.90 × 10^27 kg.'};
    expect(markSchemeConsistencyIssues(q)).toHaveLength(2);
  });
  it('checks a separately supplied scheme as well as a combined private key',()=>{
    expect(markSchemeConsistencyIssues({correct_answer:'M = 1.72e27 kg',mark_scheme:'M = 1.90e27 kg'})).toHaveLength(1);
  });
  it('accepts corrected final answers, equivalent notation and appropriate rounding',()=>{
    expect(markSchemeConsistencyIssues({correct_answer:'M = 1.90 × 10^27 kg;\nk = 3.21 × 10^15.\nAbsolute uncertainty: ±43 J kg^-1 K^-1.\nWorking:\nk = 3.21e15;\nM = 1.9e27 kg.\nAbsolute uncertainty: ±43 J kg^-1 K^-1.\nAccept ±40 to ±45.'})).toEqual([]);
  });
  it('does not compare different variables, unit conventions or explicitly separate alternatives',()=>{
    expect(markSchemeConsistencyIssues({correct_answer:'r = 5 m.\nWorking:\nR = 10 m.'})).toEqual([]);
    expect(markSchemeConsistencyIssues({correct_answer:'M = 1.9 × 10^27 kg.\nWorking:\nM = 1.9 × 10^30 g.'})).toEqual([]);
    expect(markSchemeConsistencyIssues({correct_answer:'M = 1.9e27 kg.\nWorking:\nAlternative example:\nM = 2.5e27 kg.'})).toEqual([]);
  });
  it('does not pretend to evaluate arbitrary algebra, prose or examples without explicit final/working boundaries',()=>{
    expect(markSchemeConsistencyIssues({correct_answer:'A scientifically correct explanation.'})).toEqual([]);
    expect(markSchemeConsistencyIssues({correct_answer:'M = 1.72e27 kg; M = 1.90e27 kg.'})).toEqual([]);
    expect(markSchemeConsistencyIssues({correct_answer:'M = eval(untrusted code)\nWorking:\nM = 1e27 kg'})).toEqual([]);
  });
});
