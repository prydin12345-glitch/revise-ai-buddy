const BROKEN_DIAGRAM_PHRASES = [
  /in the circuit (shown |illustrated |displayed |given )?(below|above|here|opposite)/gi,
  /consider the circuit (shown |illustrated |)?(below|above|opposite)/gi,
  /refer(?:ring)? to the (circuit|network|diagram) (below|above|shown)/gi,
  /from the (circuit|network|diagram) (below|shown|above|given)/gi,
  /as shown in (the )?(circuit|figure|diagram)/gi,
  /using the (circuit|network) (shown|below|above|given|opposite)/gi,
  /the (circuit|network) below (shows|illustrates|has|contains)/gi,
  /shown in figure \d+/gi,
  /figure \d+ (shows|illustrates|below)/gi,
];

const testPattern = (pattern: RegExp, value: string): boolean => {
  const isolatedPattern = new RegExp(pattern.source, pattern.flags);
  return isolatedPattern.test(value);
};

export const hasBrokenDiagramReference = (
  questionText: string,
  diagramConfig: unknown,
): boolean => {
  if (diagramConfig !== null && diagramConfig !== undefined) {
    return false;
  }

  return BROKEN_DIAGRAM_PHRASES.some(pattern => testPattern(pattern, questionText || ''));
};

export const scrubBrokenDiagramReferences = (questionText: string): string => {
  const cleaned = (questionText || '')
    .replace(/in the circuit (shown |illustrated |displayed |given )?(below|above|here|opposite)/gi, 'in the described circuit')
    .replace(/consider the circuit (shown |illustrated |)?(below|above|opposite)\.?/gi, '')
    .replace(/refer(?:ring)? to the (circuit|network|diagram) (below|above|shown)\.?/gi, '')
    .replace(/from the (circuit|network|diagram) (below|shown|above|given)/gi, 'from the described circuit')
    .replace(/as shown in (the )?(circuit|figure|diagram)/gi, 'as described')
    .replace(/using the (circuit|network) (shown|below|above|given|opposite)/gi, 'using the described circuit')
    .replace(/the (circuit|network) below (shows|illustrates|has|contains)/gi, 'the described $1 $2')
    .replace(/shown in figure \d+/gi, 'as described')
    .replace(/figure \d+ (shows|illustrates|below)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
};