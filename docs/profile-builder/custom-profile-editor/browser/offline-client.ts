/** Strict synthetic persistence boundary. No API client or live credentials. */
export const copy = <T,>(value: T): T => structuredClone(value);
export interface MemoryState {
  owner: string;
  rows: Map<string, Record<string, unknown>>;
  calls: Array<{ table: string; action: string; payload: unknown; filters: Record<string, unknown> }>;
  failures: { core: number; tier: number };
}
export const memory: MemoryState = {
  owner: 'synthetic-custom-editor-owner', rows: new Map(), calls: [], failures: { core: 0, tier: 0 },
};
let sequence = 0;
const blocked = () => { throw Error('Unexpected live client operation blocked by custom editor harness.'); };
const failure = (message: string) => ({ data: null, error: { code: 'SYNTHETIC_FAILURE', message } });

export function resetMemory(rows: Array<Record<string, unknown>> = []) {
  memory.rows = new Map(rows.map(row => [String(row.id), copy(row)]));
  memory.calls = []; memory.failures = { core: 0, tier: 0 }; sequence = 0;
}

class Query {
  action = 'select';
  payload: Record<string, unknown> = {};
  filters: Record<string, unknown> = {};
  constructor(readonly table: string) {
    if (table !== 'subject_exam_profiles') throw Error(`Unexpected table blocked: ${table}`);
  }
  insert(payload: Record<string, unknown>) { this.action = 'insert'; this.payload = copy(payload); return this; }
  update(payload: Record<string, unknown>) { this.action = 'update'; this.payload = copy(payload); return this; }
  select() { return this; }
  eq(key: string, value: unknown) {
    if (key !== 'id' && key !== 'user_id') throw Error(`Unexpected filter blocked: ${key}`);
    this.filters[key] = value; return this;
  }
  single() { return Promise.resolve(this.execute()); }
  maybeSingle() { return this.single(); }
  then(resolve: (value: ReturnType<Query['execute']>) => unknown, reject?: (reason: unknown) => unknown) {
    return this.single().then(resolve, reject);
  }
  execute(): { data: Record<string, unknown> | null; error: { code: string; message: string } | null } {
    memory.calls.push(copy({ table: this.table, action: this.action, payload: this.payload, filters: this.filters }));
    const tierOnly = this.action === 'update' && Object.keys(this.payload).length === 1 && 'assessment_tier' in this.payload;
    const phase = tierOnly ? 'tier' : 'core';
    if (this.action !== 'select' && memory.failures[phase] > 0) { memory.failures[phase]--; return failure(`Synthetic ${phase} save failed; retry preserves your draft.`); }
    if (this.action === 'insert') {
      if (this.payload.user_id !== memory.owner) throw Error('Synthetic insert owner mismatch.');
      const row = { id: `synthetic-created-${++sequence}`, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', assessment_tier: null, ...copy(this.payload) };
      memory.rows.set(String(row.id), row);
      return { data: copy(row), error: null };
    }
    if (!this.filters.id) throw Error('Synthetic persistence requires an explicit profile ID.');
    const row = memory.rows.get(String(this.filters.id));
    if (!row || row.user_id !== memory.owner || (this.filters.user_id && this.filters.user_id !== memory.owner))
      return failure('Synthetic profile ownership check failed.');
    if (this.action === 'update') Object.assign(row, copy(this.payload));
    return { data: copy(row), error: null };
  }
}

export const supabase = {
  auth: {
    getUser: async () => ({ data: { user: { id: memory.owner } }, error: null }),
    getSession: async () => ({ data: { session: { user: { id: memory.owner } } }, error: null }),
    onAuthStateChange: blocked,
  },
  from: (table: string) => new Query(table),
  functions: { invoke: blocked }, rpc: blocked, storage: { from: blocked }, channel: blocked,
};
