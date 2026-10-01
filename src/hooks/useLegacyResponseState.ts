import { useCallback, useMemo, useRef, useState, type SetStateAction } from 'react';
import type { LegacyAnswerDraft } from '@/lib/legacy-response-state';
type Store = Record<string, LegacyAnswerDraft>;
type Field = Exclude<keyof LegacyAnswerDraft, 'version'>;
type Values<K extends Field> = Record<string, NonNullable<LegacyAnswerDraft[K]>>;
function values<K extends Field>(store: Store, field: K): Values<K> { return Object.fromEntries(Object.entries(store).filter(([, v]) => v[field] !== undefined).map(([id, v]) => [id, v[field]])) as Values<K>; }
/** Compatibility selectors over ONE synchronous per-question response store. */
export function useLegacyResponseState(onChanged?: (id: string, draft: LegacyAnswerDraft) => void) {
    const [state, setState] = useState<Store>({});
    const current = useRef<Store>({});
    const changed = useRef(onChanged);
    changed.current = onChanged;
    const setField = useCallback(<K extends Field>(field: K, action: SetStateAction<Values<K>>) => {
        const previous = values(current.current, field), next = typeof action === 'function' ? action(previous) : action;
        const result = { ...current.current };
        for (const id of new Set([...Object.keys(previous), ...Object.keys(next)])) {
            result[id] = { ...result[id], version: 1 };
            if (id in next)
                (result[id] as any)[field] = next[id];
            else
                delete result[id][field];
            if (JSON.stringify(result[id]) !== JSON.stringify(current.current[id]))
                changed.current?.(id, result[id]);
        }
        current.current = result;
        setState(result);
    }, []);
    const setters = useMemo(() => ({
        setUserAnswers: (a: SetStateAction<Values<'text'>>) => setField('text', a),
        setTableAnswers: (a: SetStateAction<Values<'table'>>) => setField('table', a),
        setBlankAnswers: (a: SetStateAction<Values<'blanks'>>) => setField('blanks', a),
        setTableGridAnswers: (a: SetStateAction<Values<'grid'>>) => setField('grid', a),
        setGraphAnswers: (a: SetStateAction<Values<'graph'>>) => setField('graph', a),
    }), [setField]);
    const restore = useCallback((id: string, draft: LegacyAnswerDraft) => { const next = { ...current.current, [id]: structuredClone(draft) }; current.current = next; setState(next); }, []);
    const reset = useCallback(() => { current.current = {}; setState({}); }, []);
    return { current, restore, reset, ...setters, userAnswers: values(state, 'text'), tableAnswers: values(state, 'table'), blankAnswers: values(state, 'blanks'), tableGridAnswers: values(state, 'grid'), graphAnswers: values(state, 'graph') };
}
