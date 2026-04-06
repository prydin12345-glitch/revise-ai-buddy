import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorColor, style, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-4 w-full overflow-hidden rounded-full bg-muted", className)}
    style={style}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 transition-all"
      style={{ 
        transform: `translateX(-${100 - (value || 0)}%)`,
        backgroundColor: indicatorColor || 'hsl(var(--primary))'
      }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
