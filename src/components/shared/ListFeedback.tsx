import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export function ListSkeleton() {
  return <div role="status" aria-label="Loading your work" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-[340px] border border-border rounded-lg p-5 space-y-5"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-4 w-2/3" /></div>)}
  </div>;
}
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-card p-4">
    <AlertCircle className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" /><p className="text-sm flex-1 min-w-[160px]">{message}</p>
    <Button variant="outline" onClick={onRetry}>Retry</Button>
  </div>;
}
