import ts from 'typescript';
import { fileURLToPath } from 'node:url';

/** Bundling does not resolve free names: a missing import can still bundle. */
export function unresolvedEdgeIdentifiers(files) {
  const globals = fileURLToPath(new URL('./edge-runtime-globals.d.ts', import.meta.url));
  const program = ts.createProgram([...files, globals], {
    noEmit: true, allowImportingTsExtensions: true, skipLibCheck: true,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022, strict: false,
  });
  // Remote URL imports are resolved by Deno during deployment, so TS2307 is
  // outside this offline gate. Never suppress unresolved local names.
  return program.getSemanticDiagnostics().filter(diagnostic =>
    [2304, 2552, 18004, 2693, 1361].includes(diagnostic.code));
}

export function assertEdgeIdentifiers(files) {
  const diagnostics = unresolvedEdgeIdentifiers(files);
  if (!diagnostics.length) return;
  const host = {getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n', getCanonicalFileName: name => name};
  throw new Error('Unresolved Edge Function identifiers:\n' + ts.formatDiagnostics(diagnostics, host));
}
