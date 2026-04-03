// ── Mechanics Diagram JSON Schemas ──

export interface SlopeConfig {
  type: 'slope';
  angle: number;
  mass: string | number;
  surface: 'rough' | 'smooth';
  showNormal: boolean;
  showWeight: boolean;
  showFriction: boolean;
  showComponents: boolean;
  showLabels: boolean;
}

export interface FreeBodyConfig {
  type: 'free_body';
  angle: number;
  mass: string | number;
  appliedForce?: string | number;
  appliedForceDir?: 'horizontal' | 'up-slope';
  surface: 'rough' | 'smooth';
  unknowns: string[];
  showLabels: boolean;
}

export interface ConicalPendulumConfig {
  type: 'conical_pendulum';
  stringLength: number;
  angle: number;
  mass: string | number;
  omega: string | number;
  showTension: boolean;
  showWeight: boolean;
  showRadius: boolean;
  unknowns: string[];
  showLabels: boolean;
}

export interface VerticalMotionConfig {
  type: 'vertical_motion';
  initialSpeed: number;
  direction: 'up' | 'down';
  mass: string | number;
  unknowns: string[];
  showLabels: boolean;
}

export interface PulleyConfig {
  type: 'pulley';
  surface: 'smooth' | 'rough';
  angle: number;
  masses: { hanging: number; onSurface: number };
  showLabels: boolean;
  showForces: boolean;
  friction: boolean;
}

export interface BeamLoad {
  position: number;
  magnitude: number;
  label: string;
}

export interface BeamReaction {
  position: number;
  label: string;
  isUnknown?: boolean;
}

export interface BeamPointLabel {
  position: number;
  label: string;
}

export interface BeamConfig {
  type: 'beam';
  length: number;
  pivot: { type: 'support' | 'wall' | 'hinge'; position: number };
  loads: BeamLoad[];
  reactions: BeamReaction[];
  showLabels: boolean;
  endLabels?: { left?: string; right?: string };
  pointLabels?: BeamPointLabel[];
  distributedMass?: { position: number; label: string };
}

export interface ProjectileConfig {
  type: 'projectile';
  speed: string | number;
  angle: string | number;
  launchHeight: number;
  targetX: number;
  targetY: number;
  showComponents: boolean;
  showLabels: boolean;
  landingX?: number | string;
  timeToMax?: number | string;
  unknowns?: string[];
  speedLabel?: string;
  angleLabel?: string;
}

export interface RodConfig {
  type: 'rod';
  angle: number;
  mass: string | number;
  length: string | number;
  wallType: 'smooth' | 'rough';
  floorType: 'smooth' | 'rough';
  showForces: boolean;
  showLabels: boolean;
}

export interface VerticalLiftConfig {
  type: 'vertical_lift';
  mass: string | number;
  height: number | string;
  time?: number | string;
  unknowns?: string[];
}

export interface PhasorDiagramConfig {
  type: 'phasor_diagram';
  title?: string;
  phasors: Array<{
    magnitude: number;
    angleDeg: number;
    label: string;
    colour?: string;
  }>;
}

export interface DeltaWyeComparisonConfig {
  type: 'delta_wye_comparison';
}

export interface DualConfig {
  type: 'dual';
  left: any; // CircuitConfig — imported at component level to avoid circular deps
  right: VerticalLiftConfig;
}

export type MechanicsConfig =
  | SlopeConfig
  | PulleyConfig
  | BeamConfig
  | ProjectileConfig
  | RodConfig
  | FreeBodyConfig
  | ConicalPendulumConfig
  | VerticalMotionConfig
  | VerticalLiftConfig
  | PhasorDiagramConfig
  | DeltaWyeComparisonConfig
  | DualConfig;

// ── Shared Styling Constants ──

export const COLORS = {
  structural: '#000000',
  weight: '#cc0000',
  normal: '#0055cc',
  tension: '#000000',
  friction: '#cc6600',
  velocity: '#007700',
  angle: '#888888',
  background: '#ffffff',
  label: '#000000',
} as const;

export const MARKER_IDS = {
  black: 'arrow-black',
  red: 'arrow-red',
  blue: 'arrow-blue',
  orange: 'arrow-orange',
  green: 'arrow-green',
} as const;

export const FONT = {
  family: 'serif',
  style: 'italic' as const,
  size: 14,
} as const;

// ── Helper Generators ──

export function generateSlopeConfig(
  angle: number,
  mass: string | number,
  surface: 'rough' | 'smooth'
): SlopeConfig {
  return {
    type: 'slope',
    angle,
    mass,
    surface,
    showNormal: true,
    showWeight: true,
    showFriction: surface === 'rough',
    showComponents: false,
    showLabels: true,
  };
}

export function generatePulleyConfig(
  hanging: number,
  onSurface: number,
  surface: 'smooth' | 'rough' = 'smooth'
): PulleyConfig {
  return {
    type: 'pulley',
    surface,
    angle: 0,
    masses: { hanging, onSurface },
    showLabels: true,
    showForces: true,
    friction: surface === 'rough',
  };
}

export function generateBeamConfig(
  length: number,
  pivotPos: number,
  loads: BeamLoad[],
  pivotType: 'support' | 'wall' | 'hinge' = 'support'
): BeamConfig {
  return {
    type: 'beam',
    length,
    pivot: { type: pivotType, position: pivotPos },
    loads,
    reactions: [{ position: pivotPos, label: 'R' }],
    showLabels: true,
  };
}

export function generateProjectileConfig(
  speed: number | string,
  angle: number | string,
  launchHeight = 0
): ProjectileConfig {
  return {
    type: 'projectile',
    speed,
    angle,
    launchHeight,
    targetX: 40,
    targetY: 20,
    showComponents: false,
    showLabels: true,
  };
}

export function generateRodConfig(
  angle: number,
  mass: string | number,
  length: string | number,
  wallType: 'smooth' | 'rough' = 'smooth',
  floorType: 'smooth' | 'rough' = 'rough'
): RodConfig {
  return {
    type: 'rod',
    angle,
    mass,
    length,
    wallType,
    floorType,
    showForces: true,
    showLabels: true,
  };
}
