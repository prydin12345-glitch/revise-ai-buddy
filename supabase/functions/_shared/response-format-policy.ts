/** Explicit profile opt-in. Never infer response formats from subject names or a request. */
export const INTERACTIVE_RESPONSE_POLICY = 'interactive_v1' as const;
export type ResponseFormatPolicy = typeof INTERACTIVE_RESPONSE_POLICY;
export function parseResponseFormatPolicy(value: unknown): ResponseFormatPolicy | undefined {
  if (value == null || value === false) return undefined;
  if (value !== INTERACTIVE_RESPONSE_POLICY) throw new Error('Unsupported interactive response format version. Re-save the profile.');
  return value;
}
export function responseFormatsEnabled(context: any): boolean {
  const policy = parseResponseFormatPolicy(context?.response_formats);
  if (!policy) return false;
  if (context?.resolved_by !== 'server' || context.context_version !== 2 || !context.profile_id || !context.paper_contract || !['short_practice','full_mock'].includes(context.paper_contract.mode))
    throw new Error('Interactive formats require a fresh server-owned guided profile snapshot.');
  return true;
}
