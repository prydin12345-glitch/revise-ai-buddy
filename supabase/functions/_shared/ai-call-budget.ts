// A guided paper spends several provider calls: batched generation, Flash/Pro
// fallbacks, plan completion and answerability repairs. They share ONE budget
// so a long paper can never spin through unbounded calls or wall-clock time.
// Failed attempts are recorded too: they cost time and tokens.

export interface AiCallRecord {
  purpose: string;
  model: string;
  ok: boolean;
  status?: number;
  finishReason?: string;
  promptTokens: number;
  completionTokens: number;
  ms: number;
}

export class AiBudgetExhaustedError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'AiBudgetExhaustedError';
  }
}

export interface AiCallBudgetLike {
  reserve(purpose: string): void;
  record(record: AiCallRecord): void;
  exhausted(): string | null;
}

export interface AiCallBudgetOptions {
  maxCalls: number;
  maxMs: number;
  now?: () => number;
}

export class AiCallBudget implements AiCallBudgetLike {
  readonly records: AiCallRecord[] = [];
  private readonly startedAt: number;
  private readonly now: () => number;
  private reserved = 0;

  constructor(private readonly options: AiCallBudgetOptions) {
    this.now = options.now ?? (() => Date.now());
    this.startedAt = this.now();
  }

  get calls(): number { return this.reserved; }
  get failures(): number { return this.records.filter(r => !r.ok).length; }
  get promptTokens(): number { return this.records.reduce((n, r) => n + r.promptTokens, 0); }
  get completionTokens(): number { return this.records.reduce((n, r) => n + r.completionTokens, 0); }
  get elapsedMs(): number { return this.now() - this.startedAt; }
  get remainingCalls(): number { return Math.max(0, this.options.maxCalls - this.reserved); }

  /** The reason the budget is spent, or null while work may continue. */
  exhausted(): string | null {
    if (this.reserved >= this.options.maxCalls) return `AI call budget spent (${this.reserved}/${this.options.maxCalls} calls)`;
    if (this.elapsedMs >= this.options.maxMs) return `AI time budget spent (${Math.round(this.elapsedMs / 1000)}s of ${Math.round(this.options.maxMs / 1000)}s)`;
    return null;
  }

  /** Count a call before it is made, so a failure still consumes its slot. */
  reserve(purpose: string): void {
    const reason = this.exhausted();
    if (reason) throw new AiBudgetExhaustedError(`${reason} before ${purpose}`);
    this.reserved += 1;
  }

  record(record: AiCallRecord): void {
    this.records.push(record);
  }

  summary(): string {
    return `${this.calls} AI call(s), ${this.failures} failed, ${this.promptTokens} prompt + ${this.completionTokens} completion tokens, ${Math.round(this.elapsedMs / 1000)}s`;
  }
}

/** Token counts arrive in several shapes; unknown usage counts as zero, never as a guess. */
export function usageTokens(usage: any): { promptTokens: number; completionTokens: number } {
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0);
  return {
    promptTokens: num(usage?.prompt_tokens ?? usage?.input_tokens),
    completionTokens: num(usage?.completion_tokens ?? usage?.output_tokens),
  };
}
