import type { MathsDiagramConfig, TreeBranch, VennTwoConfig } from './types';

const has = (text: string, ...terms: string[]) =>
  terms.some(t => text.toLowerCase().includes(t.toLowerCase()));

const hasAll = (text: string, ...terms: string[]) =>
  terms.every(t => text.toLowerCase().includes(t.toLowerCase()));

export const detectMathsDiagram = (
  questionText: string,
  subject?: string,
): MathsDiagramConfig | null => {
  const text = questionText ?? '';
  const lower = text.toLowerCase();
  const subj = (subject ?? '').toLowerCase();

  // Subject gate — Maths/Statistics and related quantitative subjects:
  const isMathsSubject =
    /mathematics|maths|math\b|statistics|stat\b|probability|data\s*science|computer\s*science|computing|logic|philosophy|psychology|sociology|biology|economics|business/i.test(
      subj,
    ) || subj === '';

  if (!isMathsSubject) return null;

  // ── SUPPRESSION — no diagram for purely descriptive questions ────────────
  const isDescriptiveOnly =
    /^(explain|describe|define|state\s+what|what\s+is\s+meant|why\s+is|how\s+does|write\s+down\s+the\s+formula|state\s+the\s+rule)/i.test(
      lower.trim(),
    ) &&
    !/\b(draw|sketch|complete|construct|the\s+diagram|the\s+tree|the\s+venn|the\s+table|fill\s+in|copy\s+and\s+complete)\b/i.test(
      lower,
    );

  if (isDescriptiveOnly) return null;

  // ── 1. Probability Tree ───────────────────────────────────────────────────
  if (
    has(lower, 'probability tree', 'tree diagram') ||
    (has(lower, 'tree') && has(lower, 'probability', 'p(', 'chance', 'likelihood')) ||
    (has(lower, 'complete') && has(lower, 'tree')) ||
    (has(lower, 'draw') && has(lower, 'tree') && has(lower, 'probability', 'outcome', 'event')) ||
    has(lower, 'probability diagram', 'chances diagram') ||
    (hasAll(lower, 'independent events') && has(lower, 'diagram', 'tree', 'draw')) ||
    (hasAll(lower, 'successive trials') && has(lower, 'diagram', 'tree'))
  ) {
    return buildProbabilityTreeConfig(lower);
  }

  // ── 2. Venn Diagram ───────────────────────────────────────────────────────
  if (
    has(lower, 'venn diagram', 'venn-diagram') ||
    (has(lower, 'venn') && has(lower, 'draw', 'complete', 'shade', 'show')) ||
    (has(lower, 'sets') &&
      has(lower, 'intersection', 'union', 'complement') &&
      has(lower, 'diagram', 'draw', 'shade', 'show')) ||
    (has(lower, 'three sets', 'three circles') && has(lower, 'venn', 'diagram')) ||
    (has(lower, 'shade') &&
      (has(lower, 'a ∩ b', 'a ∪ b', "a'", 'complement') ||
        has(lower, 'intersection', 'union', 'complement'))) ||
    has(lower, 'euler diagram') ||
    (has(lower, 'sets') &&
      has(lower, 'diagram') &&
      has(lower, 'n(a)', 'n(b)', 'n(a∩b)', 'n(a∪b)'))
  ) {
    return buildVennConfig(lower);
  }

  // ── 3. Two-Way Table ──────────────────────────────────────────────────────
  if (
    has(lower, 'two-way table', 'two way table', 'contingency table', 'frequency table', 'sample space table') ||
    (has(lower, 'table') &&
      has(lower, 'complete', 'fill in', 'copy and complete') &&
      has(lower, 'probability', 'frequency', 'total')) ||
    has(lower, 'relative frequency table') ||
    has(lower, 'joint frequency', 'marginal frequency') ||
    (has(lower, 'frequency distribution table') && has(lower, 'two', 'row', 'column'))
  ) {
    return buildTwoWayTableConfig(lower);
  }

  // ── 4. Sample Space Diagram ───────────────────────────────────────────────
  if (
    has(lower, 'sample space', 'sample space diagram') ||
    (has(lower, 'possibility space') && has(lower, 'draw', 'complete', 'diagram')) ||
    (has(lower, 'two dice', 'two fair dice', 'two coins') &&
      has(lower, 'diagram', 'table', 'list all')) ||
    has(lower, 'lattice diagram')
  ) {
    return buildSampleSpaceConfig(lower);
  }

  // ── 5. Punnett in Maths context ───────────────────────────────────────────
  if (
    (has(lower, 'punnett', 'genetic', 'allele', 'dominant', 'recessive') &&
      has(lower, 'probability', 'fraction', 'chance', 'likelihood', 'calculate', 'find the probability')) ||
    (has(lower, 'genetic cross') && has(lower, 'maths', 'statistics', 'probability'))
  ) {
    return {
      type: 'punnett_maths',
      parent1: 'Aa',
      parent2: 'Aa',
      showAsFractions: true,
    };
  }

  return null;
};

