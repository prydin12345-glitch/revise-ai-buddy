// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {markSingleChoice,singleChoiceKey} from '../functions/_shared/single-choice-marking';
const question={question_type:'mcq',marks:1,options:['$40\\,\\mu\\mathrm{F}$','$80\\,\\mu\\mathrm{F}$','$160\\,\\mu\\mathrm{F}$','$320\\,\\mu\\mathrm{F}$'],correct_answer:'80\\,μF'};
describe('single-select physics marking uses the unique saved option',()=>{
  it.each(['B','$80\\,\\mu\\mathrm{F}$','80 µF','80\\,μF'])('marks an equivalent selected option without a provider: %s',answer=>{
    expect(markSingleChoice(question,answer)).toMatchObject({score:1,isCorrect:true});
  });
  it.each(['A','','A and B','80 mF'])('marks an incorrect or ambiguous response as zero: %s',answer=>{
    expect(markSingleChoice(question,answer)).toMatchObject({score:0,isCorrect:false});
  });
  it('distinguishes upper/lower case unit prefixes and variables',()=>{
    const q={options:['1 mF','1 MF','1 μF','1 nF'],correct_answer:'1 MF'};
    expect(markSingleChoice(q,'A').score).toBe(0);expect(markSingleChoice(q,'B').score).toBe(1);
    expect(markSingleChoice({options:['$r$','$R$','$r^2$','$R^2$'],correct_answer:'R'},'B').score).toBe(1);
  });
  it('retains the bare A-D choice safeguard after preserving symbol case',()=>{
    expect(()=>singleChoiceKey({options:['A','B','C','D'],correct_answer:'B'})).toThrow(/descriptive option/);
  });
  it('refuses equivalent duplicate choices instead of choosing the first',()=>{
    expect(()=>singleChoiceKey({options:['$R$','R','$2R$','$4R$'],correct_answer:'R'})).toThrow(/distinct/);
    expect(()=>singleChoiceKey({options:['N A⁻¹ m⁻¹','$N\\,A^{-1}\\,m^{-1}$','T s','Wb'],correct_answer:'A'})).toThrow(/distinct/);
  });
  it('refuses conflicting answer declarations instead of awarding zero',()=>{
    expect(()=>singleChoiceKey({...question,correct_answer:'B\n\nCorrect answer: C'})).toThrow(/matching private key/);
  });
});


it.each(['B\nA','B\nCorrect answer C','B\nOption C is correct'])('does not mark using a conflicting short private key: %s',key=>{
  expect(()=>markSingleChoice({...question,correct_answer:key},'B')).toThrow(/matching private key/);
});
