/** Version 1 transport contract. Public definitions NEVER include marking keys.
 * Identifiers are authored once and persisted; labels/order are presentation. */
export type InputField = {
    id: string;
    label: string;
    required: boolean;
    input: 'text' | 'number' | 'select';
    options?: {
        id: string;
        label: string;
    }[];
};
type BaseDefinition = {
    version: 1;
    revision: string;
    resourceIds: string[];
};
export type ResponseDefinition = BaseDefinition & ({
    kind: 'text';
    maxLength: number;
} | {
    kind: 'choice';
    options: {
        id: string;
        label: string;
    }[];
    minSelections: number;
    maxSelections: number;
} | {
    kind: 'grid';
    rows: {
        id: string;
        label: string;
    }[];
    columns: {
        id: string;
        label: string;
    }[];
    minPerRow: number;
    maxPerRow: number;
} | {
    kind: 'cloze';
    segments: ({
        text: string;
    } | {
        blankId: string;
    })[];
    fields: InputField[];
} | {
    kind: 'fields';
    fields: InputField[];
});
export type ResponseEnvelope = {
    version: 1;
    questionId: string;
    definitionRevision: string;
} & ({
    kind: 'text';
    value: {
        text: string;
        working: string;
    };
} | {
    kind: 'choice';
    value: {
        selectedIds: string[];
    };
} | {
    kind: 'grid';
    value: {
        rows: Record<string, string[]>;
    };
} | {
    kind: 'cloze' | 'fields';
    value: {
        fields: Record<string, string>;
    };
});
export type PrivateResponseKey = {
    version: 1;
    definitionRevision: string;
    maxMarks: number;
    units: {
        id: string;
        targetIds: string[];
        marks: number;
        rule: {
            kind: 'exact_set';
            expectedIds: string[];
        } | {
            kind: 'text';
            accepted: string[];
            caseSensitive: boolean;
        } | {
            kind: 'number';
            expected: number;
            tolerance: number;
        } | {
            kind: 'rubric';
            guidance: string;
        };
    }[];
};
export const isCompleteResponseNumber = (value: string): boolean => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()) && Number.isFinite(Number(value));
export const isResponseNumberDraft = (value: string): boolean => /^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d*)?|\.?)$/i.test(value.trim());
const ID = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const reserved = new Set(['__proto__', 'prototype', 'constructor']);
function fail(message: string): never { throw new Error(`Response contract: ${message}`); }
function record(v: unknown): Record<string, any> { if (!v || typeof v !== 'object' || Array.isArray(v))
    fail('object required'); return v as Record<string, any>; }
function keys(v: Record<string, any>, allowed: string[]) { if (Object.keys(v).some(k => !allowed.includes(k) || reserved.has(k)))
    fail('unknown or private field'); }
function str(v: unknown, max = 4000): string { if (typeof v !== 'string' || v.length > max)
    fail('invalid text'); return v as string; }
function id(v: unknown): string { const s = str(v, 64); if (!ID.test(s) || reserved.has(s))
    fail('invalid stable ID'); return s; }
function integer(v: unknown, min: number, max: number): number { if (!Number.isInteger(v) || Number(v) < min || Number(v) > max)
    fail('invalid count'); return v as number; }
function list(v: unknown, max = 100): any[] { if (!Array.isArray(v) || v.length > max)
    fail('invalid list'); return v as any[]; }
function unique(values: string[]) { if (new Set(values).size !== values.length)
    fail('duplicate ID'); return values; }
function labels(v: unknown): {
    id: string;
    label: string;
}[] { const a = list(v).map(x => { const o = record(x); keys(o, ['id', 'label']); return { id: id(o.id), label: str(o.label) }; }); unique(a.map(x => x.id)); if (!a.length || a.some(x => !x.label.trim()))
    fail('empty labels'); return a; }
function fields(v: unknown): InputField[] { const a = list(v, 64).map(x => { const o = record(x); keys(o, ['id', 'label', 'required', 'input', 'options']); if (typeof o.required !== 'boolean' || !['text', 'number', 'select'].includes(o.input))
    fail('invalid input'); const f: InputField = { id: id(o.id), label: str(o.label), required: o.required, input: o.input }; if (!f.label.trim())
    fail('empty field label'); if (f.input === 'select')
    f.options = labels(o.options);
else if (o.options !== undefined)
    fail('options on non-select field'); return f; }); unique(a.map(x => x.id)); if (!a.length)
    fail('no fields'); return a; }
