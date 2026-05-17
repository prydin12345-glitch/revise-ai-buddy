import type {
  PhysicsDiagramConfig,
  RayDiagramVariant,
  WaveDiagramVariant,
  MagneticFieldVariant,
  NuclearDecayVariant,
  MagneticFieldConfig,
  EMSpectrumConfig,
} from './types';

const has = (text: string, ...terms: string[]) =>
  terms.some(t => text.toLowerCase().includes(t.toLowerCase()));

export const detectPhysicsDiagram = (
  questionText: string,
  subject?: string,
): PhysicsDiagramConfig | null => {

  const text = questionText ?? '';
  const lower = text.toLowerCase();
  const subj = (subject ?? '').toLowerCase();

  // Subject gate — Physics and Science subjects worldwide:
  const isPhysicsSubject =
    /physics|physical\s*science|science|natural\s*science|combined\s*science|gcse\s*science|engineering|electronics|optics/i.test(subj) ||
    subj === '';

  if (!isPhysicsSubject) return null;

  // Suppression — purely descriptive questions get no diagram:
  const isDescriptive =
    /^(explain|describe|define|state|calculate|what\s+is\s+meant|why\s+does|how\s+does|give\s+one|give\s+two|name\s+two|list)/i.test(lower.trim()) &&
    !/\b(draw|sketch|show|diagram|label|illustrate|construct|complete)\b/i.test(lower);

  if (isDescriptive) return null;

  // Suppress mechanics/circuit questions handled elsewhere
  const isMechanicsQuestion =
    /pulley|inclined\s+plane|slope|moment|beam|projectile|trajectory|spring|collision|connected\s+particles|conical\s+pendulum/i.test(lower);

  const isCircuitQuestion =
    /circuit\s+diagram|wire\s+a\s+circuit|draw\s+a\s+circuit|series\s+circuit|parallel\s+circuit|complete\s+the\s+circuit/i.test(lower);

  if (isMechanicsQuestion || isCircuitQuestion) return null;

  // ── 1. Ray Diagrams ─────────────────────────────────────────────────────
  if (
    has(lower, 'ray diagram', 'ray-diagram') ||
    (has(lower, 'ray') && has(lower, 'diagram', 'draw', 'sketch', 'show')) ||
    has(lower, 'lens diagram', 'mirror diagram') ||
    has(lower, 'refraction diagram', 'reflection diagram') ||
    (has(lower, 'convex lens', 'concave lens', 'converging lens',
        'diverging lens', 'convex mirror', 'concave mirror') &&
     has(lower, 'draw', 'sketch', 'show', 'diagram', 'image', 'ray')) ||
    has(lower, 'total internal reflection', 'critical angle') ||
    has(lower, 'optical fibre', 'optical fiber') ||
    (has(lower, 'prism') && has(lower, 'light', 'ray', 'dispersion', 'refract')) ||
    has(lower, 'long sight', 'short sight', 'longsighted', 'shortsighted',
        'hyperopia', 'myopia', 'corrective lens') ||
    (has(lower, 'real image', 'virtual image', 'focal point', 'principal axis',
        'centre of curvature') && has(lower, 'draw', 'sketch', 'show', 'diagram'))
  ) {
    return buildRayDiagramConfig(lower, text);
  }

  // ── 2. Wave Diagrams ────────────────────────────────────────────────────
  if (
    has(lower, 'wave diagram', 'wave-diagram') ||
    (has(lower, 'draw', 'sketch', 'show') &&
     has(lower, 'wave', 'transverse', 'longitudinal',
         'standing wave', 'stationary wave')) ||
    has(lower, 'label the amplitude', 'label the wavelength',
        'mark the amplitude', 'mark the wavelength',
        'show the amplitude', 'show the wavelength') ||
    has(lower, 'superposition', 'interference pattern',
        'constructive interference', 'destructive interference') ||
    has(lower, 'standing wave', 'stationary wave') ||
    (has(lower, 'doppler effect') && has(lower, 'diagram', 'draw', 'show')) ||
    (has(lower, 'diffraction') && has(lower, 'diagram', 'draw', 'show', 'pattern')) ||
    (has(lower, 'wave profile', 'displacement-distance graph',
        'displacement-time graph') &&
     has(lower, 'draw', 'sketch', 'label'))
  ) {
    return buildWaveDiagramConfig(lower);
  }

  // ── 3. Magnetic Field Diagrams ──────────────────────────────────────────
  if (
    (has(lower, 'magnetic field', 'field lines', 'field pattern') &&
      has(lower, 'draw', 'sketch', 'show', 'diagram', 'label')) ||
    (has(lower, 'bar magnet') && has(lower, 'field', 'draw', 'sketch', 'show')) ||
    (has(lower, 'solenoid') && has(lower, 'field', 'draw', 'sketch')) ||
    (has(lower, 'electromagnet') && has(lower, 'field', 'draw', 'sketch')) ||
    (has(lower, 'motor effect', 'fleming') &&
      has(lower, 'diagram', 'draw', 'sketch', 'show', 'force')) ||
    (has(lower, 'current-carrying wire', 'current carrying wire') &&
      has(lower, 'field', 'draw', 'sketch')) ||
    (has(lower, 'flux pattern', 'flux lines', 'magnetic flux') &&
      has(lower, 'draw', 'sketch', 'show'))
  ) {
    return buildMagneticFieldConfig(lower);
  }

  // ── 4. Nuclear Decay ────────────────────────────────────────────────────
  if (
    has(lower, 'nuclear decay', 'radioactive decay') ||
    has(lower, 'alpha decay', 'beta decay', 'gamma decay',
        'alpha emission', 'beta emission', 'gamma emission') ||
    has(lower, 'decay equation', 'nuclear equation',
        'decay chain', 'decay series') ||
    (has(lower, 'alpha', 'beta', 'gamma') &&
     has(lower, 'penetrat', 'ionisation', 'ionization',
         'deflect', 'absorb', 'range') &&
     has(lower, 'diagram', 'draw', 'show', 'sketch', 'compare')) ||
    (has(lower, 'fission', 'fusion') &&
      has(lower, 'diagram', 'draw', 'show', 'sketch')) ||
    has(lower, 'radioactive emission', 'nuclear transmutation', 'radioactive series')
  ) {
    return buildNuclearDecayConfig(lower);
  }

  // ── 5. Electromagnetic Spectrum ─────────────────────────────────────────
  if (
    (has(lower, 'electromagnetic spectrum', 'em spectrum') &&
      has(lower, 'draw', 'sketch', 'show', 'label', 'diagram',
          'order', 'arrange', 'place')) ||
    has(lower, 'order of the spectrum', 'regions of the spectrum') ||
    (has(lower, 'radio wave', 'microwave', 'infrared', 'visible light',
        'ultraviolet', 'x-ray', 'gamma ray') &&
      has(lower, 'spectrum', 'order', 'arrange', 'wavelength', 'frequency') &&
      has(lower, 'draw', 'sketch', 'show', 'label', 'diagram'))
  ) {
    const highlightMap: Record<string, EMSpectrumConfig['highlightRegion']> = {
      'radio': 'radio', 'microwave': 'microwave',
      'infrared': 'infrared', 'visible': 'visible',
      'ultraviolet': 'ultraviolet', 'x-ray': 'xray',
      'gamma': 'gamma',
    };
    let highlight: EMSpectrumConfig['highlightRegion'];
    for (const [key, val] of Object.entries(highlightMap)) {
      if (has(lower, key)) { highlight = val; break; }
    }
    return {
      type: 'electromagnetic_spectrum',
      highlightRegion: highlight,
      showWavelength: true,
      showFrequency: true,
      showUses: has(lower, 'use', 'application', 'example'),
      title: 'The Electromagnetic Spectrum',
    };
  }

  return null;
};

