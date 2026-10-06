import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface FavouriteProps { selected: boolean; pending: boolean; failed: boolean; onToggle: () => void; }
export function FavouriteControl({ selected, pending, failed, onToggle }: FavouriteProps) {
  return <div className="mt-2">
    <Button variant="ghost" size="sm" className="w-full gap-2" disabled={pending} aria-pressed={selected} onClick={onToggle}>
      <Star className={`h-4 w-4 ${selected ? 'fill-current text-warning' : ''}`} />{pending ? 'Saving…' : selected ? 'Favourited' : 'Favourite'}
    </Button>
    {failed && <p role="alert" className="text-xs text-destructive px-2">Couldn’t save your favourite. Tap again to retry.</p>}
  </div>;
}
