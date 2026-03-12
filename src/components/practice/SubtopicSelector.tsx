/**
 * SubtopicSelector - Subtopic selection with search, custom entry, board detection, and AI topic pruning
 *
 * REGRESSION CHECKLIST (2026-02-19):
 * ✅ Enter key adds custom subtopic (same as clicking "Add X")
 * ✅ Click to add still works
 * ✅ AI interpretation toggle available
 * ✅ Board fingerprint detection badge
 * ✅ Auto-extracted topics from uploaded file (interactive pruning)
 */
import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, X, Sparkles, Scan, Info } from "lucide-react";
import { CopyrightNotice } from "@/components/shared/CopyrightNotice";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Built-in subtopic dictionary (instant client-side fuzzy search) ─────────
const SUBTOPIC_DICTIONARY: Record<string, string[]> = {
  mathematics: [
    "Algebra", "Linear Equations", "Quadratic Equations", "Simultaneous Equations",
    "Inequalities", "Polynomials", "Factorisation", "Expanding Brackets",
    "Surds and Indices", "Logarithms", "Exponential Functions", "Sequences",
    "Arithmetic Sequences", "Geometric Sequences", "Series", "Binomial Theorem",
    "Calculus", "Differentiation", "Integration", "Chain Rule", "Product Rule",
    "Quotient Rule", "Implicit Differentiation", "Parametric Equations",
    "Differential Equations", "Numerical Methods", "Newton-Raphson",
    "Trigonometry", "Trigonometric Functions", "Trigonometric Identities",
    "Sine Rule", "Cosine Rule", "Radians", "Arc Length", "Sector Area",
    "Coordinate Geometry", "Straight Lines", "Circles", "Parabolas",
    "Vectors", "Vector Addition", "Scalar Product", "Cross Product",
    "Matrices", "Matrix Multiplication", "Determinants", "Inverse Matrices",
    "Complex Numbers", "Argand Diagram", "De Moivre's Theorem",
    "Proof", "Mathematical Induction", "Proof by Contradiction",
    "Statistics", "Probability", "Conditional Probability", "Bayes' Theorem",
    "Normal Distribution", "Binomial Distribution", "Poisson Distribution",
    "Hypothesis Testing", "Correlation", "Regression", "Standard Deviation",
    "Mechanics", "Kinematics", "Forces", "Newton's Laws", "Moments",
    "Energy", "Work Done", "Power", "Momentum", "Projectile Motion",
    "Circular Motion", "Simple Harmonic Motion", "Graphs of Functions",
    "Transformations of Graphs", "Modulus Functions", "Partial Fractions",
    "Numerical Integration", "Trapezium Rule", "Logarithmic Differentiation",
    "Maclaurin Series", "Taylor Series", "Polar Coordinates",
  ],
  maths: [], // alias — resolved below
  physics: [
    "Kinematics", "Equations of Motion", "Projectile Motion", "Relative Motion",
    "Forces", "Newton's Laws of Motion", "Friction", "Tension", "Normal Force",
    "Momentum", "Conservation of Momentum", "Impulse", "Collisions",
    "Energy", "Kinetic Energy", "Potential Energy", "Conservation of Energy",
    "Work Done", "Power", "Efficiency", "Circular Motion", "Centripetal Force",
    "Angular Velocity", "Simple Harmonic Motion", "Oscillations", "Resonance",
    "Damping", "Waves", "Transverse Waves", "Longitudinal Waves", "Wave Speed",
    "Superposition", "Interference", "Diffraction", "Refraction", "Optics",
    "Reflection", "Snell's Law", "Total Internal Reflection", "Lenses", "Mirrors",
    "Electricity", "Electric Charge", "Electric Field", "Electric Potential",
    "Current", "Voltage", "Resistance", "Ohm's Law", "Kirchhoff's Laws",
    "Series Circuits", "Parallel Circuits", "Capacitors", "Capacitance",
    "Magnetic Fields", "Electromagnetic Induction", "Faraday's Law",
    "Alternating Current", "Transformers", "Motors and Generators",
    "Thermodynamics", "Temperature", "Heat Transfer", "Conduction", "Convection",
    "Radiation", "Specific Heat Capacity", "Latent Heat", "Ideal Gas Law",
    "Gas Laws", "Kinetic Theory", "Atomic Physics", "Nuclear Physics",
    "Radioactivity", "Alpha Decay", "Beta Decay", "Gamma Radiation", "Half-Life",
    "Nuclear Fission", "Nuclear Fusion", "Quantum Physics", "Photoelectric Effect",
    "Photons", "Wave-Particle Duality", "Special Relativity", "Gravitational Fields",
    "Gravitational Potential", "Orbital Motion", "Satellites", "Dark Matter",
    "Hubble's Law", "Big Bang Theory",
  ],
  chemistry: [
    "Atomic Structure", "Electron Configuration", "Isotopes", "Ions",
    "Periodic Table", "Periodicity", "Group 1 Metals", "Group 7 Halogens",
    "Group 0 Noble Gases", "Transition Metals", "d-Block Elements",
    "Bonding", "Ionic Bonding", "Covalent Bonding", "Metallic Bonding",
    "Dative Bonding", "Hydrogen Bonding", "Van der Waals Forces",
    "Molecular Shapes", "VSEPR Theory", "Polarity",
    "Moles", "Molar Mass", "Avogadro's Number", "Empirical Formula",
    "Molecular Formula", "Percentage Yield", "Atom Economy",
    "Oxidation and Reduction", "Redox Reactions", "Acid-Base Reactions",
    "Neutralisation", "Titration", "Organic Chemistry", "Alkanes", "Alkenes",
    "Alkynes", "Alcohols", "Aldehydes", "Ketones", "Carboxylic Acids", "Esters",
    "Amines", "Amides", "Halogenoalkanes", "Arenes", "Benzene",
    "Reaction Mechanisms", "Electrophilic Addition", "Nucleophilic Substitution",
    "Electrophilic Substitution", "Elimination Reactions", "Free Radical",
    "Isomerism", "Structural Isomers", "Stereoisomers", "Optical Isomers",
    "Equilibrium", "Le Chatelier's Principle", "Kc and Kp", "Kw and pH",
    "Buffers", "Acid Dissociation Constant", "Enthalpy", "Entropy",
    "Gibbs Free Energy", "Hess's Law", "Bond Enthalpies", "Lattice Enthalpy",
    "Reaction Rate", "Rate Law", "Rate Constant", "Activation Energy",
    "Catalysts", "Arrhenius Equation", "Electrolysis", "Electrode Potentials",
    "Fuel Cells", "Galvanic Cells", "Polymers", "Addition Polymers",
    "Condensation Polymers", "Chromatography", "Mass Spectrometry", "NMR Spectroscopy",
    "Inorganic Chemistry", "Complex Ions", "Ligands", "Precipitation Reactions",
  ],
  biology: [
    "Cell Biology", "Cell Structure", "Prokaryotic Cells", "Eukaryotic Cells",
    "Cell Organelles", "Mitochondria", "Chloroplasts", "Ribosomes",
    "Cell Membrane", "Fluid Mosaic Model", "Diffusion", "Osmosis",
    "Active Transport", "Endocytosis", "Exocytosis", "Cell Division",
    "Mitosis", "Meiosis", "Cell Cycle", "Cancer",
    "Genetics", "DNA Structure", "DNA Replication", "Transcription",
    "Translation", "Genetic Code", "Mutations", "Alleles", "Genotype",
    "Phenotype", "Mendel's Laws", "Monohybrid Cross", "Dihybrid Cross",
    "Sex-Linked Inheritance", "Codominance", "Polygenic Inheritance",
    "Evolution", "Natural Selection", "Speciation", "Hardy-Weinberg",
    "Adaptations", "Classification", "Taxonomy",
    "Ecology", "Food Chains", "Food Webs", "Energy Flow", "Trophic Levels",
    "Carbon Cycle", "Nitrogen Cycle", "Water Cycle", "Ecosystems", "Biodiversity",
    "Succession", "Proteins", "Amino Acids", "Enzymes", "Enzyme Kinetics",
    "Carbohydrates", "Lipids", "Nucleic Acids", "ATP",
    "Photosynthesis", "Light-Dependent Reactions", "Calvin Cycle",
    "Aerobic Respiration", "Anaerobic Respiration", "Glycolysis",
    "Krebs Cycle", "Oxidative Phosphorylation", "Nervous System", "Neurons",
    "Action Potentials", "Synapses", "Brain Structure", "Hormones",
    "Endocrine System", "Immune System", "Antibodies", "Antigens", "Vaccines",
    "Phagocytosis", "Circulatory System", "Heart", "Blood Vessels", "Blood Pressure",
    "Respiratory System", "Gas Exchange", "Lungs", "Ventilation",
    "Digestive System", "Enzymes in Digestion", "Absorption", "Liver",
    "Homeostasis", "Thermoregulation", "Osmoregulation", "Blood Glucose",
    "Biotechnology", "PCR", "Gel Electrophoresis", "Cloning", "GMOs",
    "Stem Cells", "Gene Expression", "Epigenetics",
  ],
  economics: [
    "Demand", "Supply", "Price Mechanism", "Market Equilibrium",
    "Price Elasticity of Demand", "Income Elasticity of Demand",
    "Cross Elasticity of Demand", "Price Elasticity of Supply",
    "Consumer Theory", "Utility", "Indifference Curves", "Budget Lines",
    "Consumer Surplus", "Producer Surplus", "Market Structures",
    "Perfect Competition", "Monopoly", "Monopolistic Competition",
    "Oligopoly", "Game Theory", "Nash Equilibrium", "Prisoner's Dilemma",
    "Market Failure", "Externalities", "Public Goods", "Merit Goods",
    "Demerit Goods", "Information Failure", "Asymmetric Information",
    "Government Intervention", "Subsidies", "Taxation", "Price Controls",
    "Regulation", "Competition Policy", "GDP", "Economic Growth",
    "Business Cycle", "Aggregate Demand", "Aggregate Supply", "AD-AS Model",
    "Inflation", "Consumer Price Index", "Deflation", "Stagflation",
    "Phillips Curve", "Unemployment", "Types of Unemployment",
    "Natural Rate of Unemployment", "Fiscal Policy", "Government Spending",
    "Budget Deficit", "National Debt", "Multiplier Effect",
    "Automatic Stabilisers", "Monetary Policy", "Interest Rates",
    "Money Supply", "Quantitative Easing", "Exchange Rates",
    "Purchasing Power Parity", "Currency Depreciation",
    "International Trade", "Comparative Advantage", "Trade Policy",
    "Protectionism", "Tariffs", "Quotas", "Balance of Payments",
    "Current Account", "Capital Account", "Globalisation", "FDI",
    "Development Economics", "Human Development Index", "Aid and Debt",
    "Labour Markets", "Wage Determination", "Monopsony", "Trade Unions",
    "Behavioural Economics", "Nudge Theory", "Bounded Rationality",
  ],
  history: [
    "World War I", "Causes of WWI", "Western Front", "Trench Warfare",
    "Treaty of Versailles", "Paris Peace Conference", "Interwar Period",
    "Great Depression", "Rise of Fascism", "World War II", "Causes of WWII",
    "Holocaust", "Blitzkrieg", "D-Day", "Pacific War", "Atomic Bomb",
    "Cold War", "Iron Curtain", "Korean War", "Cuban Missile Crisis",
    "Vietnam War", "Berlin Wall", "Arms Race", "Space Race", "Détente",
    "Decolonisation", "Independence Movements", "British Empire",
    "Russian Revolution", "Bolsheviks", "Lenin", "Stalin", "Soviet Union",
    "Nazi Germany", "Hitler", "Third Reich", "Propaganda", "Appeasement",
    "Medieval History", "Feudalism", "Magna Carta", "Black Death",
    "Renaissance", "Reformation", "Scientific Revolution", "Enlightenment",
    "French Revolution", "Napoleon", "Industrial Revolution",
    "American Civil War", "Slavery", "Reconstruction", "Civil Rights Movement",
    "Apartheid", "Genocide", "Weimar Republic", "Hyperinflation",
  ],
  english: [
    "Poetry Analysis", "Poetic Devices", "Metaphor", "Simile", "Alliteration",
    "Assonance", "Sibilance", "Enjambment", "Caesura", "Rhyme Scheme",
    "Iambic Pentameter", "Sonnet Form", "Free Verse", "Prose Fiction",
    "Narrative Voice", "First Person Narration", "Third Person Narration",
    "Unreliable Narrator", "Stream of Consciousness", "Characterisation",
    "Dialogue", "Setting", "Atmosphere", "Tone", "Themes", "Motifs",
    "Symbolism", "Imagery", "Foreshadowing", "Dramatic Irony",
    "Structural Devices", "Flashback", "In Medias Res", "Non-Fiction Writing",
    "Rhetoric", "Persuasive Techniques", "Ethos", "Pathos", "Logos",
    "Rule of Three", "Anaphora", "Language Analysis", "Connotation",
    "Denotation", "Register", "Audience and Purpose", "Genre Conventions",
    "Comparative Analysis", "Context", "Historical Context", "Social Context",
    "Biographical Context", "Shakespeare", "Tragedy", "Comedy", "Histories",
    "Soliloquy", "Gothic Literature", "Gothic Conventions", "Victorian Literature",
    "Dystopian Fiction", "Post-Colonial Literature", "War Poetry",
    "Romantic Poetry", "Modern Poetry",
  ],
  geography: [
    "Plate Tectonics", "Volcanoes", "Earthquakes", "Tsunamis", "Fold Mountains",
    "Rift Valleys", "Rivers", "River Processes", "Erosion", "Deposition",
    "Transportation", "Floodplains", "Meanders", "Deltas", "Waterfalls",
    "Flood Management", "Coasts", "Coastal Erosion", "Coastal Deposition",
    "Longshore Drift", "Beaches", "Cliffs", "Sea Stacks", "Coastal Management",
    "Weather and Climate", "Atmospheric Circulation", "Precipitation",
    "Tropical Storms", "Hurricanes", "Climate Zones", "Climate Change",
    "Global Warming", "Carbon Emissions", "Mitigation", "Adaptation",
    "Glaciation", "Ice Ages", "Glacial Erosion", "Moraines",
    "Population", "Population Growth", "Demographic Transition",
    "Migration", "Urbanisation", "Rural-Urban Migration", "Urban Issues",
    "Housing", "Inequality", "Regeneration", "Development", "HDI",
    "Economic Development", "Aid", "Globalisation", "Trade", "TNCs",
    "Resource Management", "Water Security", "Food Security", "Energy Security",
    "Tropical Rainforests", "Deserts", "Tundra", "Ecosystems", "Biodiversity",
  ],
  science: [], // alias — merged below
};

