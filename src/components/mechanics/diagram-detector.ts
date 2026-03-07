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

  // ── Beam / rod / plank / moments (but NOT rod leaning against wall) ──
  if (
    ((text.includes('beam') || text.includes('plank') || text.includes('uniform rod')) &&
    (text.includes('pivot') || text.includes('support') || text.includes('moment') || text.includes('wire') || text.includes('tension'))) ||
    (text.includes('rod') && text.includes('horizontal') && !text.includes('wall') && !text.includes('lean'))
  ) {
    const lengthMatch = text.match(/length\s+(\d+\.?\d*)\s*m/i) || text.match(/(\d+\.?\d*)\s*m\s+(?:long|in length)/i) || text.match(/(\d+)\s*m\b/);
    const length = lengthMatch ? parseFloat(lengthMatch[1]) : 6;
    const unknowns = detectUnknowns(text);

    // Extract rod/beam mass
    const rodMassMatch = text.match(/(?:rod|beam|plank)\s+\w+\s+(?:has\s+)?(?:length\s+\S+\s+(?:m\s+)?and\s+)?mass\s+(\d+\.?\d*)\s*kg/i)
      || text.match(/mass\s+(\d+\.?\d*)\s*kg/i);
    const rodMass = rodMassMatch ? parseFloat(rodMassMatch[1]) : null;

    // Extract point masses with positions (e.g., "particle of mass 4 kg ... at ... AC = 0.8 m")
    const pointLoads: { position: number; magnitude: number; label: string }[] = [];
    const pointLabels: { position: number; label: string }[] = [];

    // Find particle/mass attachments with named points
    const particleMatches = text.matchAll(/(?:particle|mass|load)\s+(?:of\s+)?(?:mass\s+)?(\d+\.?\d*)\s*kg\s+.*?(?:at|from)\s+(?:a\s+)?point\s+([A-Z])/gi);
    for (const pm of particleMatches) {
      const mass = parseFloat(pm[1]);
      const pointName = pm[2];
      // Look for distance like AC = 0.8 m or "0.8 m from A"
      const distPattern = new RegExp(`[A-Z]${pointName}\\s*=\\s*(\\d+\\.?\\d*)\\s*m|${pointName}.*?(\\d+\\.?\\d*)\\s*m\\s*from`, 'i');
      const distMatch = text.match(distPattern);
      const pos = distMatch ? parseFloat(distMatch[1] || distMatch[2]) : length / 2;
      pointLoads.push({ position: pos, magnitude: mass, label: `${mass}g` });
      pointLabels.push({ position: pos, label: pointName });
    }

    // If no particle matches found, try simpler patterns
    if (pointLoads.length === 0) {
      const simpleMassMatches = text.matchAll(/(\d+\.?\d*)\s*kg\s+.*?(\d+\.?\d*)\s*m\s+from/gi);
      for (const sm of simpleMassMatches) {
        const mass = parseFloat(sm[1]);
        const pos = parseFloat(sm[2]);
        if (rodMass && mass === rodMass) continue; // skip rod's own mass
        pointLoads.push({ position: pos, magnitude: mass, label: `${mass}g` });
      }
    }

    // Detect support types and positions
    const hasWires = text.includes('wire');
    const hasPivot = text.includes('pivot');
    const reactions: { position: number; label: string; isUnknown?: boolean }[] = [];

    // Check for "attached at A and B" pattern (two end supports)
    if (/(?:attached|fixed)\s+at\s+[A-Z]\s+and\s+[A-Z]/i.test(text) || (hasWires && /at\s+[A-Z]\s+and\s+[A-Z]/i.test(text))) {
      const isTA_unknown = unknowns.includes('tension') || /tension\s+(?:in\s+)?(?:the\s+)?wire\s+at\s+A/i.test(text) || /find.*tension/i.test(text);
      const isTB_unknown = unknowns.includes('tension') || /tension\s+(?:in\s+)?(?:the\s+)?wire\s+at\s+B/i.test(text) || /find.*tension/i.test(text);
      reactions.push({ position: 0, label: 'Tₐ', isUnknown: isTA_unknown });
      reactions.push({ position: length, label: 'T_B', isUnknown: isTB_unknown });
    } else if (hasPivot) {
      const pivotDistMatch = text.match(/pivot\s+(?:at\s+)?(?:a\s+)?(?:point\s+)?(\d+\.?\d*)\s*m/i);
      const pivotPos = pivotDistMatch ? parseFloat(pivotDistMatch[1]) : length / 3;
      reactions.push({ position: pivotPos, label: 'R' });
    } else {
      // Default: support at one third
      reactions.push({ position: length / 3, label: 'R' });
    }

    return {
      type: 'beam',
      length,
      pivot: { type: hasPivot ? 'support' : (hasWires ? 'hinge' : 'support'), position: reactions[0]?.position ?? 0 },
      loads: pointLoads,
      reactions,
      showLabels: true,
      endLabels: { left: 'A', right: 'B' },
      pointLabels,
      distributedMass: rodMass ? { position: length / 2, label: `${rodMass}g` } : undefined,
    } satisfies BeamConfig;
  }

  // ── Projectile (at an angle, not vertical) ──
  if (
    text.includes('projectile') ||
    text.includes('projected from') ||
    text.includes('projected at') ||
    text.includes('launched at') ||
    (text.includes('projected') && !text.includes('vertically') && (
      text.match(/(\d+)\s*°/) ||
      text.includes('angle') ||
      text.includes('above the horizontal') ||
      text.includes('horizontal')
    ))
  ) {
    const unknowns = detectUnknowns(text);

    // Extract speed — may be symbolic (U, u, V)
    const symbolicSpeedMatch = text.match(/(?:initial\s+)?speed\s+(?:of\s+)?([A-Z])\s*m/i);
    const numericSpeedMatch = text.match(/(\d+\.?\d*)\s*m\s*s/);
    let speed: string | number = 28;
    let speedLabel: string | undefined;
    if (symbolicSpeedMatch) {
      speed = symbolicSpeedMatch[1];
      speedLabel = symbolicSpeedMatch[1];
    } else if (numericSpeedMatch) {
      speed = parseFloat(numericSpeedMatch[1]);
      if (unknowns.includes('speed')) {
        speedLabel = 'U';
      }
    }

    // Extract angle — may be symbolic (α, θ)
    const symbolicAngleMatch = text.match(/angle\s+(?:of\s+)?([αθ]|alpha|theta)/i);
    const numericAngleMatch = text.match(/(\d+)\s*°/);
    let angle: string | number = 45;
    let angleLabel: string | undefined;
    if (symbolicAngleMatch) {
      const sym = symbolicAngleMatch[1];
      angle = sym === 'alpha' ? 'α' : sym === 'theta' ? 'θ' : sym;
      angleLabel = typeof angle === 'string' ? angle : undefined;
    } else if (text.includes('above the horizontal') && !numericAngleMatch) {
      // Angle referenced but no number → symbolic
      angle = 'α';
      angleLabel = 'α';
    } else if (numericAngleMatch) {
      angle = parseInt(numericAngleMatch[1], 10);
      if (unknowns.includes('angle')) {
        angleLabel = 'θ';
      }
    }

    // Extract landing distance (horizontal range)
    const rangeMatch = text.match(/(?:horizontal\s+)?(?:distance|range)\s+(?:from\s+\w+\s+(?:to\s+)?)?(?:where\s+.*?)?\s*(?:is\s+)?(\d+\.?\d*)\s*m/i)
      || text.match(/(\d+\.?\d*)\s*m\s*(?:from|away)/i);
    const landingX = rangeMatch ? parseFloat(rangeMatch[1]) : undefined;

    // Extract time to max height
    const timeMaxMatch = text.match(/(?:maximum|greatest|max)\s*height\s*(?:at|when|after)\s*(?:t\s*=?\s*)?(\d+\.?\d*)\s*s/i)
      || text.match(/t\s*=\s*(\d+\.?\d*)\s*s/i);
    const timeToMax = timeMaxMatch ? parseFloat(timeMaxMatch[1]) : undefined;

    // Detect if max height is unknown
    if (/(?:find|calculate|determine)\s+(?:the\s+)?(?:greatest|maximum|max)\s*height/i.test(text)) {
      if (!unknowns.includes('maxHeight')) unknowns.push('maxHeight');
    }

    // Add speed/angle to unknowns if symbolic
    if (typeof speed === 'string' && !unknowns.includes('U')) unknowns.push('U');
    if (typeof angle === 'string' && !unknowns.includes('α')) unknowns.push('α');

    const heightMatch = text.match(/height\s*(?:of\s*)?(\d+)/);
    const launchHeight = heightMatch ? parseInt(heightMatch[1], 10) : 0;

    return {
      type: 'projectile',
      speed: typeof speed === 'number' ? speed : 40,
      angle: typeof angle === 'number' ? angle : 40,
      launchHeight,
      targetX: 40,
      targetY: 20,
      showComponents: true,
      showLabels: true,
      landingX,
      timeToMax,
      unknowns,
      speedLabel,
      angleLabel,
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
