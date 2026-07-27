import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useTelemetry } from "./tokens";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export const MobileStatSheet = ({ open, onClose, title, subtitle, children }: Props) => {
  const TELEMETRY = useTelemetry();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[90] rounded-t-3xl flex flex-col"
            style={{
              background: TELEMETRY.bg,
              borderTop: `1px solid ${TELEMETRY.border}`,
              maxHeight: "92vh",
            }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center pt-2 pb-1"
              onClick={onClose}
            >
              <span
                className="block h-1 w-10 rounded-full"
                style={{ background: TELEMETRY.border }}
              />
            </div>
            <div
              className="flex-shrink-0 flex items-start justify-between px-5 pt-3 pb-4"
              style={{ borderBottom: `1px solid ${TELEMETRY.borderSoft}` }}
            >
              <div className="min-w-0">
                <div
                  className="text-[11px]"
                  style={{ color: TELEMETRY.muted }}
                >
                  Detail
                </div>
                <div
                  className="text-lg font-semibold mt-0.5 truncate"
                  style={{ color: TELEMETRY.text }}
                >
                  {title}
                </div>
                {subtitle && (
                  <div
                    className="text-xs mt-1 leading-relaxed"
                    style={{ color: TELEMETRY.muted }}
                  >
                    {subtitle}
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="ml-3 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: TELEMETRY.card,
                  border: `1px solid ${TELEMETRY.border}`,
                  color: TELEMETRY.text,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 pb-10"
              style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
