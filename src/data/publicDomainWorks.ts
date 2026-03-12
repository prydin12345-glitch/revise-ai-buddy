export interface LiteraryWork {
  title: string;
  author: string;
  deathYear: number | null;
  publicDomainUK: boolean;
  publicDomainUS: boolean;
  projectGutenbergUrl?: string;
  notes?: string;
}

export interface CopyrightedWork {
  title: string;
  author: string;
  deathYear: number | null;
  ukCopyrightUntil: number | null;
  notes: string;
}

// UK rule: 70 years after author death
// US rule: published before 1928 is public domain

export const PUBLIC_DOMAIN_WORKS: LiteraryWork[] = [
  // Shakespeare (died 1616)
  { title: 'Macbeth', author: 'William Shakespeare', deathYear: 1616,
    publicDomainUK: true, publicDomainUS: true,
    projectGutenbergUrl: 'https://www.gutenberg.org/ebooks/1533' },
  { title: 'Romeo and Juliet', author: 'William Shakespeare', deathYear: 1616,
    publicDomainUK: true, publicDomainUS: true,
    projectGutenbergUrl: 'https://www.gutenberg.org/ebooks/1112' },
  { title: 'Hamlet', author: 'William Shakespeare', deathYear: 1616,
    publicDomainUK: true, publicDomainUS: true,
    projectGutenbergUrl: 'https://www.gutenberg.org/ebooks/1524' },
  { title: "A Midsummer Night's Dream", author: 'William Shakespeare',
    deathYear: 1616, publicDomainUK: true, publicDomainUS: true },
  { title: 'The Merchant of Venice', author: 'William Shakespeare',
    deathYear: 1616, publicDomainUK: true, publicDomainUS: true },
  { title: 'Othello', author: 'William Shakespeare', deathYear: 1616,
    publicDomainUK: true, publicDomainUS: true },
  { title: 'King Lear', author: 'William Shakespeare', deathYear: 1616,
    publicDomainUK: true, publicDomainUS: true },
  { title: 'The Tempest', author: 'William Shakespeare', deathYear: 1616,
    publicDomainUK: true, publicDomainUS: true },

  // Dickens (died 1870)
  { title: 'Great Expectations', author: 'Charles Dickens', deathYear: 1870,
    publicDomainUK: true, publicDomainUS: true,
    projectGutenbergUrl: 'https://www.gutenberg.org/ebooks/1400' },
  { title: 'A Christmas Carol', author: 'Charles Dickens', deathYear: 1870,
    publicDomainUK: true, publicDomainUS: true,
    projectGutenbergUrl: 'https://www.gutenberg.org/ebooks/46' },
  { title: 'Oliver Twist', author: 'Charles Dickens', deathYear: 1870,
    publicDomainUK: true, publicDomainUS: true },
  { title: 'A Tale of Two Cities', author: 'Charles Dickens', deathYear: 1870,
    publicDomainUK: true, publicDomainUS: true },
  { title: 'Bleak House', author: 'Charles Dickens', deathYear: 1870,
    publicDomainUK: true, publicDomainUS: true },

  // Austen (died 1817)
  { title: 'Pride and Prejudice', author: 'Jane Austen', deathYear: 1817,
    publicDomainUK: true, publicDomainUS: true,
    projectGutenbergUrl: 'https://www.gutenberg.org/ebooks/1342' },
  { title: 'Emma', author: 'Jane Austen', deathYear: 1817,
    publicDomainUK: true, publicDomainUS: true },
  { title: 'Sense and Sensibility', author: 'Jane Austen', deathYear: 1817,
    publicDomainUK: true, publicDomainUS: true },

  // Hardy (died 1928)
  { title: "Tess of the d'Urbervilles", author: 'Thomas Hardy', deathYear: 1928,
    publicDomainUK: true, publicDomainUS: true },
  { title: 'Far from the Madding Crowd', author: 'Thomas Hardy', deathYear: 1928,
    publicDomainUK: true, publicDomainUS: true },
  { title: 'The Mayor of Casterbridge', author: 'Thomas Hardy', deathYear: 1928,
    publicDomainUK: true, publicDomainUS: true },

  // Orwell (died 1950 — UK PD 2021, US NOT yet)
  { title: 'Animal Farm', author: 'George Orwell', deathYear: 1950,
    publicDomainUK: true, publicDomainUS: false,
    notes: 'UK public domain since 2021. US: published 1945, not yet PD in US.' },
  { title: 'Nineteen Eighty-Four', author: 'George Orwell', deathYear: 1950,
    publicDomainUK: true, publicDomainUS: false,
    notes: 'UK public domain since 2021. US: published 1949, not yet PD in US.' },

  // Brontës
  { title: 'Jane Eyre', author: 'Charlotte Brontë', deathYear: 1855,
    publicDomainUK: true, publicDomainUS: true },
  { title: 'Wuthering Heights', author: 'Emily Brontë', deathYear: 1848,
    publicDomainUK: true, publicDomainUS: true },

  // Other classics
  { title: 'Frankenstein', author: 'Mary Shelley', deathYear: 1851,
    publicDomainUK: true, publicDomainUS: true,
    projectGutenbergUrl: 'https://www.gutenberg.org/ebooks/84' },
  { title: 'Dracula', author: 'Bram Stoker', deathYear: 1912,
    publicDomainUK: true, publicDomainUS: true },
  { title: 'The Strange Case of Dr Jekyll and Mr Hyde',
    author: 'Robert Louis Stevenson', deathYear: 1894,
    publicDomainUK: true, publicDomainUS: true },
  { title: 'Lord of the Flies', author: 'William Golding', deathYear: 1993,
    publicDomainUK: false, publicDomainUS: false,
    notes: 'UK copyright until 2063. Excerpt only — max 300 words.' },
];