// ─── Config builders ──────────────────────────────────────────────────────────

const buildRayDiagramConfig = (lower: string, originalText: string = lower): PhysicsDiagramConfig => {
  let variant: RayDiagramVariant = 'converging_lens';

  if (has(lower, 'concave mirror', 'converging mirror')) {
    variant = 'converging_mirror';
  } else if (has(lower, 'convex mirror', 'diverging mirror')) {
    variant = 'diverging_mirror';
  } else if (has(lower, 'plane mirror', 'flat mirror')) {
    variant = 'flat_mirror';
  } else if (has(lower, 'concave lens', 'diverging lens')) {
    variant = 'diverging_lens';
  } else if (has(lower, 'optical fibre', 'optical fiber', 'total internal reflection')) {
    variant = 'optical_fibre';
  } else if (has(lower, 'prism', 'dispersion')) {
    variant = 'prism_dispersion';
  } else if (has(lower, 'glass block', 'rectangular block', 'refraction')) {
    variant = 'refraction_block';
  } else if (has(lower, 'long sight', 'longsighted', 'hyperopia', 'hypermetropia')) {
    variant = 'eye_long_sight';
  } else if (has(lower, 'short sight', 'shortsighted', 'myopia')) {
    variant = 'eye_short_sight';
  } else if (has(lower, 'mirror')) {
    variant = 'flat_mirror';
  }

  let objectPosition = 'beyond_2f';

  // First try numeric parsing: object distance vs focal length
  const objectDistMatch = originalText.match(
    /object\s+(?:is\s+)?(?:placed\s+)?(\d+(?:\.\d+)?)\s*(?:cm|mm|m)\b/i
  );
  const focalLengthMatch =
    originalText.match(/focal\s+length\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:cm|mm|m)\b/i) ||
    originalText.match(/\bf\s*=\s*(\d+(?:\.\d+)?)\s*(?:cm|mm|m)\b/i);

  if (objectDistMatch && focalLengthMatch) {
    const u = parseFloat(objectDistMatch[1]);
    const f = parseFloat(focalLengthMatch[1]);
    if (u < f) objectPosition = 'inside_f';
    else if (Math.abs(u - f) < 0.5) objectPosition = 'at_f';
    else if (u < 2 * f) objectPosition = 'between_f_2f';
    else if (Math.abs(u - 2 * f) < 0.5) objectPosition = 'at_2f';
    else objectPosition = 'beyond_2f';
  } else {
    if (has(lower, 'inside f', 'within f', 'between f and lens',
        'closer than f', 'inside the focal')) objectPosition = 'inside_f';
    else if (has(lower, 'at f', 'at the focal', 'at the focus')) objectPosition = 'at_f';
    else if (has(lower, 'between f and 2f', 'between f and c',
        'between focal')) objectPosition = 'between_f_2f';
    else if (has(lower, 'at 2f', 'at c', 'at the centre')) objectPosition = 'at_2f';
  }

  const nMatch = lower.match(/refractive\s+index\s+(?:of\s+)?[\w\s]*?(?:is\s+)?([\d.]+)/);
  const refractiveIndex = nMatch ? parseFloat(nMatch[1]) : undefined;

  let mediumLabel: string | undefined;
  if (has(lower, 'glass')) mediumLabel = 'glass';
  else if (has(lower, 'water')) mediumLabel = 'water';
  else if (has(lower, 'perspex')) mediumLabel = 'perspex';
  else if (has(lower, 'diamond')) mediumLabel = 'diamond';

  return {
    type: 'ray_diagram',
    variant,
    objectPosition,
    showConstruction: true,
    showImage: true,
    showNormals: has(lower, 'normal', 'angle of incidence', 'angle of refraction'),
    showAngles: has(lower, 'angle of incidence', 'angle of refraction',
        'angle of reflection', 'critical angle'),
    refractiveIndex,
    mediumLabel,
    title: variant === 'flat_mirror' ? 'Plane Mirror Ray Diagram'
      : variant === 'refraction_block' ? 'Refraction Through a Glass Block'
      : variant === 'prism_dispersion' ? 'Dispersion Through a Prism'
      : variant === 'optical_fibre' ? 'Total Internal Reflection in an Optical Fibre'
      : variant === 'eye_long_sight' ? 'Correction of Long Sight'
      : variant === 'eye_short_sight' ? 'Correction of Short Sight'
      : variant === 'converging_mirror' ? 'Concave Mirror Ray Diagram'
      : variant === 'diverging_mirror' ? 'Convex Mirror Ray Diagram'
      : variant === 'diverging_lens' ? 'Diverging Lens Ray Diagram'
      : 'Converging Lens Ray Diagram',
  };
};

