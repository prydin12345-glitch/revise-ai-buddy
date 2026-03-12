// Literary copyright rules for edge functions
// Mirrors src/data/publicDomainWorks.ts and src/utils/literaryTextRules.ts

interface WorkEntry { title: string; author: string; }

const PUBLIC_DOMAIN_TITLES = [
  'macbeth', 'romeo and juliet', 'hamlet', "a midsummer night's dream",
  'the merchant of venice', 'othello', 'king lear', 'the tempest',
  'great expectations', 'a christmas carol', 'oliver twist', 'a tale of two cities', 'bleak house',
  'pride and prejudice', 'emma', 'sense and sensibility',
  "tess of the d'urbervilles", 'far from the madding crowd', 'the mayor of casterbridge',
  'animal farm', 'nineteen eighty-four',
  'jane eyre', 'wuthering heights',
  'frankenstein', 'dracula', 'the strange case of dr jekyll and mr hyde',
];

const PUBLIC_DOMAIN_AUTHORS = [
  'shakespeare', 'dickens', 'austen', 'hardy', 'orwell',
  'brontë', 'bronte', 'shelley', 'stoker', 'stevenson',
];

const COPYRIGHTED_WORKS: WorkEntry[] = [
  { title: 'an inspector calls', author: 'priestley' },
  { title: 'never let me go', author: 'ishiguro' },
  { title: 'the curious incident of the dog in the night-time', author: 'haddon' },
  { title: 'of mice and men', author: 'steinbeck' },
  { title: 'the great gatsby', author: 'fitzgerald' },
  { title: 'a streetcar named desire', author: 'williams' },
  { title: 'blood brothers', author: 'russell' },
  { title: 'the history boys', author: 'bennett' },
  { title: 'lord of the flies', author: 'golding' },
];

export function detectLiteraryText(subjectName: string, topics: string[]): string | null {
  const allText = [subjectName, ...topics].join(' ').toLowerCase();

  for (const title of PUBLIC_DOMAIN_TITLES) {
    if (allText.includes(title)) return title;
  }

  for (const work of COPYRIGHTED_WORKS) {
    if (allText.includes(work.title) || allText.includes(work.author)) {
      return work.title;
    }
  }

  for (const author of PUBLIC_DOMAIN_AUTHORS) {
    if (allText.includes(author)) return author;
  }

  const literaryKeywords = ['novel', 'play', 'poem', 'poetry', 'prose', 'chapter', 'act', 'scene', 'extract', 'passage'];
  if (literaryKeywords.some(k => allText.includes(k))) {
    return 'unknown_literary_work';
  }

  return null;
}

function isPublicDomain(text: string): boolean {
  const t = text.toLowerCase();
  if (PUBLIC_DOMAIN_TITLES.includes(t)) return true;
  return PUBLIC_DOMAIN_AUTHORS.some(a => t.includes(a));
}

function isCopyrighted(text: string): boolean {
  const t = text.toLowerCase();
  return COPYRIGHTED_WORKS.some(w => t.includes(w.title) || t.includes(w.author));
}

export function buildLiteraryTextInstructions(detectedText: string): string {
  if (isPublicDomain(detectedText)) {
    return `
LITERARY TEXT: "${detectedText}" — PUBLIC DOMAIN
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

  if (isCopyrighted(detectedText)) {
    return `
LITERARY TEXT: "${detectedText}" — UNDER COPYRIGHT
This work is under copyright. Excerpt max 300 words.

You may:
- Generate questions ABOUT this text freely (ideas cannot be copyrighted)
- Include SHORT stimulus passages of maximum 300 words
- Reference characters, themes, plot points, and quotes by name
- Ask students to recall and analyse the text from memory

You must NOT:
- Reproduce passages longer than 300 words
- Reproduce entire scenes or acts
- Provide the text as a substitute for owning the book

When a passage is needed for a question:
- Keep it under 300 words
- Include only the specific lines needed for that question
- Add: "[Extract from ${detectedText} — for educational analysis only]"
- If the question requires a longer passage, instruct the student
  to refer to their copy: "Re-read [Chapter X / Act Y Scene Z]
  in your copy of the text, then answer..."
`;
  }

  return `
LITERARY TEXT: "${detectedText}" — COPYRIGHT STATUS UNKNOWN
Treat this as potentially under copyright.
- Maximum excerpt: 200 words
- Generate questions about the text freely
- For longer passages, instruct students to refer to their own copy
- Add educational use disclaimer to any excerpts included
`;
}

export function buildExtractSafetyInstruction(sourceType: string, subjectName: string): string {
  return `
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
}