/** Strict public allowlist. A nested acceptedAnswer/solution cannot silently leak. */
export function parseResponseDefinition(value: unknown): ResponseDefinition {
    const v = record(value);
    if (v.version !== 1)
        fail('unsupported definition version');
    const base: BaseDefinition = { version: 1, revision: id(v.revision), resourceIds: unique(list(v.resourceIds, 30).map(id)) };
    const common = ['version', 'revision', 'resourceIds', 'kind'];
    switch (v.kind) {
        case 'text':
            keys(v, [...common, 'maxLength']);
            return { ...base, kind: 'text', maxLength: integer(v.maxLength, 1, 50000) };
        case 'choice': {
            keys(v, [...common, 'options', 'minSelections', 'maxSelections']);
            const options = labels(v.options);
            const maxSelections = integer(v.maxSelections, 1, options.length);
            return { ...base, kind: 'choice', options, minSelections: integer(v.minSelections, 1, maxSelections), maxSelections };
        }
        case 'grid': {
            keys(v, [...common, 'rows', 'columns', 'minPerRow', 'maxPerRow']);
            const rows = labels(v.rows), columns = labels(v.columns);
            if (rows.length * columns.length > 400)
                fail('grid too large');
            const maxPerRow = integer(v.maxPerRow, 1, columns.length);
            return { ...base, kind: 'grid', rows, columns, minPerRow: integer(v.minPerRow, 0, maxPerRow), maxPerRow };
        }
        case 'fields':
            keys(v, [...common, 'fields']);
            return { ...base, kind: 'fields', fields: fields(v.fields) };
        case 'cloze': {
            keys(v, [...common, 'fields', 'segments']);
            const fs = fields(v.fields);
            const segments = list(v.segments, 200).map(s => { const o = record(s); if ('blankId' in o) {
                keys(o, ['blankId']);
                return { blankId: id(o.blankId) };
            } keys(o, ['text']); return { text: str(o.text, 10000) }; });
            const ids = unique(segments.flatMap(s => 'blankId' in s ? [s.blankId] : []));
            if (ids.length !== fs.length || fs.some(f => !ids.includes(f.id)))
                fail('blanks must each reference one defined field');
            return { ...base, kind: 'cloze', segments, fields: fs };
        }
        default: return fail('unsupported response kind');
    }
}
function selected(value: unknown, allowed: string[], max: number): string[] { const a = unique(list(value).map(id)); if (a.length > max || a.some(x => !allowed.includes(x)))
    fail('unknown option or too many selections'); return a; }
