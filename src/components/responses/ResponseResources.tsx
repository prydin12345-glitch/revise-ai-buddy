import type { ResponseResource } from '@/lib/response-marking';
export function ResponseResources({resources = []}:{resources?:ResponseResource[]}) {
  return <>{resources.map(resource => <section key={resource.id} aria-label={resource.title || 'Question data'} className="my-4 rounded-lg border border-border bg-muted/30 p-4">
    {resource.kind === 'text' ? <><h3 className="mb-2 font-medium">{resource.title}</h3><p className="whitespace-pre-wrap">{resource.text}</p></> : <div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><caption className="mb-2 text-left font-medium text-foreground">{resource.title}</caption><thead><tr>{resource.columns.map((column,index) => <th key={index} scope="col" className="border border-border p-2 text-left">{column}</th>)}</tr></thead><tbody>{resource.rows.map((row,index) => <tr key={index}>{row.map((cell,column) => <td key={column} className="border border-border p-2">{cell}</td>)}</tr>)}</tbody></table></div>}
  </section>)}</>;
}
