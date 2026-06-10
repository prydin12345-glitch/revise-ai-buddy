// FILE: supabase/functions/_shared/subject-detection.ts
// =============================================================================
// CANONICAL SUBJECT DETECTION — single source of truth
// =============================================================================
// Before this module, subject detection was scattered across the codebase as
// inline regexes that diverged over time:
//   - /physics|science/i matched "Computer Science" and "Health Science",
//     giving those students physics difficulty rules
//   - the biology-exclusion regex existed in 4 places with 2 variants
//   - circuit/diagram gates each re-derived the subject independently
//
// Every subject decision now flows through detectSubject(). Flags are
// PURPOSE-NAMED to match the gate they drive, so behaviour is auditable.
//
// To change which subjects trigger a behaviour, edit ONE pattern here.
// =============================================================================

// ── Canonical patterns ───────────────────────────────────────────────────────

/** Biology family. The most battle-tested pattern in the codebase (was
 *  duplicated in 4 places). Used to exclude circuits/physics content. */
export const BIOLOGY_PATTERN =
  /biology|life.?science|human.?biology|biolog|anatomy|physiology|biomedical|health.?science|environmental.?science|marine.?biology|ecology|genetics|microbiology/i;

/** Computer science / computing family — must NEVER receive physics rules. */
export const COMPUTER_SCIENCE_PATTERN =
  /computer\s*science|computing|software|programming|data\s*science/i;

/** Subjects that get physics diagram instructions (ray, wave, magnetic
 *  field, nuclear decay). Verbatim from the engine's diagram gate. */
export const PHYSICS_DIAGRAMS_PATTERN =
  /physics|physical\s*science|natural\s*science|combined\s*science|gcse\s*science|a[\s-]level\s*science|triple\s*science|optics|electronics|engineering|igcse\s*physics|ib\s*physics|ap\s*physics/i;

/** Maths notation/diagram family (probability trees, Venn, two-way tables).
 *  Includes CS/computing/data science by design — they share notation. */
export const MATHS_NOTATION_PATTERN =
  /mathematics|maths|math\b|statistics|stat\b|probability|further\s*maths|data\s*science|computer\s*science|computing/i;

/** Electrical engineering detection. Verbatim from the engine. */
export const ELECTRICAL_ENGINEERING_PATTERN =
  /electric|circuit|power system|analog|digital electronics/i;

/** Subjects with first-class support (cache variation, standard prompts). */
export const KNOWN_ACADEMIC_SUBJECTS = [
  'mathematics', 'biology', 'chemistry', 'physics', 'english', 'history',
  'geography', 'computer science', 'economics', 'psychology', 'business',
  'sociology',
];

/** Unambiguous electrical terms for the circuit-instructions gate.
 *  Deliberately excludes ambiguous words (resistance, parallel, series)
 *  that also appear in biology. Verbatim from the engine. */
export const CIRCUIT_KEYWORDS = [
  'circuit', 'resistor', 'emf', 'internal resistance',
  'potential divider', 'thermistor', 'voltmeter', 'ammeter',
  'kirchhoff', 'ohm', 'capacitor', 'inductor', 'diode',
  'rectifier', 'transformer', 'alternating current', 'direct current',
  'electronics', 'electrical circuit', 'electric circuit',
];

// ── Profile ──────────────────────────────────────────────────────────────────

export interface SubjectProfile {
  /** The raw subject string this profile was built from. */
  raw: string;

  // Family flags
  isBiology: boolean;
  isComputerScience: boolean;
  isElectricalEngineering: boolean;

  /** Subject is on the first-class supported list. */
  isKnownAcademic: boolean;

  // Purpose-named gate flags (each maps to one behaviour in the engine)

  /** Gets the HARD_PHYSICS difficulty supplement.
   *  FIX vs old /physics|science/i: computer science and biology-family
   *  "...science" subjects no longer qualify. */
  hasPhysicsStyleDifficulty: boolean;

  /** Gets the HARD_MATHS difficulty supplement (was /math|statistic/i). */
  hasMathsStyleDifficulty: boolean;

  /** Gets physics diagram instructions (ray/wave/field/decay). */
  usePhysicsDiagramInstructions: boolean;

  /** Gets maths diagram instructions (trees/Venn/tables). */
  useMathsNotation: boolean;

  /** Core maths subject (graphing defaults; was includes('math')). */
  isMathsCore: boolean;
}

/** Decide whether circuit-consistency instructions apply, given the
 *  subject profile and the set's subtopics. Biology always wins. */
export function needsCircuitRules(profile: SubjectProfile, subtopics: string[] = []): boolean {
  if (profile.isBiology) return false;
  const haystack = `${profile.raw} ${subtopics.join(' ')}`.toLowerCase();
  return CIRCUIT_KEYWORDS.some((kw) => haystack.includes(kw));
}

/** Canonical subject detection. Call once per generation run and pass the
 *  profile around — never re-derive the subject with inline regexes. */
export function detectSubject(subjectName: string | null | undefined): SubjectProfile {
  const raw = subjectName ?? '';
  const lower = raw.toLowerCase();

  const isBiology = BIOLOGY_PATTERN.test(lower);
  const isComputerScience = COMPUTER_SCIENCE_PATTERN.test(lower);
  const isElectricalEngineering = ELECTRICAL_ENGINEERING_PATTERN.test(lower);
  const isKnownAcademic = KNOWN_ACADEMIC_SUBJECTS.some((s) => lower.includes(s));

  return {
    raw,
    isBiology,
    isComputerScience,
    isElectricalEngineering,
    isKnownAcademic,

    // Old behaviour: /physics|science/i — matched CS, health science, etc.
    // New behaviour: generic "science" still qualifies (Combined Science is
    // a real physics-content subject) but biology-family and CS do not.
    hasPhysicsStyleDifficulty:
      !isBiology && !isComputerScience && /physics|science/i.test(lower),

    hasMathsStyleDifficulty: /math|statistic/i.test(lower),

    usePhysicsDiagramInstructions:
      !isBiology && PHYSICS_DIAGRAMS_PATTERN.test(lower),

    useMathsNotation: MATHS_NOTATION_PATTERN.test(lower),

    isMathsCore: lower.includes('math'),
  };
}
