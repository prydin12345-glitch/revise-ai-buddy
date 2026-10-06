import type { ReactElement, ReactNode } from 'react';
import { X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose, DrawerTrigger } from './drawer';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  trigger: ReactElement;
  children: ReactNode;
  returnFocus?: () => void;
}

/** Vaul owns dismissal/focus/scroll gestures; no custom global swipe handler. */
export function ResponsiveActionSheet({ open, onOpenChange, title, description, trigger, children, returnFocus }: Props) {
  const mobile = useIsMobile();
  if (mobile) return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} autoFocus>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent onCloseAutoFocus={returnFocus ? event => { event.preventDefault(); returnFocus(); } : undefined} className="examly-action-sheet bg-card max-h-[min(85dvh,var(--visible-viewport-height,85dvh))]">
        <DrawerHeader className="text-left pr-16">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerClose className="absolute right-3 top-4 flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted" aria-label={`Close ${title}`}>
          <X className="h-5 w-5" />
        </DrawerClose>
        <div className="overflow-y-auto min-h-0 p-4 pt-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">{children}</div>
      </DrawerContent>
    </Drawer>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent onCloseAutoFocus={returnFocus ? event => { event.preventDefault(); returnFocus(); } : undefined} className="max-h-[calc(var(--visible-viewport-height,100dvh)-2rem)] overflow-y-auto">
        <DialogHeader className="pr-8"><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
