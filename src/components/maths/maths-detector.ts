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
    return buildTwoWayTableConfig(lower, text);
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

  // Heuristic extractor: find total, n(A), n(B), and "both"/intersection
  const findNum = (re: RegExp): number | undefined => {
    const m = lower.match(re);
    return m ? parseInt(m[1]) : undefined;
  };

  const total =
    findNum(/(\d+)\s+(?:students?|people|children|pupils|members|participants?|adults?|respondents?)/i) ??
    findNum(/total\s+of\s+(\d+)/i) ??
    findNum(/there\s+are\s+(\d+)/i);

  const both =
    findNum(/(\d+)\s+(?:students?|people|pupils|children)?\s*(?:study|studied|like|liked|chose|choose|play|played|do|did|take|took)\s+both/i) ??
    findNum(/(\d+)\s+(?:do|did|study|studied|like|liked|chose|play|played|take|took)?\s*both/i) ??
    findNum(/both\s+(?:subjects?|sets?|activities|sports?)\s*[:=]?\s*(\d+)/i) ??
    findNum(/n\s*\(\s*a\s*∩\s*b\s*\)\s*=\s*(\d+)/i) ??
    findNum(/intersection\s*[:=]?\s*(\d+)/i);

  const labelANum = (label: string): number | undefined => {
    const l = label.toLowerCase();
    return (
      findNum(new RegExp(`(\\d+)\\s+(?:students?|people|pupils|children)?\\s*(?:study|studied|like|liked|chose|play|played|take|took|do|did|prefer|preferred)\\s+${l}`, 'i')) ??
      findNum(new RegExp(`(\\d+)\\s+${l}\\b`, 'i')) ??
      findNum(new RegExp(`n\\s*\\(\\s*${l[0]}\\s*\\)\\s*=\\s*(\\d+)`, 'i'))
    );
  };

  if (threeSet) {
    // Keep simple ordering for 3-set (rare in this fix scope)
    const numbers = [...lower.matchAll(/\b(\d+)\b/g)]
      .map(m => parseInt(m[1]))
      .filter(n => n > 0 && n < 200);
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

  const nA = labelANum(setLabels[0] ?? 'A');
  const nB = labelANum(setLabels[1] ?? 'B');

  // Compute derived region values from raw inputs
  let derivedBoth = both;
  let derivedOnlyA: number | undefined;
  let derivedOnlyB: number | undefined;
  let derivedNeither: number | undefined;

  if (nA !== undefined && nB !== undefined && derivedBoth !== undefined) {
    derivedOnlyA = nA - derivedBoth;
    derivedOnlyB = nB - derivedBoth;
    if (total !== undefined) {
      derivedNeither = total - nA - nB + derivedBoth;
    }
  } else {
    // Fallback: use raw numbers in document order if we couldn't classify
    const numbers = [...lower.matchAll(/\b(\d+)\b/g)]
      .map(m => parseInt(m[1]))
      .filter(n => n > 0 && n < 1000);
    derivedBoth = derivedBoth ?? numbers[0];
    derivedOnlyA = numbers[1];
    derivedOnlyB = numbers[2];
    derivedNeither = numbers[3];
  }

  return {
    type: 'venn_two',
    setA: setLabels[0] ?? 'A',
    setB: setLabels[1] ?? 'B',
    both: derivedBoth,
    onlyA: derivedOnlyA,
    onlyB: derivedOnlyB,
    neither: derivedNeither,
    total,
    universalSetLabel: 'ξ',
    showSetNotation: false,
    highlightRegion,
  };
};