const buildWaveDiagramConfig = (lower: string): PhysicsDiagramConfig => {
  let variant: WaveDiagramVariant = 'transverse';

  if (has(lower, 'longitudinal', 'compression', 'rarefaction', 'sound wave')) {
    variant = 'longitudinal';
  } else if (has(lower, 'superposition', 'resultant wave', 'combined')) {
    variant = 'superposition';
  } else if (has(lower, 'standing wave', 'stationary wave', 'node', 'antinode')) {
    variant = 'standing_wave';
  } else if (has(lower, 'constructive', 'destructive', 'interference pattern')) {
    variant = 'interference';
  } else if (has(lower, 'doppler')) {
    variant = 'doppler';
  } else if (has(lower, 'diffraction')) {
    variant = 'diffraction';
  }

  let harmonicNumber = 1;
  if (has(lower, 'second harmonic', 'first overtone', '2nd harmonic')) harmonicNumber = 2;
  else if (has(lower, 'third harmonic', 'second overtone', '3rd harmonic')) harmonicNumber = 3;
  else if (has(lower, 'fourth harmonic', '4th harmonic')) harmonicNumber = 4;

  let phaseShift = 0;
  if (has(lower, 'antiphase', 'out of phase', '180', 'π out')) phaseShift = Math.PI;
  else if (has(lower, 'quarter', '90', 'π/2')) phaseShift = Math.PI / 2;

  return {
    type: 'wave_diagram',
    variant,
    amplitude: 1,
    wavelength: 4,
    harmonicNumber,
    phaseShift,
    showAmplitudeLabel: has(lower, 'amplitude', 'label'),
    showWavelengthLabel: has(lower, 'wavelength', 'label'),
    showPeriodLabel: has(lower, 'period', 'label'),
    showNodeLabels: variant === 'standing_wave',
    waveType: has(lower, 'sound') ? 'sound'
      : has(lower, 'light', 'em', 'electromagnetic') ? 'light'
      : has(lower, 'water') ? 'water'
      : has(lower, 'string', 'rope', 'wire') ? 'string'
      : 'water',
    title: variant === 'longitudinal' ? 'Longitudinal Wave'
      : variant === 'standing_wave' ? 'Standing Wave Diagram'
      : variant === 'superposition' ? 'Superposition of Waves'
      : variant === 'interference' ? 'Interference Pattern'
      : variant === 'doppler' ? 'Doppler Effect'
      : variant === 'diffraction' ? 'Diffraction Through a Gap'
      : 'Transverse Wave',
  };
};

