// Globals supplied by the Supabase Deno runtime. Used only by the local
// unresolved-identifier check; this is not a substitute for full Deno checking.
declare namespace Deno {
  const env: { get(name: string): string | undefined };
  function serve(handler: (...args: any[]) => any): unknown;
}
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
