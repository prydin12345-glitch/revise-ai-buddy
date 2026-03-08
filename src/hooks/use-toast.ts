// Compatibility shim: redirects old Radix toast API to sonner
import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: any;
}

function toast(opts: ToastOptions | string) {
  if (typeof opts === "string") {
    sonnerToast(opts);
    return { id: "", dismiss: () => {}, update: () => {} };
  }

  const message = opts.title || "";
  const description = opts.description;

  if (opts.variant === "destructive") {
    sonnerToast.error(message, { description });
  } else {
    sonnerToast.success(message, { description });
  }

  return { id: "", dismiss: () => {}, update: () => {} };
}

function useToast() {
  return { toast, toasts: [], dismiss: () => {} };
}

export { useToast, toast };