// Resolve aliases
SUBTOPIC_DICTIONARY.maths = SUBTOPIC_DICTIONARY.mathematics;
SUBTOPIC_DICTIONARY.science = [
  ...SUBTOPIC_DICTIONARY.physics,
  ...SUBTOPIC_DICTIONARY.chemistry,
  ...SUBTOPIC_DICTIONARY.biology,
];

/**
 * Fuzzy-filter: returns items from the dictionary whose lowercase form contains
 * all characters of the query in order (simple subsequence match = fast fuzzy).
 */
function fuzzyMatch(query: string, candidate: string): boolean {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  // Simple substring match first (covers most cases)
  if (c.includes(q)) return true;
  // Subsequence match for typo tolerance
  let qi = 0;
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) qi++;
  }
  return qi === q.length;
}

function getLocalSubtopics(subject: string): string[] {
  const key = subject.toLowerCase().replace(/[^a-z]/g, '');
  if (SUBTOPIC_DICTIONARY[key]) return SUBTOPIC_DICTIONARY[key];
  const partialKey = Object.keys(SUBTOPIC_DICTIONARY).find(
    k => k.includes(key) || key.includes(k)
  );
  return partialKey ? SUBTOPIC_DICTIONARY[partialKey] : [];
}

// Board fingerprint detection — runs purely on extracted text, no external call
type DetectedBoard = 'aqa' | 'edexcel' | 'ocr' | 'wjec' | null;

