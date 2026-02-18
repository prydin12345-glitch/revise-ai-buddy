/**
 * Notes Sanitization Utility
 * 
 * Provides client-side validation and sanitization for the "Notes" field
 * used in exam and practice question generation.
 * 
 * SECURITY CHECKLIST (2026-01-09):
 * ✅ Notes cannot request new platform features/buttons/components
 * ✅ Notes cannot request UI/schema/API changes
 * ✅ Notes can only constrain content: topics, difficulty, question types, etc.
 * ✅ Prompt injection patterns blocked
 * ✅ Content policy violations blocked
 * ✅ Personal data redacted
 */

export interface NotesSanitizationResult {
  isValid: boolean;
  sanitizedNotes: string;
  warnings: string[];
  blockedReasons: string[];
  characterCount: number;
  redactionsCount: number;
}

// Maximum allowed characters for notes
export const MAX_NOTES_LENGTH = 1000;

// Prompt injection patterns to block
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+(instructions?|prompts?|rules?)/i,
  /ignore\s+(the\s+)?(above|prior|earlier)/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /reveal\s+(hidden|secret|internal)/i,
  /bypass\s+(safety|security|filter|rules?)/i,
  /jailbreak/i,
  /you\s+are\s+now\s+(a|an)/i,
  /forget\s+(everything|all|previous)/i,
  /act\s+as\s+(if\s+you\s+are|a|an)/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /roleplay\s+as/i,
  /new\s+instructions?:/i,
  /override\s+(the\s+)?(system|rules?|instructions?)/i,
  /disregard\s+(all|previous|the)/i,
  /from\s+now\s+on\s+(you\s+are|act\s+as)/i,
  /stop\s+being\s+(an?\s+)?ai/i,
  /\[system\]/i,
  /\[admin\]/i,
  /\[developer\]/i,
];

// SECURITY: Feature request patterns that should be blocked
// Notes can only constrain content (topics, difficulty, question types that exist)
// They CANNOT request new platform features, UI changes, or schema modifications
const FEATURE_REQUEST_PATTERNS = [
  { pattern: /\b(add|create|implement|build|make)\s+(a\s+)?new\s+(button|component|feature|diagram|screen|page|modal|form|field|input|table|column)/i, reason: "Cannot request new platform features in notes" },
  { pattern: /\b(add|create|implement|build|make)\s+(a\s+)?(custom\s+)?(ui|interface|design|layout)/i, reason: "Cannot request UI changes in notes" },
  { pattern: /\b(modify|change|update|alter)\s+(the\s+)?(database|schema|table|column)/i, reason: "Cannot request database changes in notes" },
  { pattern: /\b(add|create|implement)\s+(a\s+)?new\s+question\s+type/i, reason: "Cannot request new question types in notes" },
  { pattern: /\bimplement\s+(a\s+)?new\s+(feature|functionality)/i, reason: "Cannot request new features in notes" },
  { pattern: /\b(add|create)\s+(a\s+)?(new\s+)?(endpoint|api|route|function)/i, reason: "Cannot request API changes in notes" },
  { pattern: /\bupgrade\s+(the\s+)?(app|application|platform|system)/i, reason: "Cannot request platform upgrades in notes" },
  { pattern: /\b(add|include)\s+(support\s+for|a)\s+(new\s+)?(graph|chart|visualization)\s+type/i, reason: "Cannot request new visualization types in notes" },
];

// Content policy violation patterns
const CONTENT_POLICY_PATTERNS = [
  { pattern: /real\s+exam\s+answers?/i, reason: "Cannot request answers to real exams" },
  { pattern: /leaked?\s+(paper|exam|test)/i, reason: "Cannot request leaked exam content" },
  { pattern: /mark\s+scheme\s+for\s+(live|real|upcoming|unreleased)/i, reason: "Cannot request mark schemes for unreleased exams" },
  { pattern: /cheat\s+(on|the|this)\s+(exam|test)/i, reason: "Cannot assist with cheating" },
  { pattern: /answers?\s+to\s+(the\s+)?(june|may|november|january)\s+\d{4}\s+(paper|exam)/i, reason: "Cannot provide answers to specific dated exams" },
  { pattern: /give\s+me\s+(the\s+)?answers?\s+to/i, reason: "Cannot provide direct exam answers" },
  { pattern: /\b(kill|murder|harm|hurt|attack)\s+(myself|yourself|someone|people)/i, reason: "Content policy violation" },
  { pattern: /\b(suicide|self[- ]?harm)\b/i, reason: "Content policy violation" },
  { pattern: /\b(drugs?|cocaine|heroin|meth)\s+(recipe|make|create|cook)/i, reason: "Content policy violation" },
  { pattern: /\b(bomb|weapon|explosive)\s+(make|create|build|instructions?)/i, reason: "Content policy violation" },
  { pattern: /\b(nude|naked|porn|xxx|sex)\b/i, reason: "Inappropriate content not allowed" },
];

