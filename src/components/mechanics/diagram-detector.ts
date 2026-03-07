import type { MechanicsConfig, SlopeConfig, PulleyConfig, BeamConfig, ProjectileConfig, RodConfig, FreeBodyConfig, ConicalPendulumConfig, VerticalMotionConfig } from './types';

/**
 * Attempts to infer a MechanicsConfig from question text.
 * Returns null if no mechanics diagram is appropriate.
 */
export function detectDiagramConfig(questionText: string): MechanicsConfig | null {
  const text = questionText.toLowerCase();

  // ── Conical pendulum / horizontal circle ──
  if (
    text.includes('horizontal circle') ||
    text.includes('conical pendulum') ||
    (text.includes('string') && text.includes('fixed point') && text.includes('circle'))
  ) {
    const angleMatch = text.match(/(\d+)\s*°/);
    const angle = angleMatch ? parseInt(angleMatch[1], 10) : 30;
    const massLabel = extractMassLabel(text);
    const unknowns = detectUnknowns(text);
    return {
      type: 'conical_pendulum',
      stringLength: extractNumber(text, /length\s*(?:of\s*)?(\d+\.?\d*)\s*m/) ?? 0.8,
      angle: unknowns.includes('angle') ? 30 : angle,
      mass: massLabel,
      omega: 'ω',
      showTension: true,
      showWeight: true,
      showRadius: true,
      unknowns,
      showLabels: true,
    } satisfies ConicalPendulumConfig;
  }

  // ── Vertical motion ──
  if (
    text.includes('projected vertically') ||
    text.includes('thrown vertically') ||
    text.includes('thrown upward') ||
    text.includes('falls from rest') ||
    text.includes('dropped from') ||
    (text.includes('vertically') && (text.includes('speed') || text.includes('velocity')))
  ) {
    const speedMatch = text.match(/(\d+\.?\d*)\s*m\s*s/);
    const speed = speedMatch ? parseFloat(speedMatch[1]) : 0;
    const direction = (text.includes('fall') || text.includes('drop') || text.includes('downward')) ? 'down' : 'up';
    const unknowns = detectUnknowns(text);
    return {
      type: 'vertical_motion',
      initialSpeed: speed,
      direction,
      mass: extractMassLabel(text),
      unknowns,
      showLabels: true,
    } satisfies VerticalMotionConfig;
  }

  // ── Rod / Ladder leaning against wall ──
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

  // ── Pulley / connected particles ──
  if (text.includes('pulley') || (text.includes('connected') && text.includes('string'))) {
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

  // ── Beam / moments (but NOT rod leaning) ──
  if (
    (text.includes('beam') || text.includes('plank')) &&
    (text.includes('pivot') || text.includes('support') || text.includes('moment'))
  ) {
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

  // ── Projectile (at an angle, not vertical) ──
  if (
    text.includes('projectile') ||
    (text.includes('projected') && text.match(/(\d+)\s*°/) && !text.includes('vertically'))
  ) {
    const speedMatch = text.match(/(\d+\.?\d*)\s*m\s*s/);
    const speed = speedMatch ? parseFloat(speedMatch[1]) : 28;
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

  // ── Inclined plane / slope (angle > 0) ──
  if (
    (text.includes('inclined') || text.includes('slope')) &&
    text.match(/(\d+)\s*°/)
  ) {
    const angleMatch = text.match(/(\d+)\s*°/);
    const angle = angleMatch ? parseInt(angleMatch[1], 10) : 30;
    if (angle > 0) {
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
  }

  // ── Horizontal surface / free body diagram (angle = 0) ──
  if (
    (text.includes('rough') || text.includes('smooth')) &&
    (text.includes('surface') || text.includes('horizontal') || text.includes('plane')) &&
    (text.includes('particle') || text.includes('block') || text.includes('mass') || text.includes('box'))
  ) {
    // Only match if there's no angle > 0 (those are slopes)
    const angleMatch = text.match(/(\d+)\s*°/);
    const angle = angleMatch ? parseInt(angleMatch[1], 10) : 0;
    if (angle === 0) {
      const isRough = text.includes('rough');
      const unknowns = detectUnknowns(text);
      const forceMatch = text.match(/force\s*(?:of\s*)?(\d+\.?\d*)\s*n/i);
      return {
        type: 'free_body',
        angle: 0,
        mass: extractMassLabel(text),
        appliedForce: forceMatch ? forceMatch[1] : undefined,
        appliedForceDir: 'horizontal',
        surface: isRough ? 'rough' : 'smooth',
        unknowns,
        showLabels: true,
      } satisfies FreeBodyConfig;
    }
  }

  return null;
}

/** Detect what the student is asked to find, so we can hide those values */
function detectUnknowns(text: string): string[] {
  const unknowns: string[] = [];
  const lower = text.toLowerCase();

  if (/find\s+(the\s+)?acceleration/i.test(lower)) unknowns.push('acceleration');
  if (/find\s+(the\s+)?tension/i.test(lower)) unknowns.push('tension');
  if (/find\s+(the\s+)?angle/i.test(lower) || /calculate\s+(the\s+)?angle/i.test(lower)) unknowns.push('angle');
  if (/find\s+(the\s+)?speed/i.test(lower) || /find\s+(the\s+)?velocity/i.test(lower)) unknowns.push('speed');
  if (/find\s+(the\s+)?time/i.test(lower) || /calculate\s+(the\s+)?time/i.test(lower)) unknowns.push('time');
  if (/find\s+(the\s+)?(greatest|max|maximum)\s*height/i.test(lower)) unknowns.push('maxHeight');
  if (/find\s+(the\s+)?normal/i.test(lower) || /find\s+(the\s+)?reaction/i.test(lower)) unknowns.push('normal');
  if (/find\s+(the\s+)?weight/i.test(lower)) unknowns.push('weight');
  if (/find\s+(the\s+)?friction/i.test(lower) || /find\s+(the\s+)?frictional/i.test(lower)) unknowns.push('friction');

  return unknowns;
}

function extractNumber(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  return m ? parseFloat(m[1]) : null;
}

function extractMassLabel(text: string): string {
  const kgMatch = text.match(/(\d+\.?\d*)\s*kg/);
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
  const matches = text.match(/(\d+\.?\d*)\s*kg/g);
  if (matches && matches.length >= 2) {
    const nums = matches.map(m => parseFloat(m));
    return [nums[0], nums[1]];
  }
  return [3, 5];
}
