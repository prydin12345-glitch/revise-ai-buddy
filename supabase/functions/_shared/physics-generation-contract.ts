import {readPhysicsFigureContract, PHYSICS_FIGURE_PROMPT} from './physics-diagram-contract.ts';
import {physicsCalculationPromptInstructions, physicsCalculationPrivateKey, readPhysicsCalculationKey,
  groundedPhysicsResourceQuantities, physicsQuantitiesEquivalent} from './physics-calculation-integrity.ts';
import {physicsPaperPlanPrompt, type PhysicsPaperPlan} from './physics-paper-plan.ts';

/** Keep the public contract when a canonical chart/circuit replaces its alias. */
export function physicsResourceForStorage(part: Record<string, any>, selectedResource: unknown): unknown {
  const contract = [part.diagram_config, part.diagramConfig, part.chart_data]
    .map(readPhysicsFigureContract).find(Boolean);
  if (!contract || !selectedResource || typeof selectedResource !== 'object' || Array.isArray(selectedResource))
    return selectedResource;
  return {...selectedResource, physics_figure_version:contract.version, diagram_intent:contract.intent};
}

/** Rebind a verified public alias to the one persisted public resource column.
 * Invalid/missing references are retained so the release gate rejects them. */
export function physicsPrivateKeyForStorage(part: Record<string, any>, resource: unknown): unknown {
  const key = readPhysicsCalculationKey(part);
  const serialized = physicsCalculationPrivateKey(part);
  if (!Array.isArray(key.checks) || typeof serialized !== 'string') return serialized;
  const envelope = JSON.parse(serialized);
  const original = groundedPhysicsResourceQuantities(part);
  const persisted = groundedPhysicsResourceQuantities({diagram_config:resource});
  const sameRef = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    ['field','row','column','dataset','point','axis'].every(field => a[field] === b[field]);
  envelope.calculation_checks = key.checks.map(check => {
    if (!check || typeof check !== 'object' || !Array.isArray(check.inputs)) return check;
    return {...check, inputs:check.inputs.map((input: any) => {
      if (input?.source !== 'resource' || !input.resource_ref || typeof input.resource_ref !== 'object') return input;
      const before = original.find(value => sameRef(value.ref as unknown as Record<string, unknown>, input.resource_ref));
      const afterRef = {...input.resource_ref, field:'diagram_config'};
      const after = persisted.find(value => sameRef(value.ref as unknown as Record<string, unknown>, afterRef));
      return before && after && before.quote === after.quote && physicsQuantitiesEquivalent(before.quantity, after.quantity)
        ? {...input, resource_ref:afterRef} : input;
    })};
  });
  return JSON.stringify(envelope);
}

export function physicsGenerationInstructions(plan?: PhysicsPaperPlan | null): string {
  return [PHYSICS_FIGURE_PROMPT, physicsCalculationPromptInstructions(), physicsPaperPlanPrompt(plan ?? null),
    'EXAMINER SELF-CHECK before returning the JSON: independently work through every task; compare the private final key with every calculation, figure, table, option and accepted range. Check units, assumptions, practical reasoning, mark allocation and the covered-concept ledger across written parts and MCQs. Rewrite a defective task and all dependent keys/resources together. Your self-check is not approval; deterministic release gates still apply.',
    'Use one canonical public resource per part. Put a physical setup in diagram_config; use diagram_intent=graph for a supplied graph/table. Split tasks needing different figures across planned siblings while preserving their marks, topics and independent answerability. Never include calculation_checks, private working or solutions in a public figure.',
  ].filter(Boolean).join('\n\n');
}
