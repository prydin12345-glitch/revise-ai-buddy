import { parseResponseDefinition, parseResponseEnvelope, responseCompleteness, type ResponseDefinition, type ResponseEnvelope } from './response-contract';
import { ResponseSaveQueue } from './response-save-queue';
export type DraftScope = {
    source: 'exam' | 'practice';
    parentId: string;
    questionId: string;
};
export type DraftTransport = (body: Record<string, unknown>) => Promise<any>;
// Postgres jsonb may reorder object keys. Compare data, not insertion order.
const fingerprint = (v: any): string => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])) : value);
/** Framework-independent state for both exam and practice UIs in Batch 2.
 * Drafts are unscored. A conflict requires reload/user reconciliation, not a
 * blind overwrite. Transport retries reuse the request ID and original body. */
export class ResponseDraftSession {
    definition!: ResponseDefinition;
    response: ResponseEnvelope | null = null;
    revision = 0;
    status: 'loading' | 'saved' | 'dirty' | 'saving' | 'error' | 'conflict' = 'loading';
    private pending: Record<string, unknown> | null = null;
    private queue: ResponseSaveQueue<ResponseEnvelope>;
    constructor(readonly scope: DraftScope, private transport: DraftTransport, private changed: () => void = () => { }, private requestId: () => string = () => crypto.randomUUID()) {
        this.queue = new ResponseSaveQueue(async (_id, value) => { await this.persist(value); }, () => { this.status = 'saved'; this.changed(); });
    }
    async load() {
        if (this.queue.dirtyIds().length)
            throw new Error('Unsaved edits must be resolved before reloading.');
        const result = await this.transport({ ...this.scope, action: 'get' });
        this.definition = parseResponseDefinition(result.definition);
        if (!Number.isInteger(result.revision) || result.revision < 0)
            throw new Error('Invalid draft revision');
        this.response = result.response ? parseResponseEnvelope(result.response, this.definition, this.scope.questionId) : null;
        this.revision = result.revision;
        this.status = 'saved';
        this.changed();
    }
    update(response: ResponseEnvelope) {
        if (this.status === 'loading' || this.status === 'conflict')
            throw new Error('Load or reconcile this draft before editing.');
        this.response = parseResponseEnvelope(response, this.definition, this.scope.questionId);
        this.queue.update(this.scope.questionId, this.response);
        this.status = 'dirty';
        this.changed();
    }
    completeness() { return this.response ? responseCompleteness(this.definition, this.response) : 'empty'; }
    async flush() { if (this.status === 'conflict')
        throw new Error('Draft conflict: reload in a new session before retrying.'); await this.queue.flushAll(); }
    private async persist(value: ResponseEnvelope) {
        this.status = 'saving';
        this.changed();
        try {
            // Resolve an ambiguous previous timeout before submitting a newer edit.
            if (this.pending) {
                const same = fingerprint(this.pending.response) === fingerprint(value);
                await this.sendPending();
                if (same)
                    return;
            }
            this.pending = { ...this.scope, action: 'save', expectedRevision: this.revision, requestId: this.requestId(), response: value };
            await this.sendPending();
        }
        catch (e) {
            this.status = (e as any)?.status === 409 ? 'conflict' : 'error';
            this.changed();
            throw e;
        }
    }
    private async sendPending() {
        const pending = this.pending!;
        const result = await this.transport(pending);
        const response = parseResponseEnvelope(result.response, this.definition, this.scope.questionId);
        if (!Number.isInteger(result.revision) || result.revision !== Number(pending.expectedRevision) + 1 || fingerprint(response) !== fingerprint(pending.response))
            throw new Error('Draft save was not confirmed');
        this.revision = result.revision;
        this.pending = null;
    }
}
