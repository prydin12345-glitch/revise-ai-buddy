import { AlertCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export const PriorityBadge = ({ priority, className }: PriorityBadgeProps) => {
  const config = {
    high: { 
      icon: AlertCircle, 
      color: 'text-red-500', 
      bg: 'bg-red-500/10',
      label: 'High'
    },
    medium: { 
      icon: Circle, 
      color: 'text-yellow-500', 
      bg: 'bg-yellow-500/10',
      label: 'Medium'
    },
    low: { 
      icon: Circle, 
      color: 'text-green-500', 
      bg: 'bg-green-500/10',
      label: 'Low'
    }
  };
  
  const { icon: Icon, color, bg, label } = config[priority as keyof typeof config] || config.medium;
  
  return (
    <div className={cn("flex items-center gap-1 px-2 py-1 rounded-full text-xs", bg, className)}>
      <Icon className={cn("w-3 h-3", color)} />
      <span className="capitalize">{label}</span>
    </div>
  );
};