interface BoardDetectionResult {
  board: DetectedBoard;
  label: string;
  confidence: 'high' | 'medium' | null;
}

function detectBoardFingerprint(text: string): BoardDetectionResult {
  if (!text) return { board: null, label: 'Standard Academic Style', confidence: null };

  const lower = text.toLowerCase();

  // Score each board based on fingerprint patterns
  const scores: Record<string, number> = { aqa: 0, edexcel: 0, ocr: 0, wjec: 0 };

  // AQA: heavy "Evaluate", "Give", "Give one reason", specific header styles
  const aqaEval = (lower.match(/\bevaluate\b/g) || []).length;
  const aqaGive = (lower.match(/\bgive\b/g) || []).length;
  scores.aqa += aqaEval * 3 + aqaGive * 2;
  if (lower.includes('aqa') || lower.includes('assessment and qualifications')) scores.aqa += 20;

  // Edexcel: "Explain", "Analyse", data-heavy setups, Pearson references
  const edexcelExplain = (lower.match(/\bexplain\b/g) || []).length;
  const edexcelAnalyse = (lower.match(/\banalyse\b/g) || []).length;
  scores.edexcel += edexcelExplain * 2 + edexcelAnalyse * 3;
  if (lower.includes('edexcel') || lower.includes('pearson') || lower.includes('btec')) scores.edexcel += 20;

  // OCR: "Show that", "Determine", structured parts
  const ocrShow = (lower.match(/\bshow that\b/g) || []).length;
  const ocrDetermine = (lower.match(/\bdetermine\b/g) || []).length;
  scores.ocr += ocrShow * 3 + ocrDetermine * 2;
  if (lower.includes('ocr') || lower.includes('oxford cambridge')) scores.ocr += 20;

  // WJEC: Welsh references
  if (lower.includes('wjec') || lower.includes('cbac') || lower.includes('welsh')) scores.wjec += 25;

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore < 3) return { board: null, label: 'Standard Academic Style', confidence: null };

  const topBoard = (Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0]) as DetectedBoard;
  const boardLabels: Record<string, string> = {
    aqa: 'UK Board A Style',
    edexcel: 'UK Board B Style',
    ocr: 'UK Board C Style',
    wjec: 'Welsh Board Style',
  };

  return {
    board: topBoard,
    label: boardLabels[topBoard!] || 'Standard Academic Style',
    confidence: maxScore >= 10 ? 'high' : 'medium',
  };
}