/** Draft validation permits missing answers, but never changes invalid selections. */
export function parseResponseEnvelope(value: unknown, definition: ResponseDefinition, questionId: string): ResponseEnvelope {
    const d = parseResponseDefinition(definition), v = record(value);
    keys(v, ['version', 'questionId', 'definitionRevision', 'kind', 'value']);
    if (v.version !== 1 || v.questionId !== questionId || v.definitionRevision !== d.revision || v.kind !== d.kind)
        fail('response identity/version mismatch');
    const a = record(v.value), base = { version: 1 as const, questionId, definitionRevision: d.revision };
    switch (d.kind) {
        case 'text':
            keys(a, ['text', 'working']);
            return { ...base, kind: 'text', value: { text: str(a.text, d.maxLength), working: str(a.working, 50000) } };
        case 'choice':
            keys(a, ['selectedIds']);
            return { ...base, kind: 'choice', value: { selectedIds: selected(a.selectedIds, d.options.map(o => o.id), d.maxSelections) } };
        case 'grid': {
            keys(a, ['rows']);
            const rows = record(a.rows);
            const result: Record<string, string[]> = {};
            for (const [r, val] of Object.entries(rows)) {
                id(r);
                if (!d.rows.some(x => x.id === r))
                    fail('unknown grid row');
                result[r] = selected(val, d.columns.map(c => c.id), d.maxPerRow);
            }
            return { ...base, kind: 'grid', value: { rows: result } };
        }
        case 'cloze':
        case 'fields': {
            keys(a, ['fields']);
            const values = record(a.fields), result: Record<string, string> = {};
            for (const [name, val] of Object.entries(values)) {
                id(name);
                const f = d.fields.find(f => f.id === name);
                if (!f)
                    fail('unknown field');
                const s = str(val, 5000);
                if (s.trim() && f.input === 'number' && !isResponseNumberDraft(s))
                    fail('invalid numeric input');
                if (s.trim() && f.input === 'number' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s.trim()) && !Number.isFinite(Number(s)))
                    fail('non-finite number');
                if (s && f.input === 'select' && !f.options!.some(o => o.id === s))
                    fail('unknown dropdown option');
                result[name] = s;
            }
            return { ...base, kind: d.kind, value: { fields: result } };
        }
    }
}
export function responseCompleteness(d: ResponseDefinition, response: ResponseEnvelope): 'empty' | 'partial' | 'complete' {
    const r = parseResponseEnvelope(response, d, response.questionId);
    if (r.kind === 'text')
        return r.value.text.trim() ? 'complete' : r.value.working.trim() ? 'partial' : 'empty';
    if (r.kind === 'choice' && d.kind === 'choice')
        return r.value.selectedIds.length >= d.minSelections ? 'complete' : r.value.selectedIds.length ? 'partial' : 'empty';
    if (r.kind === 'grid' && d.kind === 'grid') {
        const rows = r.value.rows;
        if (!Object.keys(rows).length)
            return 'empty';
        return d.rows.every(row => row.id in rows && rows[row.id].length >= d.minPerRow) ? 'complete' : 'partial';
    }
    if ((r.kind === 'fields' || r.kind === 'cloze') && (d.kind === 'fields' || d.kind === 'cloze')) {
        const values = r.value.fields;
        if (!Object.values(values).some(x => x.trim()))
            return 'empty';
        return d.fields.every(f => !f.required || (f.input === 'number' ? isCompleteResponseNumber(values[f.id] ?? '') : Boolean(values[f.id]?.trim()))) ? 'complete' : 'partial';
    }
    return fail('response kind mismatch');
}
/** Key validation is backend-only in use. Never send this object with a question. */
export function parsePrivateResponseKey(value: unknown, d: ResponseDefinition, maxMarks: number): PrivateResponseKey {
    d = parseResponseDefinition(d);
    const v = record(value);
    keys(v, ['version', 'definitionRevision', 'maxMarks', 'units']);
    if (v.version !== 1 || v.definitionRevision !== d.revision || v.maxMarks !== maxMarks || !Number.isFinite(maxMarks) || maxMarks <= 0)
        fail('key identity/marks mismatch');
    const targets = d.kind === 'grid' ? d.rows.map(r => r.id) : d.kind === 'cloze' || d.kind === 'fields' ? d.fields.map(f => f.id) : ['answer'];
    const used: string[] = [];
    const units = list(v.units, 100).map(item => {
        const u = record(item);
        keys(u, ['id', 'targetIds', 'marks', 'rule']);
        const targetIds = unique(list(u.targetIds, 64).map(id));
        if (!targetIds.length || targetIds.some(t => !targets.includes(t)) || typeof u.marks !== 'number' || !Number.isFinite(u.marks) || u.marks <= 0)
            fail('invalid marking unit');
        used.push(...targetIds);
        const rule = record(u.rule);
        switch (rule.kind) {
            case 'exact_set': {
                keys(rule, ['kind', 'expectedIds']);
                const allowed = d.kind === 'choice' ? d.options.map(o => o.id) : d.kind === 'grid' ? d.columns.map(c => c.id) : [];
                if (!allowed.length || targetIds.length !== 1)
                    fail('set rule target mismatch');
                selected(rule.expectedIds, allowed, d.kind === 'choice' ? d.maxSelections : (d as Extract<ResponseDefinition, {
                    kind: 'grid';
                }>).maxPerRow);
                const min = d.kind === 'choice' ? d.minSelections : (d as Extract<ResponseDefinition, {
                    kind: 'grid';
                }>).minPerRow;
                if (rule.expectedIds.length < min)
                    fail('key violates selection rule');
                break;
            }
            case 'text':
                keys(rule, ['kind', 'accepted', 'caseSensitive']);
                if (d.kind !== 'fields' && d.kind !== 'cloze')
                    fail('text key requires a field');
                if (targetIds.length !== 1 || !list(rule.accepted, 30).length || rule.accepted.some((s: unknown) => !str(s, 5000).trim()) || typeof rule.caseSensitive !== 'boolean')
                    fail('invalid text key');
                {
                    const f = d.fields.find(f => f.id === targetIds[0])!;
                    if (f.input === 'number' || (f.input === 'select' && rule.accepted.some((s: string) => !f.options!.some(o => o.id === s))))
                        fail('key/input mismatch');
                }
                break;
            case 'number':
                keys(rule, ['kind', 'expected', 'tolerance']);
                if ((d.kind !== 'fields' && d.kind !== 'cloze') || targetIds.length !== 1 || d.fields.find(f => f.id === targetIds[0])?.input !== 'number' || !Number.isFinite(rule.expected) || !Number.isFinite(rule.tolerance) || rule.tolerance < 0)
                    fail('invalid numeric key');
                break;
            case 'rubric':
                keys(rule, ['kind', 'guidance']);
                if (!str(rule.guidance, 20000).trim() || d.kind === 'choice' || d.kind === 'grid')
                    fail('invalid rubric');
                break;
            default: fail('unsupported marking rule');
        }
        return { id: id(u.id), targetIds, marks: u.marks, rule: JSON.parse(JSON.stringify(rule)) };
    });
    unique(units.map(u => u.id));
    unique(used);
    if (targets.some(t => !used.includes(t)) || Math.abs(units.reduce((s, u) => s + u.marks, 0) - maxMarks) > 1e-8)
        fail('key coverage/marks mismatch');
    return { version: 1, definitionRevision: d.revision, maxMarks, units };
}
