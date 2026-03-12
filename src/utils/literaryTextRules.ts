import {
  PUBLIC_DOMAIN_WORKS,
  COPYRIGHTED_WORKS,
  getWorkCopyrightStatus,
  getMaxExcerptWords,
} from '@/data/publicDomainWorks';

export const buildLiteraryTextInstructions = (
  textTitle: string,
  _userRegion = 'uk'
): string => {
  const { status, work } = getWorkCopyrightStatus(textTitle);
  const maxWords = getMaxExcerptWords(textTitle);

  if (status === 'public_domain') {
    return `
LITERARY TEXT: "${textTitle}" — PUBLIC DOMAIN
This work is in the public domain. You may:
- Quote passages of any length
- Reproduce entire scenes or chapters if needed for the question
- Use the text freely without restriction

IMPORTANT: Use clean unmodified text only. Do not use text from
modern annotated student editions (e.g. Oxford School Shakespeare,
York Notes) as these editions contain copyrighted editorial content.
Use text equivalent to Project Gutenberg versions.

When providing a passage for analysis, include:
- Act/Chapter and scene/section reference
- Line numbers if poetry or drama
- The passage itself in full where needed for the question
`;
  }

  if (status === 'copyrighted') {
    const notes = (work as any)?.notes || 'This work is under copyright.';
    return `
LITERARY TEXT: "${textTitle}" — UNDER COPYRIGHT
${notes}

You may:
- Generate questions ABOUT this text freely (ideas cannot be copyrighted)
- Include SHORT stimulus passages of maximum ${maxWords} words
- Reference characters, themes, plot points, and quotes by name
- Ask students to recall and analyse the text from memory

You must NOT:
- Reproduce passages longer than ${maxWords} words
- Reproduce entire scenes or acts
- Provide the text as a substitute for owning the book

When a passage is needed for a question:
- Keep it under ${maxWords} words
- Include only the specific lines needed for that question
- Add: "[Extract from ${textTitle} — for educational analysis only]"
- If the question requires a longer passage, instruct the student
  to refer to their copy: "Re-read [Chapter X / Act Y Scene Z]
  in your copy of the text, then answer..."
`;
  }

  return `
LITERARY TEXT: "${textTitle}" — COPYRIGHT STATUS UNKNOWN
Treat this as potentially under copyright.
- Maximum excerpt: ${maxWords} words
- Generate questions about the text freely
- For longer passages, instruct students to refer to their own copy
- Add educational use disclaimer to any excerpts included
`;
};

export const detectLiteraryText = (
  subjectName: string,
  topics: string[]
): string | null => {
  const allText = [subjectName, ...topics].join(' ').toLowerCase();

  const allWorks = [
    ...PUBLIC_DOMAIN_WORKS.map(w => ({ title: w.title, author: w.author })),
    ...COPYRIGHTED_WORKS.map(w => ({ title: w.title, author: w.author })),
  ];

  for (const work of allWorks) {
    if (
      allText.includes(work.title.toLowerCase()) ||
      allText.includes(work.author.toLowerCase().split(' ').pop()!)
    ) {
      return work.title;
    }
  }

  const literaryKeywords = [
    'novel', 'play', 'poem', 'poetry', 'prose',
    'chapter', 'act', 'scene', 'author', 'extract', 'passage',
  ];
  if (literaryKeywords.some(k => allText.includes(k))) {
    return 'unknown_literary_work';
  }

  return null;
};

export const buildExtractSafetyInstruction = (
  sourceType: string,
  subjectName: string
): string => `
CONTENT ORIGINALITY REQUIREMENT:
All generated text, passages, case studies, and source material must be
ENTIRELY ORIGINAL — created by you for this practice session.

You must NOT:
- Reproduce text from real published books, articles, or papers
- Copy passages from real exam papers or past papers
- Use text from real news articles verbatim
- Reproduce content from academic journals or textbooks

You MUST:
- Write original prose in the style of ${sourceType}
- Invent fictional names, companies, places, and scenarios
- Create realistic but entirely made-up data, statistics, and case studies
- For science subjects: invent fictional experiment results and data
- For history: use real historical events but write original analytical commentary

The generated content must read as authentic ${sourceType} material
while being 100% original to this session.
This protects Examly and its users from copyright infringement.
`;

export { getWorkCopyrightStatus, getMaxExcerptWords };
