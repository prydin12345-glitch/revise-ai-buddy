import { vi } from "vitest";
import { canonical } from "../functions/_shared/profile-template";
import type {
  SourceJobRecord,
  SourceJobStore,
  SourceJobData,
  SourceJobStage,
  SourceJobDeps,
} from "../functions/_shared/profile-builder-jobs";
export function memoryJobStore() {
  const records = new Map<string, SourceJobRecord>();
  const hashes = new Map<string, string>(),
    keys = new Map<string, string>();
  const usage: unknown[] = [],
    receipts = new Map<string, any>();
  let reservations = 0;
  const key = (owner: string, id: string) => owner + ":" + id;
  const clone = <T>(value: T): T => structuredClone(value);
  const current = (r: SourceJobRecord) => {
    const real = records.get(key(r.owner, r.id))!;
    if (
      !r.leaseToken ||
      real.leaseToken !== r.leaseToken ||
      real.revision !== r.revision
    )
      throw Error("lease changed");
    return real;
  };
  const store: SourceJobStore = {
    async create(owner, id, hash, sourceKey, data, stage, elapsedMs) {
      const k = key(owner, id),
        old = records.get(k);
      if (old) {
        if (hashes.get(k) !== hash) throw Error("different input");
        return clone(old);
      }
      const r: SourceJobRecord = {
        owner,
        id,
        stage,
        revision: 0,
        leaseToken: null,
        leaseUntil: null,
        createdAt: new Date().toISOString(),
        quotaReserved: false,
        callIntents: 0,
        activeMs: elapsedMs,
        data: clone(data),
      };
      records.set(k, r);
      hashes.set(k, hash);
      keys.set(k, sourceKey);
      receipts.set(k, {
        state: "running",
        call_intents: 0,
        provider_usage: [],
      });
      return clone(r);
    },
    async load(owner, id) {
      const r = records.get(key(owner, id));
      return r ? clone(r) : null;
    },
    async cached(owner, sourceKey) {
      const r = [...records].find(
        ([k, r]) =>
          r.owner === owner &&
          keys.get(k) === sourceKey &&
          ["ready", "drafting", "complete"].includes(r.stage) &&
          r.data.evidence,
      )?.[1];
      return r ? clone(r.data.evidence) : null;
    },
    async acquire(owner, id) {
      const r = records.get(key(owner, id));
      if (!r) throw Error("not found");
      if (
        r.leaseToken &&
        r.leaseUntil &&
        Date.parse(r.leaseUntil) <= Date.now()
      ) {
        r.leaseToken = null;
        r.leaseUntil = null;
      }
      if (r.leaseToken) return { ...clone(r), leaseToken: null };
      if (["failed", "complete", "needs_details"].includes(r.stage))
        return clone(r);
      r.leaseToken = crypto.randomUUID();
      r.leaseUntil = new Date(Date.now() + 60_000).toISOString();
      return clone(r);
    },
    async commit(r, change) {
      const real = current(r);
      Object.assign(real, {
        data: clone(change.data),
        stage: change.stage,
        activeMs: real.activeMs + change.elapsedMs,
        revision: real.revision + 1,
        leaseToken: null,
        leaseUntil: null,
      });
      if (["failed", "complete"].includes(real.stage))
        Object.assign(receipts.get(key(real.owner, real.id)), {
          state: real.stage,
          result: change.proposal ?? null,
        });
      return clone(real);
    },
    async reserve(r) {
      const real = current(r);
      if (!real.quotaReserved) {
        reservations++;
        real.quotaReserved = true;
      }
    },
    async beginCall(r) {
      const real = current(r);
      if (real.callIntents >= 3) throw Error("budget");
      real.callIntents++;
      receipts.get(key(real.owner, real.id)).call_intents++;
    },
    async finishCall(r, change, used) {
      current(r);
      usage.push(clone(used));
      receipts.get(key(r.owner, r.id)).provider_usage.push(clone(used));
      return store.commit(r, change);
    },
  };
  return {
    store,
    records,
    receipts,
    usage,
    keys,
    get reservations() {
      return reservations;
    },
  };
}
export const ownerKey = (owner: string, id: string) => owner + ":" + id;
