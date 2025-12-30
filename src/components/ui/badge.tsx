import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // High-contrast danger variant - bright red background, white text, glow effect
        danger: "bg-[hsl(0_75%_55%)] text-white border-[hsl(0_70%_50%)] shadow-[0_0_10px_hsl(0_75%_55%/0.5),inset_0_1px_0_hsl(0_75%_70%/0.3)] font-semibold",
        // High-contrast warning variant - bright orange background, dark text for contrast
        warning: "bg-[hsl(35_95%_55%)] text-[hsl(35_100%_8%)] border-[hsl(35_90%_48%)] shadow-[0_0_10px_hsl(35_95%_55%/0.4),inset_0_1px_0_hsl(35_95%_70%/0.3)] font-semibold",
        // Success variant - green with white text
        success: "bg-[hsl(142_70%_45%)] text-white border-[hsl(142_65%_40%)] shadow-[0_0_8px_hsl(142_70%_45%/0.4)]",
        // Neutral variant - muted styling
        neutral: "bg-muted text-muted-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
