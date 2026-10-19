import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

export function LibraryDeleteDialog({ title, pending, error, onCancel, onConfirm }: { title: string | undefined; pending: boolean; error: string | null; onCancel: () => void; onConfirm: () => void }) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog open={title !== undefined} onOpenChange={open => { if (!open && !pending) onCancel(); }}>
      <AlertDialogContent aria-busy={pending}
        onOpenAutoFocus={() => { previousFocus.current = document.activeElement as HTMLElement; }}
        onCloseAutoFocus={event => { event.preventDefault(); const target = previousFocus.current?.isConnected ? previousFocus.current : document.querySelector<HTMLElement>('.library-view-switch [aria-current=page]'); target?.focus(); }}>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this?</AlertDialogTitle>
          <AlertDialogDescription>“{title}” and its saved attempts will be permanently deleted. This cannot be undone. Archive it instead if you want to keep it.</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onCancel}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>{pending ? "Deleting…" : error ? "Try deleting again" : "Yes, delete"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
