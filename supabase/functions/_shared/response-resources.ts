import type { ResponseDefinition } from './response-contract.ts';
export type ResponseResource = { id: string; kind: 'text'; title: string; text: string }
  | { id: string; kind: 'table'; title: string; columns: string[]; rows: string[][] };
/** Optional shared stimulus lives with the saved question, not in each input. */
export function responseResources(question: any, definition: ResponseDefinition): ResponseResource[] {
  let config = question?.diagram_config;
  if (typeof config === 'string') { try { config = JSON.parse(config); } catch { config = null; } }
  if (!definition.resourceIds.length) return [];
  if (config?.type !== 'response_context' || !Array.isArray(config.resources)) throw new Error('Structured question is missing its shared data context');
  const resources = definition.resourceIds.map(id => {
    const matches = config.resources.filter((r: any) => r?.id === id);
    if (matches.length !== 1) throw new Error(`Missing or duplicate shared resource: ${id}`);
    const r = matches[0];
    const allowed = r.kind === 'table' ? ['id','kind','title','columns','rows'] : ['id','kind','title','text'];
    if (Object.keys(r).some(k => !allowed.includes(k)) || typeof r.title !== 'string' || r.title.length > 500) throw new Error('Invalid public shared resource');
    if (r.kind === 'text' && typeof r.text === 'string' && r.text.length <= 20000) return { id, kind: 'text', title: r.title, text: r.text } as ResponseResource;
    if (r.kind !== 'table' || !Array.isArray(r.columns) || !r.columns.length || r.columns.length > 12 || r.columns.some((c: unknown) => typeof c !== 'string' || !c.trim() || c.length > 500) || !Array.isArray(r.rows) || !r.rows.length || r.rows.length > 100) throw new Error('Invalid shared data table');
    const rows = r.rows.map((row: unknown) => {
      if (!Array.isArray(row) || row.length !== r.columns.length || row.some(c => !['string','number'].includes(typeof c) || (typeof c === 'number' && !Number.isFinite(c)) || String(c).length > 2000)) throw new Error('Shared data table row does not match its columns');
      return row.map(String);
    });
    return { id, kind: 'table', title: r.title, columns: r.columns, rows } as ResponseResource;
  });
  return resources;
}