// ─── Config builders ──────────────────────────────────────────────────────────

const buildProbabilityTreeConfig = (lower: string): MathsDiagramConfig => {
  const threeStage = has(
    lower,
    'three times',
    'three trials',
    'three bags',
    'third',
    'three coins',
    'three events',
  );
  const stages = threeStage ? 3 : 2;

  const isCoin = has(lower, 'coin', 'head', 'tail', 'fair coin');
  const isColour = has(
    lower,
    'red',
    'blue',
    'green',
    'white',
    'black',
    'ball',
    'counter',
    'bead',
    'marble',
    'bag',
  );
  const isPassFail = has(lower, 'pass', 'fail', 'test', 'exam', 'grade');
  const isWinLose = has(lower, 'win', 'lose', 'draw', 'match', 'game');

  const probMatches = [...lower.matchAll(/(\d+)\s*\/\s*(\d+)|0\.\d+|\d+\s*%/g)].map(m => m[0]);

  let rootBranches: TreeBranch[];

  if (isCoin) {
    rootBranches = [
      { label: 'H', probability: probMatches[0] ?? '1/2' },
      { label: 'T', probability: probMatches[1] ?? '1/2' },
    ];
  } else if (isColour) {
    const colors: string[] = [];
    if (has(lower, 'red')) colors.push('Red');
    if (has(lower, 'blue')) colors.push('Blue');
    if (has(lower, 'green')) colors.push('Green');
    if (has(lower, 'white')) colors.push('White');
    if (colors.length === 0) colors.push('Red', 'Blue');
    rootBranches = colors.map((c, i) => ({
      label: c,
      probability: probMatches[i] ?? `1/${colors.length}`,
    }));
  } else if (isPassFail) {
    rootBranches = [
      { label: 'Pass', probability: probMatches[0] ?? '2/3' },
      { label: 'Fail', probability: probMatches[1] ?? '1/3' },
    ];
  } else if (isWinLose) {
    rootBranches = [
      { label: 'Win', probability: probMatches[0] ?? '1/2' },
      { label: 'Lose', probability: probMatches[1] ?? '1/2' },
    ];
  } else {
    rootBranches = [
      { label: 'A', probability: probMatches[0] ?? '1/2' },
      { label: 'B', probability: probMatches[1] ?? '1/2' },
    ];
  }

  if (stages >= 2) {
    rootBranches = rootBranches.map(branch => ({
      ...branch,
      children: rootBranches.map(child => ({
        label: child.label,
        probability: child.probability,
        children:
          stages === 3
            ? rootBranches.map(grandchild => ({
                label: grandchild.label,
                probability: grandchild.probability,
              }))
            : undefined,
      })),
    }));
  }

  return {
    type: 'probability_tree',
    stages,
    branches: rootBranches,
    showOutcomes: true,
    showFinalProbabilities: true,
    title: isCoin
      ? 'Probability Tree — Coin'
      : isColour
      ? 'Probability Tree — Coloured Objects'
      : 'Probability Tree',
  };
};

const buildVennConfig = (lower: string): MathsDiagramConfig => {
  const threeSet = has(
    lower,
    'three sets',
    'three circles',
    'three groups',
    'three events',
    'a, b and c',
    'a, b, and c',
  );

  const subjectMatch = lower.match(
    /\b(football|tennis|swimming|cricket|rugby|basketball|maths|english|science|french|history|geography|art|music|cats|dogs|fish|pets|tea|coffee|juice|water)\b/gi,
  );

  const setLabels = subjectMatch
    ? [...new Set(subjectMatch.slice(0, threeSet ? 3 : 2).map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()))]
    : threeSet
    ? ['A', 'B', 'C']
    : ['A', 'B'];

  const numbers = [...lower.matchAll(/\b(\d+)\b/g)]
    .map(m => parseInt(m[1]))
    .filter(n => n > 0 && n < 200);

  if (threeSet) {
    return {
      type: 'venn_three',
      setA: setLabels[0] ?? 'A',
      setB: setLabels[1] ?? 'B',
      setC: setLabels[2] ?? 'C',
      all_three: numbers[0],
      AB_only: numbers[1],
      AC_only: numbers[2],
      BC_only: numbers[3],
      onlyA: numbers[4],
      onlyB: numbers[5],
      onlyC: numbers[6],
      neither: numbers[7],
      universalSetLabel: 'ξ',
    };
  }

  let highlightRegion: VennTwoConfig['highlightRegion'];
  if (has(lower, 'a only', 'only a', 'a but not b')) highlightRegion = 'A_only';
  else if (has(lower, 'b only', 'only b', 'b but not a')) highlightRegion = 'B_only';
  else if (has(lower, 'intersection', 'a ∩ b', 'a and b')) highlightRegion = 'intersection';
  else if (has(lower, 'union', 'a ∪ b', 'a or b')) highlightRegion = 'union';
  else if (has(lower, "a'", 'not a', 'complement of a')) highlightRegion = 'complement_A';
  else if (has(lower, "b'", 'not b', 'complement of b')) highlightRegion = 'complement_B';
  else if (has(lower, 'neither')) highlightRegion = 'neither';

  return {
    type: 'venn_two',
    setA: setLabels[0] ?? 'A',
    setB: setLabels[1] ?? 'B',
    both: numbers[0],
    onlyA: numbers[1],
    onlyB: numbers[2],
    neither: numbers[3],
    total: numbers.find(n => n > (numbers[0] ?? 0) + (numbers[1] ?? 0) + (numbers[2] ?? 0)),
    universalSetLabel: 'ξ',
    showSetNotation: true,
    highlightRegion,
  };
};