const buildMagneticFieldConfig = (lower: string): PhysicsDiagramConfig => {
  let variant: MagneticFieldVariant = 'bar_magnet';

  if ((has(lower, 'two magnet', 'attract', 'repel')) &&
      has(lower, 'magnet', 'north', 'south')) {
    variant = has(lower, 'repel', 'repulsion') ? 'two_bar_magnets_repel' : 'two_bar_magnets_attract';
  } else if (has(lower, 'solenoid', 'coil')) {
    variant = 'current_solenoid';
  } else if (has(lower, 'straight wire', 'long wire', 'current-carrying wire',
      'current carrying wire')) {
    variant = 'current_straight_wire';
  } else if (has(lower, 'circular loop', 'circular coil', 'current loop')) {
    variant = 'current_loop';
  } else if (has(lower, 'motor effect', 'fleming', 'force on a wire',
      'force on the wire')) {
    variant = 'motor_effect';
  } else if (has(lower, 'electromagnet')) {
    variant = 'electromagnet';
  } else if (has(lower, 'earth', 'geographic', 'compass')) {
    variant = 'earth_field';
  }

  let currentDirection: MagneticFieldConfig['currentDirection'];
  if (has(lower, 'into the page', 'into page', 'going into')) currentDirection = 'into_page';
  else if (has(lower, 'out of the page', 'out of page', 'coming out')) currentDirection = 'out_of_page';
  else if (has(lower, 'flows left', 'current left', 'to the left')) currentDirection = 'left';
  else if (has(lower, 'flows right', 'current right', 'to the right')) currentDirection = 'right';
  else if (has(lower, 'flows up', 'upward current')) currentDirection = 'up';
  else if (has(lower, 'flows down', 'downward current')) currentDirection = 'down';

  return {
    type: 'magnetic_field',
    variant,
    currentDirection,
    northOnLeft: !has(lower, 'north on right', 'n on right'),
    showFieldLines: true,
    showArrows: true,
    showCurrentSymbols: variant === 'current_straight_wire' ||
      variant === 'current_solenoid' || variant === 'motor_effect',
    showForceArrow: variant === 'motor_effect',
    labelN: true,
    labelS: true,
    title: variant === 'bar_magnet' ? 'Magnetic Field — Bar Magnet'
      : variant === 'two_bar_magnets_attract' ? 'Magnetic Field — Attracting Magnets'
      : variant === 'two_bar_magnets_repel' ? 'Magnetic Field — Repelling Magnets'
      : variant === 'current_straight_wire' ? 'Magnetic Field Around a Wire'
      : variant === 'current_solenoid' ? 'Magnetic Field of a Solenoid'
      : variant === 'motor_effect' ? 'The Motor Effect'
      : variant === 'electromagnet' ? 'Electromagnet Field'
      : 'Magnetic Field',
  };
};

