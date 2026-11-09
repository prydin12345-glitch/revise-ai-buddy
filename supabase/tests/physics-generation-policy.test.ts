// @vitest-environment node
import { expect, it } from 'vitest';
import { usesPhysicsGenerationContract } from '../functions/_shared/physics-generation-policy';

it('requires a new server-written Physics snapshot and keeps historical attempts on their original policy', () => {
  const context = {resolved_by:'server',context_version:2,subject_name:'Physics'};
  expect(usesPhysicsGenerationContract(context)).toBe(false);
  expect(usesPhysicsGenerationContract({...context,physics_generation_version:1})).toBe(true);
  expect(usesPhysicsGenerationContract({...context,physics_generation_version:1,resolved_by:'client'})).toBe(false);
  expect(usesPhysicsGenerationContract({...context,physics_generation_version:1,subject_name:'Biology'})).toBe(false);
  expect(usesPhysicsGenerationContract({...context,physics_generation_version:99})).toBe(false);
});
