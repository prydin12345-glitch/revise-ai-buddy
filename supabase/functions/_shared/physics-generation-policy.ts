/** Frozen per-attempt policy. Existing attempts keep their original contract. */
export const PHYSICS_GENERATION_VERSION = 1;

export function usesPhysicsGenerationContract(context: unknown): boolean {
  const value = context as Record<string, unknown> | null;
  return !!value && value.resolved_by === 'server' &&
    [1, 2].includes(Number(value.context_version)) &&
    value.physics_generation_version === PHYSICS_GENERATION_VERSION &&
    /\bphysics\b/i.test(String(value.subject_name ?? ''));
}

export const PHYSICS_CACHE_VERSION = 'physics-structured-figures-v1';
