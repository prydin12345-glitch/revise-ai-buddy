/** One in-flight write per question. New edits replace pending snapshots, never
 * an in-flight snapshot. A failed write remains dirty and flush rejects. */
export class ResponseSaveQueue<T> {
    private entries = new Map<string, {
        value: T;
        version: number;
        saved: number;
        running?: Promise<void>;
    }>();
    constructor(private persist: (id: string, value: T) => Promise<void>, private acknowledged?: (id: string, value: T) => void) { }
    update(id: string, value: T) { const old = this.entries.get(id); this.entries.set(id, { ...old, value: structuredClone(value), version: (old?.version ?? 0) + 1, saved: old?.saved ?? 0 }); }
    dirtyIds() { return [...this.entries].filter(([, e]) => e.version !== e.saved).map(([id]) => id); }
    async flush(id: string): Promise<void> {
        let entry = this.entries.get(id);
        if (!entry)
            return;
        if (entry.running) {
            await entry.running;
            return this.flush(id);
        }
        const run = async () => {
            while ((entry = this.entries.get(id)) && entry.version !== entry.saved) {
                const { value, version } = entry;
                await this.persist(id, structuredClone(value));
                const latest = this.entries.get(id)!;
                latest.saved = version;
                if (latest.version === version)
                    this.acknowledged?.(id, value);
            }
        };
        const promise = run();
        this.entries.get(id)!.running = promise;
        try {
            await promise;
        }
        finally {
            const latest = this.entries.get(id);
            if (latest?.running === promise)
                delete latest.running;
        }
    }
    async flushAll() { await Promise.all(this.dirtyIds().map(id => this.flush(id))); }
}
