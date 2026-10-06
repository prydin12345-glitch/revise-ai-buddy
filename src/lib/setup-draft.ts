export type DraftValue = string | number | boolean | null | DraftValue[] | { [key: string]: DraftValue };
export type SetupValues = Record<string, DraftValue>;
export const setupDraftKey = (owner: string, item: string) => `examly:setup:v1:${owner}:${item}`;

function compatible(value: unknown, template: DraftValue): value is DraftValue {
  if (template === null) return value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every(item => typeof item === 'number' && Number.isFinite(item)));
  if (Array.isArray(template)) return Array.isArray(value) && value.length <= 500 && value.every(item => template.length ? compatible(item, template[0]) : typeof item === 'string');
  if (typeof template === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.entries(template).every(([key, child]) => compatible((value as Record<string, unknown>)[key], child));
  return typeof value === typeof template && (typeof value !== 'number' || Number.isFinite(value));
}

/** Explicit form allowlist only: never tokens, credentials, files or model output. */
export function readSetupDraft(storage: Storage, owner: string, item: string, template: SetupValues): SetupValues | null {
  const raw = storage.getItem(setupDraftKey(owner, item));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || parsed.owner !== owner || parsed.item !== item || !Number.isFinite(parsed.updatedAt) || Date.now() - parsed.updatedAt > 24 * 60 * 60 * 1000) return null;
    if (!parsed.values || typeof parsed.values !== 'object') return null;
    const values: SetupValues = {};
    for (const [key, initial] of Object.entries(template)) {
      const value = parsed.values[key];
      if (!compatible(value, initial)) return null;
      values[key] = value;
    }
    return values;
  } catch { return null; }
}

export function writeSetupDraft(storage: Storage, owner: string, item: string, values: SetupValues) {
  storage.setItem(setupDraftKey(owner, item), JSON.stringify({ version: 1, owner, item, updatedAt: Date.now(), values }));
}

export const practiceRecoveryKey = (owner: string, setId: string, questionId: string) => `practice:${setId}:user:${owner}:draft:${questionId}`;