const buildTwoWayTableConfig = (lower: string, originalText: string): MathsDiagramConfig => {
  const hasGender = has(lower, 'male', 'female', 'boy', 'girl', 'men', 'women');
  const hasCatDog = has(lower, 'cat', 'dog');
  const hasPetChoice = has(lower, 'cat', 'dog', 'fish', 'rabbit', 'hamster');

  let rowVariable = 'Category';
  let rowLabels = ['Group 1', 'Group 2'];
  let colVariable = 'Preference';
  let colLabels = ['Option 1', 'Option 2'];

  if (hasGender) {
    rowVariable = 'Gender';
    rowLabels = has(lower, 'boy', 'girl') ? ['Boy', 'Girl'] : ['Male', 'Female'];
  }
  if (hasCatDog) {
    colVariable = 'Preference';
    colLabels = ['Cats', 'Dogs'];
  } else if (hasPetChoice) {
    const pets = ['Cat', 'Dog', 'Fish', 'Rabbit'].filter(p => lower.includes(p.toLowerCase()));
    if (pets.length >= 2) { colVariable = 'Preference'; colLabels = pets; }
  }

  const subjectMatch = originalText.match(
    /\b(maths|english|science|french|history|geography|art|music)\b/gi,
  );
  if (subjectMatch && subjectMatch.length >= 2) {
    colVariable = 'Subject';
    colLabels = [...new Set(subjectMatch.slice(0, 3).map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()))];
  }

  const rows = rowLabels.length;
  const cols = colLabels.length;

  const totalMatch = originalText.match(
    /(\d+)\s+(?:students?|people|children|pupils|participants?|respondents?)/i,
  );
  const grandTotal: number | null = totalMatch ? parseInt(totalMatch[1]) : null;

  const data: (number | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  const rowTotals: (number | null)[] = Array(rows).fill(null);
  const colTotals: (number | null)[] = Array(cols).fill(null);
  // Snapshot taken AFTER text-extraction but BEFORE solver — represents what is "given"
  // vs. what the student must derive. Captured below after extraction.

  rowLabels.forEach((rowLabel, ri) => {
    const rowLower = rowLabel.toLowerCase();
    const rowTotalMatch =
      originalText.match(new RegExp(`(\\d+)\\s+(?:of\\s+the\\s+)?${rowLower}s?\\b(?![^.]*(?:preferred|chose|liked|selected))`, 'i')) ||
      originalText.match(new RegExp(`${rowLower}s?\\b[^.]*?\\b(\\d+)\\b[^.]*?(?:total|altogether|in total)`, 'i'));
    if (rowTotalMatch) rowTotals[ri] = parseInt(rowTotalMatch[1]);

    colLabels.forEach((colLabel, ci) => {
      const colLower = colLabel.toLowerCase();
      const colSingular = colLower.replace(/s$/, '');
      const cellPatterns = [
        new RegExp(`(\\d+)\\s+${rowLower}s?\\s+preferred\\s+${colSingular}s?`, 'i'),
        new RegExp(`(\\d+)\\s+${rowLower}s?\\s+chose\\s+${colSingular}s?`, 'i'),
        new RegExp(`(\\d+)\\s+${rowLower}s?\\s+liked\\s+${colSingular}s?`, 'i'),
        new RegExp(`(\\d+)\\s+${rowLower}s?\\s+selected\\s+${colSingular}s?`, 'i'),
      ];
      for (const pattern of cellPatterns) {
        const m = originalText.match(pattern);
        if (m) { data[ri][ci] = parseInt(m[1]); break; }
      }
    });
  });

  colLabels.forEach((colLabel, ci) => {
    const colLower = colLabel.toLowerCase().replace(/s$/, '');
    const colTotalMatch = originalText.match(
      new RegExp(`(\\d+)\\s+(?:students?|people|children)?\\s*preferred\\s+${colLower}s?`, 'i'),
    );
    if (colTotalMatch) colTotals[ci] = parseInt(colTotalMatch[1]);
  });

  // Constraint solver
  let changed = true;
  let iter = 0;
  while (changed && iter < 20) {
    changed = false; iter++;
    for (let ri = 0; ri < rows; ri++) {
      const known = data[ri].filter(v => v !== null) as number[];
      if (known.length === cols - 1 && rowTotals[ri] !== null) {
        const missing = data[ri].findIndex(v => v === null);
        data[ri][missing] = rowTotals[ri]! - known.reduce((a, b) => a + b, 0);
        changed = true;
      }
      if (rowTotals[ri] === null && data[ri].every(v => v !== null)) {
        rowTotals[ri] = (data[ri] as number[]).reduce((a, b) => a + b, 0);
        changed = true;
      }
    }
    for (let ci = 0; ci < cols; ci++) {
      const colVals = data.map(r => r[ci]);
      const known = colVals.filter(v => v !== null) as number[];
      if (known.length === rows - 1 && colTotals[ci] !== null) {
        const missing = colVals.findIndex(v => v === null);
        data[missing][ci] = colTotals[ci]! - known.reduce((a, b) => a + b, 0);
        changed = true;
      }
      if (colTotals[ci] === null && colVals.every(v => v !== null)) {
        colTotals[ci] = (colVals as number[]).reduce((a, b) => a + b, 0);
        changed = true;
      }
    }
    if (grandTotal !== null) {
      const knownRT = rowTotals.filter(v => v !== null) as number[];
      if (knownRT.length === rows - 1) {
        const missing = rowTotals.findIndex(v => v === null);
        rowTotals[missing] = grandTotal - knownRT.reduce((a, b) => a + b, 0);
        changed = true;
      }
      const knownCT = colTotals.filter(v => v !== null) as number[];
      if (knownCT.length === cols - 1) {
        const missing = colTotals.findIndex(v => v === null);
        colTotals[missing] = grandTotal - knownCT.reduce((a, b) => a + b, 0);
        changed = true;
      }
    }
  }

  return {
    type: 'two_way_table',
    rowVariable,
    colVariable,
    rowLabels,
    colLabels,
    data,
    rowTotals,
    colTotals,
    grandTotal,
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
