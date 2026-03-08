// Deprecated: Kept for type compatibility only. All toasts now use sonner.
import * as React from "react";

type ToastProps = Record<string, any>;
type ToastActionElement = React.ReactElement;

const ToastProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const ToastViewport = React.forwardRef<HTMLDivElement>((_, ref) => <div ref={ref} />);
ToastViewport.displayName = "ToastViewport";
const Toast = React.forwardRef<HTMLDivElement>((_, ref) => <div ref={ref} />);
Toast.displayName = "Toast";
const ToastTitle = React.forwardRef<HTMLDivElement>((_, ref) => <div ref={ref} />);
ToastTitle.displayName = "ToastTitle";
const ToastDescription = React.forwardRef<HTMLDivElement>((_, ref) => <div ref={ref} />);
ToastDescription.displayName = "ToastDescription";
const ToastClose = React.forwardRef<HTMLButtonElement>((_, ref) => <button ref={ref} />);
ToastClose.displayName = "ToastClose";
const ToastAction = React.forwardRef<HTMLButtonElement>((_, ref) => <button ref={ref} />);
ToastAction.displayName = "ToastAction";

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