const buildNuclearDecayConfig = (lower: string): PhysicsDiagramConfig => {
  let variant: NuclearDecayVariant = 'nuclear_equation';

  if (has(lower, 'alpha decay', 'alpha emission', 'emits alpha',
      'emit an alpha')) variant = 'alpha_decay';
  else if (has(lower, 'beta decay', 'beta minus', 'β⁻',
      'beta emission', 'emits beta', 'emit a beta')) variant = 'beta_minus_decay';
  else if (has(lower, 'beta plus', 'β⁺', 'positron')) variant = 'beta_plus_decay';
  else if (has(lower, 'gamma', 'γ') &&
      !has(lower, 'alpha', 'beta')) variant = 'gamma_decay';
  else if (has(lower, 'decay chain', 'decay series', 'series of decay')) variant = 'decay_chain';
  else if (has(lower, 'fission')) variant = 'fission';
  else if (has(lower, 'fusion')) variant = 'fusion';

  const nucleusMatch = lower.match(/(\d+)\s*([a-z]{1,3})\s+(?:nucleus|atom|isotope|nuclide)/i)
    || lower.match(/([a-z]{1,3})-(\d+)/i);

  let parentSymbol: string | undefined;
  let parentMassNumber: number | undefined;
  let parentAtomicNumber: number | undefined;

  if (nucleusMatch) {
    if (/^\d+$/.test(nucleusMatch[1])) {
      parentMassNumber = parseInt(nucleusMatch[1]);
      parentSymbol = nucleusMatch[2].charAt(0).toUpperCase() +
        nucleusMatch[2].slice(1).toLowerCase();
    } else {
      parentSymbol = nucleusMatch[1].charAt(0).toUpperCase() +
        nucleusMatch[1].slice(1).toLowerCase();
      parentMassNumber = parseInt(nucleusMatch[2]);
    }
  }

  const isotopes: Record<string, { symbol: string; mass: number; atomic: number }> = {
    'uranium': { symbol: 'U', mass: 238, atomic: 92 },
    'radium': { symbol: 'Ra', mass: 226, atomic: 88 },
    'radon': { symbol: 'Rn', mass: 222, atomic: 86 },
    'carbon': { symbol: 'C', mass: 14, atomic: 6 },
    'iodine': { symbol: 'I', mass: 131, atomic: 53 },
    'cobalt': { symbol: 'Co', mass: 60, atomic: 27 },
    'americium': { symbol: 'Am', mass: 241, atomic: 95 },
    'polonium': { symbol: 'Po', mass: 210, atomic: 84 },
    'thorium': { symbol: 'Th', mass: 234, atomic: 90 },
    'strontium': { symbol: 'Sr', mass: 90, atomic: 38 },
    'technetium': { symbol: 'Tc', mass: 99, atomic: 43 },
  };

  for (const [name, data] of Object.entries(isotopes)) {
    if (has(lower, name)) {
      parentSymbol = parentSymbol ?? data.symbol;
      parentMassNumber = parentMassNumber ?? data.mass;
      parentAtomicNumber = parentAtomicNumber ?? data.atomic;
      break;
    }
  }

  return {
    type: 'nuclear_decay',
    variant,
    parentSymbol,
    parentMassNumber,
    parentAtomicNumber,
    showPenetration: has(lower, 'penetrat', 'absorb', 'stopped by', 'blocked by'),
    showIonisation: has(lower, 'ionis', 'ioniz'),
    showDeflection: has(lower, 'deflect', 'electric field', 'magnetic field',
        'charged', 'charge'),
    title: variant === 'alpha_decay' ? 'Alpha Decay'
      : variant === 'beta_minus_decay' ? 'Beta Minus Decay'
      : variant === 'beta_plus_decay' ? 'Beta Plus Decay'
      : variant === 'gamma_decay' ? 'Gamma Emission'
      : variant === 'fission' ? 'Nuclear Fission'
      : variant === 'fusion' ? 'Nuclear Fusion'
      : variant === 'decay_chain' ? 'Radioactive Decay Chain'
      : 'Nuclear Decay',
  };
};

