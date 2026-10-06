import { Button } from '@/components/ui/button';

interface Props {
  draft: { status: 'idle' | 'saving' | 'saved' | 'error'; restored: boolean; discard: () => void; retry: () => void };
}
export function SetupDraftNotice({ draft }: Props) {
  if (draft.status === 'idle' && !draft.restored) return null;
  return <div className="flex flex-wrap items-center justify-between gap-2 border border-border rounded-md bg-card px-3 py-2 mb-4">
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{draft.status === 'error' ? 'Couldn’t save this setup on your device.' : draft.status === 'saving' ? 'Saving setup…' : draft.restored ? 'Setup restored from this tab. Reattach any files or resource packs.' : 'Setup saved on this tab.'}</p>
    <div className="flex gap-2">{draft.status === 'error' && <Button size="sm" variant="outline" onClick={draft.retry}>Retry</Button>}
      <Button size="sm" variant="ghost" onClick={() => { if (window.confirm('Discard this unfinished setup?')) draft.discard(); }}>Discard draft</Button>
    </div>
  </div>;
}
