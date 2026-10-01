import type { ResponseDefinition, ResponseEnvelope, PrivateResponseKey } from '../functions/_shared/response-contract';
export const responseQuestion = '11111111-1111-4111-8111-111111111111';
export const responseParent = '22222222-2222-4222-8222-222222222222';
export const responseUser = '33333333-3333-4333-8333-333333333333';
export const responseOther = '44444444-4444-4444-8444-444444444444';
export const responseContractId = '55555555-5555-4555-8555-555555555555';
export const requestId = '66666666-6666-4666-8666-666666666666';
export function responseFixture(kind: ResponseDefinition['kind'] = 'choice') {
    const base = { version: 1 as const, revision: 'r1', resourceIds: ['experiment'] };
    const f = { id: 'tube_x', label: 'Tube X', input: 'text' as const, required: true };
    let definition: ResponseDefinition, response: ResponseEnvelope['value'], rule: any, targetIds = ['answer'];
    switch (kind) {
        case 'choice':
            definition = { ...base, kind, options: [{ id: 'a', label: 'Glucose' }, { id: 'b', label: 'Starch' }, { id: 'c', label: 'DNA' }], minSelections: 2, maxSelections: 2 };
            response = { selectedIds: ['a', 'b'] };
            rule = { kind: 'exact_set', expectedIds: ['a', 'b'] };
            break;
        case 'grid':
            definition = { ...base, kind, rows: [{ id: 'polymer', label: 'Is a polymer' }], columns: [{ id: 'glycogen', label: 'Glycogen' }, { id: 'sucrose', label: 'Sucrose' }, { id: 'dna', label: 'DNA' }], minPerRow: 0, maxPerRow: 3 };
            response = { rows: { polymer: ['glycogen', 'dna'] } };
            rule = { kind: 'exact_set', expectedIds: ['glycogen', 'dna'] };
            targetIds = ['polymer'];
            break;
        case 'cloze':
            definition = { ...base, kind, fields: [f], segments: [{ text: 'Tube X contains ' }, { blankId: 'tube_x' }, { text: '.' }] };
            response = { fields: { tube_x: 'glucose' } };
            rule = { kind: 'text', accepted: ['glucose'], caseSensitive: false };
            targetIds = ['tube_x'];
            break;
        case 'fields':
            definition = { ...base, kind, fields: [{ ...f, input: 'number' }] };
            response = { fields: { tube_x: '0' } };
            rule = { kind: 'number', expected: 0, tolerance: 0.1 };
            targetIds = ['tube_x'];
            break;
        case 'text':
            definition = { ...base, kind, maxLength: 10000 };
            response = { text: 'Glucose is absorbed.', working: '' };
            rule = { kind: 'rubric', guidance: 'PRIVATE: credit absorption.' };
            break;
    }
    const envelope = { version: 1, questionId: responseQuestion, definitionRevision: 'r1', kind, value: response } as ResponseEnvelope;
    const key: PrivateResponseKey = { version: 1, definitionRevision: 'r1', maxMarks: 2, units: [{ id: 'u1', targetIds, marks: 2, rule }] };
    return { definition, envelope, key };
}
