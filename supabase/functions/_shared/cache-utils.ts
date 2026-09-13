// Cache identity for generated question sets.
//
// v2 (this file) replaces the old truncated-base64 identity. The old scheme
// base64-encoded a "::"-joined string and then cut it to 64 characters, so two
// sets that differed only in a late field (difficulty, format, count, variation
// slot) could produce the SAME key and serve each other's questions. v2 hashes
// a canonical UTF-8 JSON document with SHA-256, so every field always affects
// the identity.
//
// The namespace prefix changes too, so no v1 entry can ever be read as a v2
// entry. Old rows simply stop being hit and expire on their own — nothing is
// deleted and no user data is flushed.

export const CACHE_NAMESPACE = "v2";
/** Bump when the canonical document or the prompt contract changes. */
export const CACHE_SCHEMA_VERSION = 1;

export interface CacheIdentityInput {
  subject: string;
  examBoard: string;
  educationalLevel: string;
  /** Foundation / Higher / not_tiered, or null when unknown or unsupported. */
  assessmentTier?: string | null;
  topics: string[];
  difficulty: string;
  questionFormat: string;
  questionCount: number;
  isCustomNiche?: boolean;
  variationSlot?: number;
  /** Reserved, already part of the identity so later batches cannot collide. */
  courseId?: string | null;
  paperId?: string | null;
  presetVersion?: string | number | null;
  resourceVersion?: string | number | null;
}

const text = (v: unknown) => String(v ?? "").trim().toLowerCase();

const canonicalDocument = (
  params: CacheIdentityInput,
  variationSlot: number | "base",
): string =>
  JSON.stringify({
    ns: CACHE_NAMESPACE,
    schema: CACHE_SCHEMA_VERSION,
    subject: text(params.subject),
    examBoard: text(params.examBoard),
    educationalLevel: text(params.educationalLevel),
    assessmentTier: params.assessmentTier
      ? text(params.assessmentTier)
      : "unknown",
    topics: [...(params.topics ?? [])].map(text).sort(),
    difficulty: text(params.difficulty),
    questionFormat: text(params.questionFormat),
    questionCount: Number(params.questionCount ?? 0),
    courseId: params.courseId ? text(params.courseId) : null,
    paperId: params.paperId ? text(params.paperId) : null,
    presetVersion: params.presetVersion ?? null,
    resourceVersion: params.resourceVersion ?? null,
    variationSlot,
  });

const sha256Hex = async (input: string): Promise<string> => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// Prefix + 61 hex chars keeps the key at 64 characters, matching the existing
// column width while leaving 244 bits of digest — collision-free in practice.
const buildKey = async (
  params: CacheIdentityInput,
  variationSlot: number | "base",
): Promise<string> => {
  const hex = await sha256Hex(canonicalDocument(params, variationSlot));
  return `${CACHE_NAMESPACE}_${hex.slice(0, 61)}`;
};

/** Full cache key for one variation slot, or null when caching is not allowed. */
export const buildCacheKey = async (
  params: CacheIdentityInput,
): Promise<string | null> => {
  if (params.isCustomNiche) return null; // never cache custom niche subjects
  if (!params.examBoard || !params.educationalLevel) return null;
  return await buildKey(params, params.variationSlot ?? 0);
};

/** Slot-tracking key: identical document minus the variation slot. */
export const buildBaseCacheKey = async (
  params: CacheIdentityInput,
): Promise<string> => await buildKey(params, "base");

/**
 * Defence in depth: a cached row is only usable when it was stored for the
 * same course context and still carries questions.
 */
export const isCacheEntryCompatible = (
  row: {
    subject?: string | null;
    exam_board?: string | null;
    educational_level?: string | null;
    questions?: unknown;
  } | null,
  params: CacheIdentityInput,
): boolean => {
  if (!row) return false;
  if (!Array.isArray(row.questions) || row.questions.length === 0) return false;
  const same = (a?: string | null, b?: string | null) =>
    a == null || b == null || text(a) === text(b);
  return (
    same(row.subject, params.subject) &&
    same(row.exam_board, params.examBoard) &&
    same(row.educational_level, params.educationalLevel)
  );
};

export const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
