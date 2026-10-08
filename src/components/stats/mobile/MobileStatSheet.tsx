import { useRef, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Existing controlled sheets retain close/backdrop/Escape behavior; Radix
 * supplies focus management and screen-reader semantics. No data is changed. */
export const MobileStatSheet = ({
  open,
  onClose,
  title,
  subtitle,
  children,
}: Props) => {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="stats-detail-sheet max-h-[90dvh] overflow-y-auto rounded-xl p-5 max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
        onOpenAutoFocus={() => {
          returnFocus.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          if (returnFocus.current?.isConnected) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        <div className="space-y-2 pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {subtitle ?? "Details from your saved study results."}
          </DialogDescription>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
};
