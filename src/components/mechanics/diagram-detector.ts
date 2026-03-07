import type { MechanicsConfig, SlopeConfig, PulleyConfig, BeamConfig, ProjectileConfig, RodConfig } from './types';

/**
 * Attempts to infer a MechanicsConfig from question text.
 * Returns null if no mechanics diagram is appropriate.
 */
export function detectDiagramConfig(questionText: string): MechanicsConfig | null {
  const text = questionText.toLowerCase();

  // Rod / Ladder leaning against wall
  if (
    (text.includes('rod') || text.includes('ladder')) &&
    (text.includes('wall') || text.includes('lean'))
  ) {
    const angleMatch = text.match(/(\d+)\s*°/);
    const angle = angleMatch ? parseInt(angleMatch[1], 10) : 50;
    const wallSmooth = text.includes('smooth wall') || text.includes('smooth vertical');
    const floorSmooth = text.includes('smooth floor') || text.includes('smooth horizontal') || text.includes('smooth ground');
    return {
      type: 'rod',
      angle,
      mass: extractMassLabel(text),
      length: extractLengthLabel(text),
      wallType: wallSmooth ? 'smooth' : 'rough',
      floorType: floorSmooth ? 'smooth' : 'rough',
      showForces: true,
      showLabels: true,
    } satisfies RodConfig;
  }

  // Pulley / connected particles
  if (text.includes('pulley') || text.includes('connected') && text.includes('string')) {
    const masses = extractTwoMasses(text);
    const isRough = text.includes('rough');
    return {
      type: 'pulley',
      surface: isRough ? 'rough' : 'smooth',
      angle: 0,
      masses: { hanging: masses[0], onSurface: masses[1] },
      showLabels: true,
      showForces: true,
      friction: isRough,
    } satisfies PulleyConfig;
  }

  // Beam / moments
  if (text.includes('beam') || text.includes('plank') || text.includes('uniform rod') && text.includes('pivot')) {
    const lengthMatch = text.match(/(\d+)\s*m\b/);
    const length = lengthMatch ? parseInt(lengthMatch[1], 10) : 6;
    return {
      type: 'beam',
      length,
      pivot: { type: 'support', position: length / 3 },
      loads: [
        { position: 0, magnitude: 10, label: 'W' },
        { position: length, magnitude: 10, label: 'W' },
      ],
      reactions: [{ position: length / 3, label: 'R' }],
      showLabels: true,
    } satisfies BeamConfig;
  }

  // Projectile
  if (text.includes('projectile') || text.includes('launched') || text.includes('thrown') && text.includes('angle')) {
    const speedMatch = text.match(/(\d+)\s*m\s*s/);
    const speed = speedMatch ? parseInt(speedMatch[1], 10) : 28;
    const angleMatch = text.match(/(\d+)\s*°/);
    const angle = angleMatch ? parseInt(angleMatch[1], 10) : 45;
    const heightMatch = text.match(/height\s*(?:of\s*)?(\d+)/);
    const launchHeight = heightMatch ? parseInt(heightMatch[1], 10) : 0;
    return {
      type: 'projectile',
      speed,
      angle,
      launchHeight,
      targetX: 40,
      targetY: 20,
      showComponents: true,
      showLabels: true,
    } satisfies ProjectileConfig;
  }

  // Inclined plane / slope
  if (
    text.includes('inclined') ||
    text.includes('slope') ||
    text.includes('plane') ||
    (text.includes('rough') && text.includes('surface') && text.match(/\d+\s*°/)) ||
    (text.includes('particle') && text.match(/\d+\s*°/) && (text.includes('friction') || text.includes('normal')))
  ) {
    const angleMatch = text.match(/(\d+)\s*°/);
    const angle = angleMatch ? parseInt(angleMatch[1], 10) : 30;
    const isRough = text.includes('rough');
    return {
      type: 'slope',
      angle,
      mass: extractMassLabel(text),
      surface: isRough ? 'rough' : 'smooth',
      showNormal: true,
      showWeight: true,
      showFriction: isRough,
      showComponents: false,
      showLabels: true,
    } satisfies SlopeConfig;
  }

  // Horizontal rough/smooth surface with forces (no angle)
  if (
    (text.includes('rough') || text.includes('smooth')) &&
    (text.includes('surface') || text.includes('horizontal')) &&
    (text.includes('particle') || text.includes('block') || text.includes('mass'))
  ) {
    const isRough = text.includes('rough');
    return {
      type: 'slope',
      angle: 0,
      mass: extractMassLabel(text),
      surface: isRough ? 'rough' : 'smooth',
      showNormal: true,
      showWeight: true,
      showFriction: isRough,
      showComponents: false,
      showLabels: true,
    } satisfies SlopeConfig;
  }

  return null;
}

function extractMassLabel(text: string): string {
  const kgMatch = text.match(/(\d+)\s*kg/);
  if (kgMatch) return kgMatch[1];
  const mMatch = text.match(/mass\s+([A-Z])/i);
  if (mMatch) return mMatch[1];
  return 'm';
}

function extractLengthLabel(text: string): string {
  const mMatch = text.match(/length\s+(\d+\s*m|[a-z0-9]+)/i);
  if (mMatch) return mMatch[1];
  const aMatch = text.match(/(\d+a|2a|3a)/);
  if (aMatch) return aMatch[1];
  return '2a';
}

function extractTwoMasses(text: string): [number, number] {
  const matches = text.match(/(\d+)\s*kg/g);
  if (matches && matches.length >= 2) {
    const nums = matches.map(m => parseInt(m));
    return [nums[0], nums[1]];
  }
  return [3, 5];
}
