import { useId } from 'react';
import { parseResponseDefinition, parseResponseEnvelope, isResponseNumberDraft, type ResponseDefinition, type ResponseEnvelope, type InputField } from '@/lib/response-contract';
import { emptyResponse } from '@/lib/response-marking';

export interface ResponseInputProps {
  questionId: string;
  definition: ResponseDefinition;
  value: ResponseEnvelope | null;
  onChange?: (value: ResponseEnvelope) => void;
  disabled?: boolean;
}
const inputClass = 'border border-input rounded-md bg-background text-foreground px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-80';
export function choiceInstruction(min: number, max: number): string {
  const word = (n: number) => ({1:'one',2:'two',3:'three'}[n] ?? String(n));
  return min === max ? `Tick ${word(max)} ${max === 1 ? 'box' : 'boxes'}.` : `Tick between ${min} and ${max} boxes.`;
}

/** Controlled inputs: stable IDs carry answers, never labels or display order. */
export function ResponseInput({ questionId, definition, value, onChange, disabled = false }: ResponseInputProps) {
  const htmlId = useId();
  const d = parseResponseDefinition(definition);
  const response = value ? parseResponseEnvelope(value, d, questionId) : emptyResponse(d, questionId);
  const change = (next: ResponseEnvelope) => { if (!disabled) onChange?.(parseResponseEnvelope(next, d, questionId)); };
  if (d.kind === 'text' && response.kind === 'text') return <div className="space-y-3">
    <label className="block space-y-1"><span>Your answer</span><textarea className={`${inputClass} block min-h-28 w-full`} maxLength={d.maxLength} value={response.value.text} disabled={disabled} onChange={e => change({...response,value:{...response.value,text:e.target.value}})} /></label>
    <label className="block space-y-1"><span className="text-sm text-muted-foreground">Working or explanation (optional)</span><textarea className={`${inputClass} block min-h-20 w-full`} maxLength={50000} value={response.value.working} disabled={disabled} onChange={e => change({...response,value:{...response.value,working:e.target.value}})} /></label>
  </div>;
  if (d.kind === 'choice' && response.kind === 'choice') {
    const selected = response.value.selectedIds;
    return <fieldset className="space-y-2" disabled={disabled} aria-describedby={`${htmlId}-count`}>
      <legend className="mb-2 font-medium">{choiceInstruction(d.minSelections,d.maxSelections)}</legend>
      {d.options.map(option => {
        const checked = selected.includes(option.id);
        return <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 has-[:checked]:bg-accent">
          <input type="checkbox" className="h-5 w-5 shrink-0 accent-primary" checked={checked}
            disabled={disabled || (!checked && d.maxSelections > 1 && selected.length >= d.maxSelections)}
            onChange={() => change({...response,value:{selectedIds:checked ? selected.filter(id => id !== option.id) : d.maxSelections === 1 ? [option.id] : [...selected,option.id]}})} />
          <span>{option.label}</span>
        </label>;
      })}
      <p id={`${htmlId}-count`} role="status" className="text-sm text-muted-foreground">{selected.length} of {d.maxSelections} selected</p>
    </fieldset>;
  }
  if (d.kind === 'grid' && response.kind === 'grid') return <fieldset disabled={disabled} className="space-y-2">
    <legend className="mb-2 font-medium">Tick the correct cells in each row.</legend>
    <p className="text-sm text-muted-foreground">{d.minPerRow === d.maxPerRow ? `Select ${d.maxPerRow} per row.` : `Select up to ${d.maxPerRow} per row.`}{d.minPerRow === 0 ? ' Use “None” if no cells apply to a row.' : ''}</p>
    <div className="overflow-x-auto rounded-md border border-border" tabIndex={0} role="region" aria-label="Answer grid">
      <table className="w-full border-collapse text-sm"><thead><tr><th scope="col" className="p-3 text-left">Property</th>{d.columns.map(column => <th scope="col" key={column.id} className="min-w-24 border-l border-border p-3">{column.label}</th>)}</tr></thead>
        <tbody>{d.rows.map(row => {
          const selected = response.value.rows[row.id] ?? [];
          const update = (ids: string[]) => change({...response,value:{rows:{...response.value.rows,[row.id]:ids}}});
          return <tr key={row.id} className="border-t border-border"><th scope="row" className="min-w-36 p-3 text-left font-medium">
            {row.label}{d.minPerRow === 0 && <button type="button" aria-label={`No selections: ${row.label}`} aria-pressed={row.id in response.value.rows && !selected.length} disabled={disabled} onClick={() => update([])} className="ml-2 min-h-11 rounded border border-border px-2 text-xs font-normal aria-pressed:bg-accent">None</button>}
          </th>{d.columns.map(column => {
            const checked = selected.includes(column.id);
            return <td key={column.id} className="border-l border-border text-center"><label className="flex min-h-12 min-w-12 items-center justify-center p-2">
              <input type="checkbox" className="h-5 w-5 accent-primary" aria-label={`${row.label} — ${column.label}`} checked={checked} disabled={disabled || (!checked && selected.length >= d.maxPerRow)} onChange={() => update(checked ? selected.filter(id => id !== column.id) : [...selected,column.id])} />
            </label></td>;
          })}</tr>;
        })}</tbody></table>
    </div>
  </fieldset>;
  if ((d.kind === 'cloze' || d.kind === 'fields') && (response.kind === 'cloze' || response.kind === 'fields')) {
    const fieldInput = (field: InputField, inline: boolean) => {
      const fieldValue = response.value.fields[field.id] ?? '';
      const update = (next: string) => change({...response,value:{fields:{...response.value.fields,[field.id]:next}}});
      const props = { id:`${htmlId}-${field.id}`, 'aria-label':field.label, 'aria-required':field.required, disabled, value:fieldValue, className:`${inputClass} ${inline ? 'mx-1 my-1 inline-block max-w-full align-baseline' : 'block w-full'}` };
      return field.input === 'select' ? <select {...props} onChange={e => update(e.target.value)}><option value="">Choose…</option>{field.options!.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
        : <input {...props} type="text" inputMode={field.input === 'number' ? 'decimal' : 'text'} maxLength={5000} size={inline ? 12 : undefined} onChange={e => {if(field.input !== 'number' || isResponseNumberDraft(e.target.value))update(e.target.value);}} />;
    };
    return d.kind === 'cloze' ? <div className="whitespace-pre-wrap text-base leading-loose" aria-label="Complete the paragraph">{d.segments.map((segment,index) => 'text' in segment ? <span key={index}>{segment.text}</span> : <span key={segment.blankId}>{fieldInput(d.fields.find(field => field.id === segment.blankId)!,true)}</span>)}</div>
      : <div className="space-y-4">{d.fields.map(field => <div key={field.id}><label className="mb-1 block font-medium" htmlFor={`${htmlId}-${field.id}`}>{field.label}</label>{fieldInput(field,false)}</div>)}</div>;
  }
  throw new Error('Unsupported response input');
}