// ─── Answer-diagram classifier ──────────────────────────────────────────────
// Returns true if the diagram visualises the ANSWER (must be hidden behind
// the reveal panel) vs being a question aid (always shown alongside the
// question text).
export const isPhysicsAnswerDiagram = (
  questionText: string,
  config: PhysicsDiagramConfig | null,
): boolean => {
  if (!config) return false;
  const lower = (questionText ?? '').toLowerCase();

  // Always answer diagrams — they reveal the solution:
  if (config.type === 'ray_diagram') return true;
  if (config.type === 'wave_diagram') return true;
  if (config.type === 'electromagnetic_spectrum') return true;

  if (config.type === 'nuclear_decay') {
    if ((config as any).showPenetration) return true;
    if (/write\s+(?:the\s+)?(?:nuclear\s+)?equation|show\s+(?:the\s+)?decay|represent\s+(?:the\s+)?decay|compare\s+(?:the\s+)?(?:penetrat|ionisation|ionization|properties)/i.test(lower)) {
      return true;
    }
    return false;
  }

  if (config.type === 'magnetic_field') {
    // Sketch/draw questions — diagram is the answer:
    if (/sketch|draw\s+(?:the\s+)?(?:field|pattern|lines)/i.test(lower)) return true;
    // Calculation questions referencing a field — diagram is a question aid:
    if (/calculate|determine|find\s+(?:the\s+)?force|find\s+(?:the\s+)?(?:direction|magnitude)/i.test(lower)) {
      return false;
    }
    return true;
  }

  return false;
};
