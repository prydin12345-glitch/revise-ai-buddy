/** Protect existing math and typeset scientific notation as one expression. */
export function normalizeMathText(text: string): string {
  const delimited = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, body) => '$' + body + '$').replace(/\\\[([\s\S]*?)\\\]/g, (_m, body) => '$$' + body + '$$');
  return delimited.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g).map(segment => {
    if (segment.startsWith('$')) return segment;
    return segment.replace(/\b(\d+(?:\.\d+)?)\s*(?:\\times|×)\s*10\s*\^\s*(?:\{([+-]?\d+)\}|([+-]?\d+))/g, (_m, coefficient, braced, bare) => '$' + coefficient + ' \\times 10^{' + (braced ?? bare) + '}$');
  }).join('');
}
