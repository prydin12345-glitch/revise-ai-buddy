import { createContext, useCallback, useContext, useRef, useSyncExternalStore, type SetStateAction } from 'react';

/** Memory only: list contents never become a browser-persisted account cache. */
export class WorkspaceStore {
  constructor(public readonly ownerId: string | null = null, public readonly generation = 0) {}
  private values = new Map<string, unknown>();
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get<T>(key: string, initial: T | (() => T)): T {
    if (!this.values.has(key)) this.values.set(key, typeof initial === 'function' ? (initial as () => T)() : initial);
    return this.values.get(key) as T;
  }
  set<T>(key: string, value: SetStateAction<T>, initial: T | (() => T)) {
    const previous = this.get(key, initial);
    const next = typeof value === 'function' ? (value as (previous: T) => T)(previous) : value;
    if (Object.is(previous, next)) return;
    this.values.set(key, next);
    this.listeners.forEach(listener => listener());
  }
}

const fallbackStore = new WorkspaceStore();
export const WorkspaceContext = createContext({ ownerId: null as string | null, ready: true, store: fallbackStore });

export const useWorkspaceSession = () => useContext(WorkspaceContext);

export function useRetainedState<T>(key: string, initial: T | (() => T)) {
  const { store } = useWorkspaceSession();
  const initialValue = useRef(initial);
  const getSnapshot = useCallback(() => store.get(key, initialValue.current), [store, key]);
  const value = useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
  const setValue = useCallback((next: SetStateAction<T>) => store.set(key, next, initialValue.current), [store, key]);
  return [value, setValue] as const;
}
