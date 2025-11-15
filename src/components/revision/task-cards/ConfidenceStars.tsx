import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfidenceStarsProps {
  count: number;
  className?: string;
}

export const ConfidenceStars = ({ count, className }: ConfidenceStarsProps) => {
  return (
    <div className={cn("flex gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "w-3 h-3",
            i < count ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
};
