/**
 * Paper-scope topic suggestions — short curated starter sets per subject,
 * written in our own words at coarse granularity (never specification prose;
 * topic names and the shape of public knowledge are not protectable, but
 * boards' detailed wording is — so none of it appears here).
 * These are the scopes that steer generation: e.g. "Unseen poetry" routes
 * English to the poem engine.
 */

const ALEVEL_RE = /a[-\s_]?level|level[\s_]*3|\bas\b|\ba2\b|year[\s_]*1[23]|sixth/i;

const SUGGESTIONS: Array<{ match: RegExp; gcse: string[]; alevel?: string[] }> = [
  { match: /english.*lit|literature/i,
    gcse: ["Shakespeare", "19th-century novel", "Modern text", "Poetry anthology", "Unseen poetry"],
    alevel: ["Shakespeare", "Pre-1900 prose", "Modern prose", "Poetry", "Unseen poetry", "Comparing texts"] },
  { match: /english/i,
    gcse: ["Unseen fiction reading", "Language analysis", "Structure analysis", "Evaluating a text", "Creative writing", "Unseen non-fiction reading", "Comparing viewpoints", "Transactional writing"],
    alevel: ["Language variation", "Language and identity", "Language change", "Child language development", "Investigating language"] },
  { match: /math/i,
    gcse: ["Number", "Algebra", "Ratio and proportion", "Geometry and measures", "Probability", "Statistics"],
    alevel: ["Algebra and functions", "Calculus", "Trigonometry", "Sequences and series", "Vectors", "Statistics", "Mechanics"] },
  { match: /biolog/i,
    gcse: ["Cell biology", "Organisation", "Infection and response", "Bioenergetics", "Homeostasis and response", "Inheritance and evolution", "Ecology"],
    alevel: ["Biological molecules", "Cells", "Exchange and transport", "Genetics", "Energy transfers", "Organisms and environment", "Gene expression"] },
  { match: /chemist/i,
    gcse: ["Atomic structure and bonding", "Quantitative chemistry", "Chemical changes", "Energy changes", "Rates and equilibrium", "Organic chemistry", "Chemical analysis", "Atmosphere and resources"],
    alevel: ["Physical chemistry", "Inorganic chemistry", "Organic chemistry", "Practical analysis techniques"] },
  { match: /physic/i,
    gcse: ["Energy", "Electricity", "Particle model of matter", "Atomic structure", "Forces", "Waves", "Magnetism and electromagnetism"],
    alevel: ["Mechanics and materials", "Electricity", "Waves and optics", "Particles and quantum phenomena", "Fields", "Nuclear physics"] },
  { match: /geograph/i,
    gcse: ["Natural hazards", "Rivers and coasts", "Urban issues and challenges", "The changing economic world", "Resource management", "Fieldwork skills"],
    alevel: ["Water and carbon cycles", "Coastal systems", "Hazards", "Global systems and governance", "Changing places", "Contemporary urban environments"] },
  { match: /history/i,
    gcse: ["Medicine in Britain", "Elizabethan England", "Germany 1890\u20131945", "The American West", "Cold War and superpower relations", "Norman England"],
    alevel: ["Tsarist and Communist Russia", "The Tudors", "Britain transformed", "Germany 1918\u201345", "The British Empire", "The Cold War"] },
  { match: /psycholog/i,
    gcse: ["Memory", "Perception", "Development", "Social influence", "Research methods"],
    alevel: ["Social influence", "Memory", "Attachment", "Psychopathology", "Approaches", "Biopsychology", "Research methods"] },
  { match: /econom/i,
    gcse: ["How markets work", "Market failure", "The national economy", "The global economy"],
    alevel: ["Markets and market failure", "The national and international economy", "Business economics", "Labour markets"] },
  { match: /business/i,
    gcse: ["Enterprise and entrepreneurship", "Marketing", "Operations", "Finance", "Human resources"],
    alevel: ["Marketing strategy", "Operational performance", "Financial decisions", "Human resource strategy", "Business strategy and change"] },
  { match: /sociolog/i,
    gcse: ["Families", "Education", "Crime and deviance", "Social stratification", "Research methods"],
    alevel: ["Education with methods in context", "Families and households", "Beliefs in society", "Crime and deviance", "Theory and methods"] },
  { match: /religio/i,
    gcse: ["Beliefs and teachings", "Practices", "Relationships and families", "Religion and life", "Crime and punishment", "Peace and conflict"],
    alevel: ["Philosophy of religion", "Ethics and religion", "Study of a religion", "Dialogues between religion and society"] },
  { match: /comput/i,
    gcse: ["Systems architecture", "Data representation", "Networks", "Programming fundamentals", "Algorithms", "Security and ethics"],
    alevel: ["Data structures", "Algorithms and complexity", "Programming paradigms", "Databases", "Networks and the internet", "Theory of computation"] },
];

export function getTopicSuggestions(subjectName: string, tier: string): string[] {
  const entry = SUGGESTIONS.find((s) => s.match.test(subjectName || ""));
  if (!entry) return [];
  return ALEVEL_RE.test(tier || "") && entry.alevel ? entry.alevel : entry.gcse;
}