const buildTwoWayTableConfig = (lower: string): MathsDiagramConfig => {
  const genderMatch = has(lower, 'male', 'female', 'boy', 'girl', 'men', 'women');
  const subjectMatch = lower.match(/\b(maths|english|science|french|history|art|music)\b/gi);
  const sportMatch = lower.match(/\b(football|tennis|swimming|rugby|cricket|basketball)\b/gi);

  let rowVariable = 'Category A';
  let rowLabels = ['Group 1', 'Group 2'];
  let colVariable = 'Category B';
  let colLabels = ['Option 1', 'Option 2'];

  if (genderMatch) {
    rowVariable = 'Gender';
    rowLabels = has(lower, 'boy', 'girl') ? ['Boy', 'Girl'] : ['Male', 'Female'];
  }
  if (subjectMatch && subjectMatch.length >= 2) {
    colVariable = 'Subject';
    colLabels = [...new Set(subjectMatch.slice(0, 3).map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()))];
  } else if (sportMatch && sportMatch.length >= 2) {
    colVariable = 'Sport';
    colLabels = [...new Set(sportMatch.slice(0, 3).map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()))];
  }

  const rows = rowLabels.length;
  const cols = colLabels.length;
  const data: (number | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  const rowTotals: (number | null)[] = Array(rows).fill(null);
  const colTotals: (number | null)[] = Array(cols).fill(null);

  const numbers = [...lower.matchAll(/\b(\d+)\b/g)]
    .map(m => parseInt(m[1]))
    .filter(n => n > 0 && n < 1000);

  return {
    type: 'two_way_table',
    rowVariable,
    colVariable,
    rowLabels,
    colLabels,
    data,
    rowTotals,
    colTotals,
    grandTotal: numbers.find(n => n > 20) ?? null,
    title: 'Two-Way Frequency Table',
  };
};

const buildSampleSpaceConfig = (lower: string): MathsDiagramConfig => {
  const isDice = has(lower, 'dice', 'die', 'six-sided');
  const isCoin = has(lower, 'coin', 'head', 'tail');

  const event1Values = isDice
    ? ['1', '2', '3', '4', '5', '6']
    : isCoin
    ? ['H', 'T']
    : ['1', '2', '3', '4'];

  const event2Values = isDice
    ? ['1', '2', '3', '4', '5', '6']
    : isCoin
    ? ['H', 'T']
    : ['1', '2', '3', '4'];

  let highlightCondition: string | undefined;
  if (has(lower, 'sum greater than', 'sum more than', 'total greater than')) {
    const match = lower.match(/(?:sum|total)\s+(?:greater|more)\s+than\s+(\d+)/i);
    if (match) highlightCondition = `sum > ${match[1]}`;
  } else if (has(lower, 'sum equals', 'sum of', 'total of')) {
    const match = lower.match(/(?:sum|total)\s+(?:equals?|of)\s+(\d+)/i);
    if (match) highlightCondition = `sum === ${match[1]}`;
  } else if (has(lower, 'both the same', 'double', 'same number')) {
    highlightCondition = 'equal';
  }

  return {
    type: 'sample_space',
    event1Label: isDice ? 'Die 1' : isCoin ? 'Coin 1' : 'Event 1',
    event2Label: isDice ? 'Die 2' : isCoin ? 'Coin 2' : 'Event 2',
    event1Values,
    event2Values,
    highlightCondition,
    title: isDice ? 'Sample Space — Two Dice' : 'Sample Space Diagram',
  };
};
