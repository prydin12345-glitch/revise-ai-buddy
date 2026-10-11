import type { ReactNode } from "react";

/** Keep course guidance identical in compact and full settings views. */
export function SelectorDetails({
  compact,
  title,
  children,
}: {
  compact: boolean;
  title: string;
  children: ReactNode;
}) {
  return compact ? (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer py-1">{title}</summary>
      <div className="mt-2 space-y-2">{children}</div>
    </details>
  ) : (
    <>{children}</>
  );
}
