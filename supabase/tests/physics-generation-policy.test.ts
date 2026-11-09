// @vitest-environment node
import { expect, it } from 'vitest';
import { usesPhysicsGenerationContract } from '../functions/_shared/physics-generation-policy';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';

it('requires a new server-written Physics snapshot and keeps historical attempts on their original policy', () => {
  const context = {resolved_by:'server',context_version:2,subject_name:'Physics'};
  expect(usesPhysicsGenerationContract(context)).toBe(false);
  expect(usesPhysicsGenerationContract({...context,physics_generation_version:1})).toBe(true);
  expect(usesPhysicsGenerationContract({...context,physics_generation_version:1,resolved_by:'client'})).toBe(false);
  expect(usesPhysicsGenerationContract({...context,physics_generation_version:1,subject_name:'Biology'})).toBe(false);
  expect(usesPhysicsGenerationContract({...context,physics_generation_version:99})).toBe(false);
});

it('blocks written/MCQ concept repeats in new Physics practice and ordinary papers without a template plan', () => {
  const figure = {type:'physics_no_figure',physics_figure_version:1,diagram_intent:'none'};
  const parts = [
    {question_number:'1',question_type:'short_answer',marks:2,question_text:"State Faraday's law of electromagnetic induction.",correct_answer:'The induced emf equals the rate of change of magnetic flux linkage.',diagram_config:figure},
    {question_number:'2',question_type:'mcq',marks:1,question_text:"Which statement expresses Faraday's law?",options:['Emf is the rate of change of flux linkage','Emf is the charge on a capacitor','Emf is resistance times charge','Emf is mass times acceleration'],correct_answer:'A',diagram_config:figure},
  ];
  const gate = validateQuestionCandidates(parts,{scope:{subject:'Physics'},physicsGeneration:true});
  expect(gate.defects.some(defect => defect.code === 'repeated_concept')).toBe(true);
  expect(validateQuestionCandidates(parts,{scope:{subject:'Physics'}}).ok).toBe(true);
});
