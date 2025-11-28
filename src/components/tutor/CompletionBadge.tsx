import { Badge } from "@/components/ui/badge";

interface CompletionBadgeProps {
  completed: number;
  total: number;
}

export const CompletionBadge = ({ completed, total }: CompletionBadgeProps) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  const getVariant = () => {
    if (percentage === 100) return "default";
    if (percentage >= 50) return "secondary";
    return "outline";
  };

  return (
    <Badge variant={getVariant()} className="font-mono">
      {completed}/{total} ({percentage}%)
    </Badge>
  );
};
