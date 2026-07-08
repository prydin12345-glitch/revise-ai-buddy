import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SettingRowProps {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  /** Stack the control below on desktop too (for full-width lists like exam boards). */
  fullWidth?: boolean;
  className?: string;
  /** Optional hint rendered under the control on both viewports. */
  hint?: ReactNode;
}

/**
 * Two-column setting row.
 * Desktop: label + description on the left, control bounded to ~340px on the right.
 * Mobile: stacked vertically with a 48px min hit target on the control.
 */
export function SettingRow({
  label,
  description,
  htmlFor,
  children,
  fullWidth,
  className,
  hint,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        "py-5 first:pt-0 last:pb-0",
        !fullWidth &&
          "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-8 lg:items-start",
        "flex flex-col gap-2",
        className,
      )}
    >
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="min-w-0">
        <div className="min-h-[48px] flex items-center w-full">{children}</div>
        {hint && (
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{hint}</p>
        )}
      </div>
    </div>
  );
}