// Personal data patterns for detection and redaction
const PERSONAL_DATA_PATTERNS = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: "email", replacement: "[email redacted]" },
  { pattern: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, type: "phone", replacement: "[phone redacted]" },
  { pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, type: "ssn", replacement: "[ID redacted]" },
  { pattern: /\bstudent\s*(id|number|#):\s*\w+/gi, type: "student_id", replacement: "[student ID redacted]" },
];

// HTML/JS/Markdown patterns to strip
const UNSAFE_CONTENT_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<[^>]+>/g, // All HTML tags
  /javascript:/gi,
  /on\w+\s*=/gi, // Event handlers
  /\[.*?\]\(.*?\)/g, // Markdown links
  /```[\s\S]*?```/g, // Code blocks
];

/**
 * Sanitize and validate notes input
 */
export function sanitizeNotes(input: string): NotesSanitizationResult {
  const warnings: string[] = [];
  const blockedReasons: string[] = [];
  let redactionsCount = 0;
  
  if (!input || typeof input !== 'string') {
    return {
      isValid: true,
      sanitizedNotes: '',
      warnings: [],
      blockedReasons: [],
      characterCount: 0,
      redactionsCount: 0,
    };
  }

  let sanitized = input;

  // Step 1: Basic cleanup
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Remove excessive repeated characters (more than 5 in a row)
  sanitized = sanitized.replace(/(.)\1{5,}/g, '$1$1$1');
  
  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Collapse multiple spaces and newlines
  sanitized = sanitized.replace(/[ \t]+/g, ' ');
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  // Step 2: Strip HTML/JS/Markdown
  for (const pattern of UNSAFE_CONTENT_PATTERNS) {
    if (pattern.test(sanitized)) {
      warnings.push("HTML, scripts, or code blocks have been removed");
      sanitized = sanitized.replace(pattern, '');
    }
  }

  // Step 3: Check for prompt injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      blockedReasons.push("Notes cannot include instructions that try to override the system");
      break;
    }
  }

  // Step 3b: SECURITY - Check for feature request patterns
  // Notes can only constrain content, not request new platform features
  for (const { pattern, reason } of FEATURE_REQUEST_PATTERNS) {
    if (pattern.test(sanitized)) {
      blockedReasons.push(reason);
      break;
    }
  }

  // Step 4: Check for content policy violations
  for (const { pattern, reason } of CONTENT_POLICY_PATTERNS) {
    if (pattern.test(sanitized)) {
      blockedReasons.push(reason);
      break;
    }
  }

  // Step 5: Detect and redact personal data
  for (const { pattern, type, replacement } of PERSONAL_DATA_PATTERNS) {
    const matches = sanitized.match(pattern);
    if (matches && matches.length > 0) {
      warnings.push(`${type === 'email' ? 'Email address' : type === 'phone' ? 'Phone number' : 'Personal data'} detected and will be removed`);
      redactionsCount += matches.length;
      sanitized = sanitized.replace(pattern, replacement);
    }
  }

  // Step 6: Enforce length limit
  if (sanitized.length > MAX_NOTES_LENGTH) {
    warnings.push(`Notes truncated to ${MAX_NOTES_LENGTH} characters`);
    sanitized = sanitized.substring(0, MAX_NOTES_LENGTH);
  }

  // Final cleanup
  sanitized = sanitized.trim();

  return {
    isValid: blockedReasons.length === 0,
    sanitizedNotes: sanitized,
    warnings,
    blockedReasons,
    characterCount: sanitized.length,
    redactionsCount,
  };
}

/**
 * Quick validation check without full sanitization
 */
export function validateNotesQuick(input: string): { valid: boolean; reason?: string } {
  if (!input || input.trim().length === 0) {
    return { valid: true };
  }

  // Check injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { valid: false, reason: "Invalid instructions detected" };
    }
  }

  // Check content policy
  for (const { pattern, reason } of CONTENT_POLICY_PATTERNS) {
    if (pattern.test(input)) {
      return { valid: false, reason };
    }
  }

  // Check length
  if (input.length > MAX_NOTES_LENGTH) {
    return { valid: false, reason: `Notes must be under ${MAX_NOTES_LENGTH} characters` };
  }

  return { valid: true };
}

/**
 * Example notes for the UI dropdown
 */
export const NOTES_EXAMPLES = [
  "Focus on meiosis and mitosis; include 2 table questions",
  "GCSE style; structured mark scheme format; medium difficulty; no calculus required",
  "Include 5 MCQs and 3 short answer questions",
  "10 minutes time limit; show working required",
  "Focus on photosynthesis; avoid cellular respiration",
  "Higher tier only; include graph interpretation",
  "Foundation level; use simple vocabulary",
  "Include real-world application questions",
];
