import { describe, it, expect } from 'vitest';
import { parseResponseDefinition, parseResponseEnvelope, parsePrivateResponseKey, responseCompleteness } from '../functions/_shared/response-contract';
import { responseFixture, responseQuestion } from './response-foundation-fixtures';
describe('versioned response definitions and private keys', () => {
    it.each(['choice', 'grid', 'cloze', 'fields', 'text'] as const)('%s survives a JSON round trip with separate marking data', kind => {
        const { definition, envelope, key } = responseFixture(kind);
        expect(parseResponseDefinition(JSON.parse(JSON.stringify(definition)))).toEqual(definition);
        expect(parseResponseEnvelope(JSON.parse(JSON.stringify(envelope)), definition, responseQuestion)).toEqual(envelope);
        expect(parsePrivateResponseKey(key, definition, 2)).toEqual(key);
        expect(responseCompleteness(definition, envelope)).toBe('complete');
        expect(JSON.stringify(definition)).not.toContain('accepted');
        expect(JSON.stringify(definition)).not.toContain('expectedIds');
    });
    it.each(['correct_answer', 'answerKey', 'marking_key', 'score', 'feedback', 'rubric'])('rejects private %s in a public definition', field => {
        expect(() => parseResponseDefinition({ ...responseFixture().definition, [field]: 'secret' })).toThrow(/unknown or private/);
    });
    it('rejects nested solution aliases, duplicate IDs, and prototype keys', () => {
        const d: any = responseFixture().definition;
        d.options[0].solution = 'secret';
        expect(() => parseResponseDefinition(d)).toThrow();
        delete d.options[0].solution;
        d.options[1].id = 'a';
        expect(() => parseResponseDefinition(d)).toThrow(/duplicate/);
        d.options[1].id = 'constructor';
        expect(() => parseResponseDefinition(d)).toThrow();
    });
    it('requires exactly one stable blank reference for every field', () => {
        const d: any = responseFixture('cloze').definition;
        d.segments.push({ blankId: 'tube_x' });
        expect(() => parseResponseDefinition(d)).toThrow(/duplicate/);
        d.segments = [{ text: 'A question without its blank' }];
        expect(() => parseResponseDefinition(d)).toThrow(/blanks/);
    });
    it.each([{ version: 2 }, { definitionRevision: 'r2' }, { questionId: 'foreign' }, { kind: 'text' }])('refuses mismatched response identity %j', patch => {
        const { definition, envelope } = responseFixture();
        expect(() => parseResponseEnvelope({ ...envelope, ...patch }, definition, responseQuestion)).toThrow(/identity/);
    });
    it('allows an incomplete tick-two draft but never silently truncates extra selections', () => {
        const { definition, envelope } = responseFixture();
        const d: any = envelope;
        d.value.selectedIds = ['a'];
        expect(responseCompleteness(definition, d)).toBe('partial');
        d.value.selectedIds = [];
        expect(responseCompleteness(definition, d)).toBe('empty');
        d.value.selectedIds = ['a', 'b', 'c'];
        expect(() => parseResponseEnvelope(d, definition, responseQuestion)).toThrow(/too many/);
        d.value.selectedIds = ['a', 'a'];
        expect(() => parseResponseEnvelope(d, definition, responseQuestion)).toThrow(/duplicate/);
    });
    it('preserves an explicitly empty grid row and distinguishes it from an untouched grid', () => {
        const { definition, envelope } = responseFixture('grid');
        const d: any = envelope;
        d.value.rows = { polymer: [] };
        expect(responseCompleteness(definition, d)).toBe('complete');
        d.value.rows = {};
        expect(responseCompleteness(definition, d)).toBe('empty');
        d.value.rows = { other: ['dna'] };
        expect(() => parseResponseEnvelope(d, definition, responseQuestion)).toThrow(/unknown grid/);
    });
    it('keeps numerical zero and rejects NaN/Infinity as field answers', () => {
        const { definition, envelope } = responseFixture('fields');
        expect(responseCompleteness(definition, envelope)).toBe('complete');
        for (const value of ['NaN', 'Infinity', '1e500'])
            expect(() => parseResponseEnvelope({ ...envelope, value: { fields: { tube_x: value } } }, definition, responseQuestion)).toThrow();
    });
    it('validates dropdown IDs rather than accepting arbitrary displayed text', () => {
        const { definition, envelope, key } = responseFixture('cloze');
        const d: any = definition;
        d.fields[0] = { ...d.fields[0], input: 'select', options: [{ id: 'glucose', label: 'Glucose' }] };
        expect(parsePrivateResponseKey(key, d, 2)).toEqual(key);
        expect(parseResponseEnvelope(envelope, d, responseQuestion)).toEqual(envelope);
        expect(() => parseResponseEnvelope({ ...envelope, value: { fields: { tube_x: 'Glucose' } } }, d, responseQuestion)).toThrow(/dropdown/);
    });
    it('ties marking coverage and mark sums to the response definition', () => {
        const { definition, key } = responseFixture();
        expect(() => parsePrivateResponseKey({ ...key, maxMarks: 3 }, definition, 2)).toThrow();
        key.units[0].marks = 1;
        expect(() => parsePrivateResponseKey(key, definition, 2)).toThrow(/coverage/);
        key.units[0].marks = 2;
        key.units[0].targetIds = ['foreign'];
        expect(() => parsePrivateResponseKey(key, definition, 2)).toThrow(/unit/);
    });
    it('rejects wrong selection counts in a key and duplicate credit targets', () => {
        const { definition, key } = responseFixture();
        (key.units[0].rule as any).expectedIds = ['a'];
        expect(() => parsePrivateResponseKey(key, definition, 2)).toThrow(/selection/);
        (key.units[0].rule as any).expectedIds = ['a', 'b'];
        key.units.push({ ...key.units[0], id: 'second' });
        expect(() => parsePrivateResponseKey(key, definition, 4)).toThrow();
    });
});