export const COPYRIGHTED_WORKS: CopyrightedWork[] = [
  { title: 'An Inspector Calls', author: 'J.B. Priestley', deathYear: 1984,
    ukCopyrightUntil: 2054,
    notes: 'Very commonly studied at GCSE. Excerpt max 300 words.' },
  { title: 'Never Let Me Go', author: 'Kazuo Ishiguro', deathYear: null,
    ukCopyrightUntil: null, notes: 'Author still living. Excerpt max 300 words.' },
  { title: 'The Curious Incident of the Dog in the Night-Time',
    author: 'Mark Haddon', deathYear: null,
    ukCopyrightUntil: null, notes: 'Author still living. Excerpt max 300 words.' },
  { title: 'Of Mice and Men', author: 'John Steinbeck', deathYear: 1968,
    ukCopyrightUntil: 2038, notes: 'UK copyright until 2038. Excerpt max 300 words.' },
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', deathYear: 1940,
    ukCopyrightUntil: 2010,
    notes: 'UK public domain since 2010. US public domain since 2021.' },
  { title: 'A Streetcar Named Desire', author: 'Tennessee Williams',
    deathYear: 1983, ukCopyrightUntil: 2053,
    notes: 'Still under copyright in UK.' },
  { title: 'Blood Brothers', author: 'Willy Russell', deathYear: null,
    ukCopyrightUntil: null, notes: 'Author still living. Excerpt max 300 words.' },
  { title: 'The History Boys', author: 'Alan Bennett', deathYear: null,
    ukCopyrightUntil: null, notes: 'Author still living. Do not reproduce.' },
];

export const getWorkCopyrightStatus = (titleOrAuthor: string): {
  status: 'public_domain' | 'copyrighted' | 'unknown';
  work: LiteraryWork | CopyrightedWork | null;
} => {
  const search = titleOrAuthor.toLowerCase();

  const pdWork = PUBLIC_DOMAIN_WORKS.find(w =>
    w.title.toLowerCase().includes(search) ||
    w.author.toLowerCase().includes(search)
  );
  if (pdWork) return { status: 'public_domain', work: pdWork };

  const crWork = COPYRIGHTED_WORKS.find(w =>
    w.title.toLowerCase().includes(search) ||
    w.author.toLowerCase().includes(search)
  );
  if (crWork) return { status: 'copyrighted', work: crWork };

  return { status: 'unknown', work: null };
};

export const getMaxExcerptWords = (titleOrAuthor: string): number => {
  const { status } = getWorkCopyrightStatus(titleOrAuthor);
  if (status === 'public_domain') return 2000;
  if (status === 'copyrighted') return 300;
  return 200;
};
