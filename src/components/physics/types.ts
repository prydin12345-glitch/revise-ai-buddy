// Physics diagram system — shared types

export type PhysicsDiagramType =
  | 'ray_diagram'
  | 'wave_diagram'
  | 'magnetic_field'
  | 'nuclear_decay'
  | 'electromagnetic_spectrum';

// ── Ray Diagram ───────────────────────────────────────────────────────────────

export type RayDiagramVariant =
  | 'converging_lens'
  | 'diverging_lens'
  | 'converging_mirror'
  | 'diverging_mirror'
  | 'flat_mirror'
  | 'refraction_block'
  | 'prism_dispersion'
  | 'optical_fibre'
  | 'eye_long_sight'
  | 'eye_short_sight';

export interface RayDiagramConfig {
  type: 'ray_diagram';
  variant: RayDiagramVariant;
  objectPosition?: string;
  focalLength?: number;
  objectHeight?: number;
  showConstruction?: boolean;
  showImage?: boolean;
  showNormals?: boolean;
  showAngles?: boolean;
  mediumLabel?: string;
  refractiveIndex?: number;
  title?: string;
  labels?: {
    principal?: string;
    focalPoint?: string;
    centre?: string;
  };
}

// ── Wave Diagram ──────────────────────────────────────────────────────────────

export type WaveDiagramVariant =
  | 'transverse'
  | 'longitudinal'
  | 'superposition'
  | 'standing_wave'
  | 'interference'
  | 'doppler'
  | 'diffraction';

export interface WaveDiagramConfig {
  type: 'wave_diagram';
  variant: WaveDiagramVariant;
  amplitude?: number;
  wavelength?: number;
  frequency?: number;
  period?: number;
  amplitude2?: number;
  wavelength2?: number;
  phaseShift?: number;
  harmonicNumber?: number;
  gapWidth?: number;
  showAmplitudeLabel?: boolean;
  showWavelengthLabel?: boolean;
  showPeriodLabel?: boolean;
  showNodeLabels?: boolean;
  title?: string;
  waveType?: 'water' | 'sound' | 'light' | 'em' | 'string';
}

// ── Magnetic Field ────────────────────────────────────────────────────────────

export type MagneticFieldVariant =
  | 'bar_magnet'
  | 'two_bar_magnets_attract'
  | 'two_bar_magnets_repel'
  | 'current_straight_wire'
  | 'current_solenoid'
  | 'current_loop'
  | 'motor_effect'
  | 'electromagnet'
  | 'earth_field';

export interface MagneticFieldConfig {
  type: 'magnetic_field';
  variant: MagneticFieldVariant;
  northOnLeft?: boolean;
  currentDirection?: 'into_page' | 'out_of_page' | 'left' | 'right' | 'up' | 'down';
  forceDirection?: 'up' | 'down' | 'left' | 'right' | 'into_page' | 'out_of_page';
  numberOfCoils?: number;
  fieldDirection?: 'left_to_right' | 'right_to_left' | 'top_to_bottom' | 'bottom_to_top';
  showFieldLines?: boolean;
  showArrows?: boolean;
  showCurrentSymbols?: boolean;
  showForceArrow?: boolean;
  labelN?: boolean;
  labelS?: boolean;
  title?: string;
}

// ── Nuclear Decay ─────────────────────────────────────────────────────────────

export type NuclearDecayVariant =
  | 'alpha_decay'
  | 'beta_minus_decay'
  | 'beta_plus_decay'
  | 'gamma_decay'
  | 'decay_chain'
  | 'half_life_graph'
  | 'nuclear_equation'
  | 'fission'
  | 'fusion';

export interface NuclearDecayConfig {
  type: 'nuclear_decay';
  variant: NuclearDecayVariant;
  parentSymbol?: string;
  parentMassNumber?: number;
  parentAtomicNumber?: number;
  daughterSymbol?: string;
  daughterMassNumber?: number;
  daughterAtomicNumber?: number;
  decayParticle?: 'alpha' | 'beta_minus' | 'beta_plus' | 'gamma' | 'neutron';
  chain?: Array<{
    symbol: string;
    massNumber: number;
    atomicNumber: number;
    decayType: 'alpha' | 'beta_minus' | 'beta_plus' | 'gamma';
  }>;
  showPenetration?: boolean;
  showIonisation?: boolean;
  showDeflection?: boolean;
  title?: string;
}

// ── Electromagnetic Spectrum ──────────────────────────────────────────────────

export interface EMSpectrumConfig {
  type: 'electromagnetic_spectrum';
  highlightRegion?: 'radio' | 'microwave' | 'infrared' | 'visible' |
    'ultraviolet' | 'xray' | 'gamma';
  showWavelength?: boolean;
  showFrequency?: boolean;
  showUses?: boolean;
  showProperties?: boolean;
  title?: string;
}

export type PhysicsDiagramConfig =
  | RayDiagramConfig
  | WaveDiagramConfig
  | MagneticFieldConfig
  | NuclearDecayConfig
  | EMSpectrumConfig;
