// @vitest-environment node
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {unresolvedEdgeIdentifiers} from '../../scripts/check-edge-identifiers.mjs';

it('catches an unimported repair helper even when normal runtime globals are used', () => {
  const folder=mkdtempSync(join(tmpdir(),'examly-edge-identifiers-'));
  try {
    const file=join(folder,'handler.ts');
    writeFileSync(file,'export {}; Deno.env.get("KEY"); EdgeRuntime.waitUntil(Promise.resolve()); assembleQuestionText({});');
    const diagnostics=unresolvedEdgeIdentifiers([file]);
    expect(diagnostics).toHaveLength(1);
    expect(String(diagnostics[0].messageText)).toContain('assembleQuestionText');
    writeFileSync(file,'export {}; function assembleQuestionText(q: unknown) { return String(q); } Deno.env.get("KEY"); assembleQuestionText({});');
    expect(unresolvedEdgeIdentifiers([file])).toEqual([]);
  } finally { rmSync(folder,{recursive:true,force:true}); }
});
