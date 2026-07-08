import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  destructive?: boolean;
  className?: string;
}

/**
 * Neutral settings group container. No decorative icons — icons live in navigation only.
 * Children typically render as a divided list of SettingRow entries.
 */
export const SettingsCard = ({
  title,
  description,
  children,
  destructive = false,
  className,
}: SettingsCardProps) => {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card",
        destructive ? "border-destructive/30 bg-destructive/5" : "border-border/60",
        className,
      )}
    >
      {(title || description) && (
        <header
          className={cn(
            "px-5 pt-5 pb-4 border-b",
            destructive ? "border-destructive/20" : "border-border/40",
          )}
        >
          {title && (
            <h3
              className={cn(
                "text-sm font-semibold tracking-tight",
                destructive ? "text-destructive" : "text-foreground",
              )}
            >
              {title}
            </h3>
          )}
          {description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </header>
      )}
      <div className="px-5 divide-y divide-border/40">{children}</div>
    </section>
  );
};