interface SubtopicSelectorProps {
  subject: string;
  selectedSubtopics: string[];
  onSubtopicsChange: (subtopics: string[]) => void;
  educationalTier?: string;
  examBoard?: string;
  useAIInterpretation: boolean;
  onAIInterpretationChange: (value: boolean) => void;
  /** Topics extracted from uploaded document via Deep Topic Scan */
  autoExtractedTopics?: string[];
  /** Detected board from uploaded document text */
  detectedBoard?: BoardDetectionResult | null;
  /** True while scanning the uploaded file */
  isScanning?: boolean;
  onExamBoardDetected?: (board: DetectedBoard) => void;
}

export function SubtopicSelector({
  subject,
  selectedSubtopics,
  onSubtopicsChange,
  educationalTier,
  examBoard,
  useAIInterpretation,
  onAIInterpretationChange,
  autoExtractedTopics,
  detectedBoard,
  isScanning = false,
  onExamBoardDetected,
}: SubtopicSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [availableSubtopics, setAvailableSubtopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Track which auto-extracted topics the user has kept (all selected by default)
  const [keptAutoTopics, setKeptAutoTopics] = useState<Set<string>>(new Set());

  // When auto-extracted topics arrive, add them to selection and to "kept" set
  useEffect(() => {
    if (!autoExtractedTopics?.length) return;
    const newTopics = autoExtractedTopics.filter(t => !selectedSubtopics.includes(t));
    if (newTopics.length > 0) {
      onSubtopicsChange([...selectedSubtopics, ...newTopics]);
    }
    setKeptAutoTopics(new Set(autoExtractedTopics));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExtractedTopics]);

  useEffect(() => {
    if (subject) {
      loadSubtopics();
    }
  }, [subject, educationalTier, examBoard]);

  const loadSubtopics = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("subject_subtopics")
        .select("subtopic")
        .eq("subject", subject);

      if (educationalTier) {
        query = query.or(`educational_tier.eq.${educationalTier},educational_tier.is.null`);
      }
      if (examBoard) {
        query = query.or(`exam_board.eq.${examBoard},exam_board.is.null`);
      }

      // Fetch both subject_subtopics and user's master topics in parallel
      const { data: { user } } = await supabase.auth.getUser();
      const [subtopicsRes, masterTopicsRes] = await Promise.all([
        query,
        user
          ? supabase
              .from("subject_master_topics")
              .select("topic")
              .eq("user_id", user.id)
              .ilike("subject_name", subject)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (subtopicsRes.error) throw subtopicsRes.error;

      const dbSubtopics = subtopicsRes.data?.map((item: any) => item.subtopic) || [];
      const userMasterTopics = (masterTopicsRes as any).data?.map((item: any) => item.topic) || [];
      // Merge DB results, user master topics, and local dictionary — deduplicated
      // User master topics come first for priority
      const localSubtopics = getLocalSubtopics(subject);
      const merged = [...new Set([...userMasterTopics, ...dbSubtopics, ...localSubtopics])];
      setAvailableSubtopics(merged);
    } catch (error) {
      console.error("Error loading subtopics:", error);
      // Fall back to local dictionary on DB error
      setAvailableSubtopics(getLocalSubtopics(subject));
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (subtopic: string) => {
    if (selectedSubtopics.includes(subtopic)) {
      onSubtopicsChange(selectedSubtopics.filter((s) => s !== subtopic));
    } else {
      onSubtopicsChange([...selectedSubtopics, subtopic]);
    }
  };

  const handleRemove = (subtopic: string) => {
    onSubtopicsChange(selectedSubtopics.filter((s) => s !== subtopic));
    // Also remove from keptAutoTopics so it doesn't get re-added
    setKeptAutoTopics(prev => { const n = new Set(prev); n.delete(subtopic); return n; });
  };

  const handleAddCustom = () => {
    if (searchValue.trim() && !selectedSubtopics.includes(searchValue.trim())) {
      onSubtopicsChange([...selectedSubtopics, searchValue.trim()]);
      setSearchValue("");
      setOpen(false);
    }
  };

  const filteredSubtopics = searchValue.trim()
    ? availableSubtopics.filter((subtopic) => fuzzyMatch(searchValue, subtopic))
    : availableSubtopics;

  const isCustomSubtopic = (subtopic: string) =>
    !availableSubtopics.includes(subtopic) && !keptAutoTopics.has(subtopic);

  const isAutoTopic = (subtopic: string) => keptAutoTopics.has(subtopic);

  // Detected board badge colour mapping
  const boardBadgeClass = detectedBoard?.board
    ? 'bg-primary/10 text-primary border-primary/30'
    : 'bg-muted text-muted-foreground border-border';

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label htmlFor="subtopic-selector">Select Subtopics</Label>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Detected board badge */}
          {(detectedBoard || isScanning) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border font-medium",
                    boardBadgeClass
                  )}>
                    {isScanning ? (
                      <>
                        <Scan className="h-3 w-3 animate-pulse" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Scan className="h-3 w-3" />
                        Detected Style: {detectedBoard!.label}
                        {detectedBoard?.confidence && (
                          <span className="opacity-60">({detectedBoard.confidence})</span>
                        )}
                      </>
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-48">
                    {isScanning
                      ? 'Scanning your document for board style fingerprints...'
                      : detectedBoard?.board
                        ? 'Board style inferred from command verbs and question structure in your uploaded document. You can override in Advanced Options.'
                        : 'No specific board fingerprint detected. Using standard academic style.'
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* AI interpretation toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="ai-interpretation"
              checked={useAIInterpretation}
              onCheckedChange={onAIInterpretationChange}
            />
            <Label htmlFor="ai-interpretation" className="text-sm text-muted-foreground">
              AI interpretation
            </Label>
          </div>
        </div>
      </div>

      {/* Auto-extracted topics section */}
      {autoExtractedTopics && autoExtractedTopics.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Topics found in your document</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-52">Tap any topic to remove it from your practice set before generating.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {autoExtractedTopics.map(topic => {
              const isKept = selectedSubtopics.includes(topic);
              return (
                <button
                  key={topic}
                  onClick={() => isKept ? handleRemove(topic) : onSubtopicsChange([...selectedSubtopics, topic])}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all",
                    isKept
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border line-through opacity-60"
                  )}
                >
                  {isKept ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                  {topic}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedSubtopics.filter(s => autoExtractedTopics.includes(s)).length} of {autoExtractedTopics.length} topics selected
          </p>
        </div>
      )}

      {/* Manual selection combobox */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={!subject}
          >
            {selectedSubtopics.length > 0
              ? `${selectedSubtopics.length} subtopic${selectedSubtopics.length > 1 ? "s" : ""} selected`
              : "Select subtopics..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput
              placeholder="Search or type new subtopic..."
              value={searchValue}
              onValueChange={setSearchValue}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchValue.trim() && !selectedSubtopics.includes(searchValue.trim())) {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
            />
            <CommandEmpty>
              <div className="p-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No subtopic found</p>
                {searchValue && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddCustom}
                    className="w-full"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Add "{searchValue}" (AI will interpret)
                  </Button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {filteredSubtopics.map((subtopic) => (
                <CommandItem
                  key={subtopic}
                  onSelect={() => handleSelect(subtopic)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedSubtopics.includes(subtopic) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {subtopic}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Subtopics Chips */}
      {selectedSubtopics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSubtopics.map((subtopic) => (
            <Badge
              key={subtopic}
              variant={isAutoTopic(subtopic) ? "default" : isCustomSubtopic(subtopic) ? "secondary" : "outline"}
              className="gap-1"
            >
              {isCustomSubtopic(subtopic) && !isAutoTopic(subtopic) && (
                <Sparkles className="h-3 w-3" />
              )}
              {isAutoTopic(subtopic) && (
                <Scan className="h-3 w-3" />
              )}
              {subtopic}
              <button
                onClick={() => handleRemove(subtopic)}
                className="ml-1 rounded-full hover:bg-background/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Copyright notice for literary texts */}
      <CopyrightNotice subjectName={subject} topics={selectedSubtopics} />
    </div>
  );
}

// Re-export the type so callers can use it
export type { BoardDetectionResult, DetectedBoard };
export { detectBoardFingerprint };
