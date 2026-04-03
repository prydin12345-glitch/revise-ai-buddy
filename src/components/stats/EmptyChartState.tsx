import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyChartStateProps {
  message: string;
  icon: LucideIcon;
  action?: { label: string; onClick: () => void };
  height?: number;
}

export const EmptyChartState = ({
  message,
  icon: Icon,
  action,
  height = 220,
}: EmptyChartStateProps) => (
  <div
    className="flex flex-col items-center justify-center gap-3"
    style={{ height }}
  >
    <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
      <Icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
    </div>
    <p className="text-[13px] text-muted-foreground text-center max-w-[200px] leading-relaxed m-0">
      {message}
    </p>
    {action && (
      <Button size="sm" onClick={action.onClick} className="text-xs h-8 px-4">
        {action.label}
      </Button>
    )}
  </div>
);
