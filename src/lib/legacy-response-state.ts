/** Lossless bridge for existing inputs. New formats use ResponseEnvelope.
 * Never guess a new response contract from punctuation in a legacy question. */
export interface LegacyAnswerDraft {
    version: 1;
    text?: {
        workingOut: string;
        finalAnswer: string;
        answerLatex?: string;
    };
    table?: Record<string, string | boolean>;
    blanks?: Record<string, string>;
    grid?: Record<string, number[]>;
    graph?: {
        graphInterpretationAnswers?: Record<string, string | number | boolean>;
        graphPlottedPoints?: any[];
        graphJoinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | 'best_fit' | null;
        graphSegments?: any[];
        graphDrawnPaths?: any[];
        graphBestFitLine?: {
            x1: number;
            y1: number;
            x2: number;
            y2: number;
        } | null;
        bearingsAnswer?: string;
        angleMeasurements?: any[];
        transformationAnswers?: Record<string, any>;
    };
}
export function legacyDraftHasAnswer(d: LegacyAnswerDraft | undefined): boolean {
    if (!d)
        return false;
    if (d.text?.workingOut?.trim() || d.text?.finalAnswer?.trim() || d.text?.answerLatex?.trim())
        return true;
    if (Object.values(d.blanks ?? {}).some(x => x.trim()))
        return true;
    if (Object.values(d.table ?? {}).some(x => typeof x === 'boolean' ? x : x.trim()))
        return true;
    if (Object.values(d.grid ?? {}).some(x => x.length))
        return true;
    const g = d.graph;
    return Boolean(g && (g.graphPlottedPoints?.length || g.graphSegments?.length || g.graphDrawnPaths?.length || g.graphBestFitLine || g.bearingsAnswer?.trim() || Object.values(g.graphInterpretationAnswers ?? {}).some(v => v !== '' && v !== null && v !== undefined) || Object.keys(g.transformationAnswers ?? {}).length));
}
export function readLegacyBlanks(text: string): Record<string, string> | null {
    try {
        const v = JSON.parse(text);
        return v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && Object.entries(v).every(([k, x]) => /^blank_\d+$/.test(k) && typeof x === 'string') ? v : null;
    }
    catch {
        return null;
    }
}
/** Browser storage is optional and untrusted; a damaged cache must not replace
 * a valid database answer or crash the question UI on refresh. */
export function readLegacyDraft(value: unknown): LegacyAnswerDraft | null {
    const object = (v: unknown): v is Record<string, any> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
    if (!object(value) || value.version !== 1 || Object.keys(value).some(k => !['version', 'text', 'table', 'blanks', 'grid', 'graph'].includes(k)))
        return null;
    if (value.text !== undefined && (!object(value.text) || typeof value.text.workingOut !== 'string' || typeof value.text.finalAnswer !== 'string' || (value.text.answerLatex !== undefined && typeof value.text.answerLatex !== 'string')))
        return null;
    if (value.table !== undefined && (!object(value.table) || Object.values(value.table).some(v => typeof v !== 'string' && typeof v !== 'boolean')))
        return null;
    if (value.blanks !== undefined && (!object(value.blanks) || Object.entries(value.blanks).some(([k, v]) => !/^blank_\d+$/.test(k) || typeof v !== 'string')))
        return null;
    if (value.grid !== undefined && (!object(value.grid) || Object.values(value.grid).some(v => !Array.isArray(v) || v.some(n => !Number.isInteger(n) || n < 0))))
        return null;
    if (value.graph !== undefined) {
        const g = value.graph;
        if (!object(g))
            return null;
        for (const key of ['graphPlottedPoints', 'graphSegments', 'graphDrawnPaths', 'angleMeasurements'])
            if (g[key] !== undefined && !Array.isArray(g[key]))
                return null;
        for (const key of ['graphInterpretationAnswers', 'transformationAnswers'])
            if (g[key] !== undefined && !object(g[key]))
                return null;
        if (g.bearingsAnswer !== undefined && typeof g.bearingsAnswer !== 'string')
            return null;
    }
    return structuredClone(value) as LegacyAnswerDraft;
}
