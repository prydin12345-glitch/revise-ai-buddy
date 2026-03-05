

# Global Curriculum Logic: Full Region × Subject Archetype Matrix

## Overview

Expand the Stealth Archetype system from its current state (12 regions for Maths only, plus 3 UK-specific subjects) to a **complete matrix** covering all 12 regions × 7 subject families. This also adds a "Dynamic Regional Persona" layer that applies universal regional rules (terminology, units, spelling) before subject-specific logic.

## Current State

- `resolveStealthArchetype()` in `extract-exam-questions/index.ts` handles:
  - 12 regions for **Maths only** (US, AU, IN, SG, HK, IE, NZ, ZA, IB, UAE/CA, UK L1, UK L2)
  - UK-only for Physics, Economics, English (3 archetypes)
  - Generic fallback for everything else
- `getSubjectSpecificInstructions()` in `_shared/exam-extraction-prompts.ts` has basic subject templates but no regional awareness

## Plan

### 1. Add Regional Persona Layer (new function in `_shared/exam-extraction-prompts.ts`)

Create `getRegionalPersona(region: string)` that returns universal regional rules injected into **every** prompt regardless of subject:

**United Kingdom (GB)**
- Terminology: "Maths", "colour", "analyse", "Football", "Sweets", "behaviour"
- Units: Metric (cm, kg, °C). Use "probability" never "likelihood"
- Command style: "Describe and explain", "Evaluate", "Show that"
- Prohibited: Americanisms ("Soccer", "Candy", "Math", "color")

**United States (US)**
- Terminology: "Math", "color", "analyze", "Soccer", "Candy"
- Units: Imperial where culturally appropriate (inches, feet, °F for everyday; SI for science)
- Command style: "Justify your answer", "Interpret in context", "Is there sufficient evidence"
- Use "standardized score" not "standard score"

**Australia (AU)**
- Terminology: British spelling ("analyse", "colour") with local context
- Units: Metric. Use "kilometres", "litres"
- Command style: "Show that", "Hence find", "Explain why"
- Contexts: Australian geography, flora/fauna, local industry

**Canada (CA)**
- Terminology: British spelling with North American contexts
- Units: Metric (official), but reference imperial in everyday contexts
- Command style: Blend of UK/US styles

**UAE (AE)**
- Terminology: British English (UK curriculum influence)
- Units: Metric. Include local contexts (oil, construction, tourism)
- Command style: Formal UK-aligned

**India (IN)**
- Terminology: British English ("Maths", "colour")
- Units: SI strictly. Include CBSE "prove that" emphasis
- Command style: "Prove that", "Find the value of", "Show that"

**Singapore (SG)**
- Terminology: British English
- Units: SI. High mathematical complexity
- Command style: "Hence or otherwise", "Deduce", "State"

**Hong Kong (HK)**
- Terminology: British English
- Units: SI. Contexts blend local and international
- Command style: "Find", "Show that", "Explain"

**Ireland (IE)**
- Terminology: British English with Irish educational terms
- Units: Metric
- Command style: "Investigate", "Verify", "Justify"

**New Zealand (NZ)**
- Terminology: British spelling
- Units: Metric. NCEA Achievement/Merit/Excellence tiering
- Command style: "Demonstrate understanding", "Analyse", "Evaluate"

**South Africa (ZA)**
- Terminology: British English
- Units: SI. South African contexts (mining, agriculture, demographics)
- Command style: "Determine", "Prove", "Calculate"

**Global/IB (IB)**
- Terminology: International English (accept both UK/US spellings)
- Units: SI exclusively
- Command style: IB Command Terms ("outline", "discuss", "evaluate", "to what extent")
- Must reference IB rubric criteria (Criterion A-D where applicable)

### 2. Expand `resolveStealthArchetype()` — Region × Subject Matrix

Add archetypes for each non-Maths subject across all regions. The function will be restructured as:

```text
Region detection → Subject detection → Return specific archetype
                                     ↓ (no match)
                                     → Fall through to UK defaults
                                     → Fall through to generic
```

**Subject archetypes to add per region** (showing key differentiators only):

#### Biology
| Region | Key Differences |
|--------|----------------|
| GB | AQA/OCR style: "Describe and explain", practical-based Qs, 6-mark extended response |
| US | AP Bio: free-response, "design an experiment", data analysis from tables |
| AU | ATAR: "Analyse experimental data", multi-step practical scenarios |
| IN | CBSE: "Draw and label", "Differentiate between", diagram-heavy |
| SG | Cambridge: "Suggest an explanation", high-complexity application |
| IB | IB Bio: data-based questions, "Outline", "Evaluate", syllabus command terms |
| Others | Inherit closest regional parent style |

#### Chemistry
| Region | Key Differences |
|--------|----------------|
| GB | AQA/OCR: calculation-heavy, balanced equations, "Give the IUPAC name" |
| US | AP Chem: free-response, "Design a procedure", equilibrium & thermodynamics emphasis |
| IN | CBSE: "Write the balanced equation", "Name the product", derivation-based |
| SG | Cambridge: multi-step calculations, organic chemistry synthesis |
| IB | IB Chem: data analysis, "Deduce the structure", command term adherence |

#### Physics
| Region | Key Differences |
|--------|----------------|
| GB | (Already exists) — extend to Level 1 (GCSE Physics) |
| US | AP Physics: "Derive an expression", "Justify with physics principles", FRQ format |
| AU | ATAR: real-world scenario-based, "Analyse the motion", graph interpretation |
| IN | CBSE: "Derive", numerical problems with step-by-step, ray diagrams |
| SG | Cambridge: "Calculate the magnitude", multi-part with "hence" chains |
| IB | IB Physics: "Outline", paper 2/3 format, data-based questions |

#### Economics
| Region | Key Differences |
|--------|----------------|
| GB | (Already exists) — add GCSE level |
| US | AP Econ: "Using a correctly labeled graph, show...", FRQ with graph requirements |
| IB | IB Econ: "Using real-world examples, evaluate...", paper 1 essay vs paper 2 data |

#### English Language/Literature
| Region | Key Differences |
|--------|----------------|
| GB | (Already exists for AQA English) — generalise to Edexcel/OCR variants |
| US | AP Lang: rhetorical analysis, argument essay, synthesis essay |
| AU | ATAR English: text analysis, comparative essay |
| IB | IB English: Paper 1 guided literary analysis, Paper 2 comparative essay |

#### History / Geography / Other Humanities
- Generic archetype per region using command-verb patterns specific to that board

### 3. Update `getSubjectSpecificInstructions()` in `_shared/exam-extraction-prompts.ts`

Make this function region-aware by accepting `curriculumRegion` as a parameter. Each subject block will branch by region to produce the correct terminology and format.

### 4. Wire Regional Persona into Prompt Pipeline

In `buildPrompt()`, inject the regional persona block **before** the archetype block so every generated question inherits the correct dialect, units, and terminology regardless of subject.

### 5. Update `generate-practice-questions/index.ts`

Apply the same regional persona and expanded archetype logic to the practice question generation pipeline, ensuring consistency between exams and quizzes.

## Files to Modify

1. **`supabase/functions/_shared/exam-extraction-prompts.ts`** — Add `getRegionalPersona()` function, make `getSubjectSpecificInstructions()` region-aware
2. **`supabase/functions/extract-exam-questions/index.ts`** — Expand `resolveStealthArchetype()` with ~40 new region×subject archetypes, inject regional persona into `buildPrompt()`
3. **`supabase/functions/generate-practice-questions/index.ts`** — Mirror the regional persona injection and archetype expansion

## Scope

This is a prompt-engineering change only — no database migrations, no UI changes, no new edge functions. The existing `curriculum_region` preference already feeds into the pipeline correctly.

