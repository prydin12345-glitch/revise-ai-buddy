import { Card, CardContent } from "@/components/ui/card";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface BestSubjectCardProps {
  subjectName: string;
  subjectColor: string;
  avgScore: number;
  totalExams: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

export const BestSubjectCard = ({ 
  subjectName, 
  subjectColor, 
  avgScore, 
  totalExams,
  trend,
  trendValue
}: BestSubjectCardProps) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTrendText = () => {
    if (trend === 'stable') return 'No change from last month';
    const direction = trend === 'up' ? 'up' : 'down';
    return `${direction === 'up' ? '↑' : '↓'} ${Math.round(trendValue)}% from last month`;
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-success';
      case 'down':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card 
      className="relative overflow-hidden border-2 shadow-lg"
      style={{ 
        borderColor: subjectColor,
        background: `linear-gradient(135deg, ${subjectColor}10 0%, ${subjectColor}05 100%)`
      }}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" style={{ color: subjectColor }} />
              <h3 className="text-sm font-medium text-muted-foreground">Top Performing Subject</h3>
            </div>
            <div className="space-y-1">
              <div 
                className="inline-block px-3 py-1 rounded-full text-sm font-semibold"
                style={{ 
                  backgroundColor: subjectColor,
                  color: 'white'
                }}
              >
                {subjectName}
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold" style={{ color: subjectColor }}>
                  {Math.round(avgScore)}%
                </p>
                <p className="text-sm text-muted-foreground">
                  average score
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Based on {totalExams} exam{totalExams !== 1 ? 's' : ''}
              </p>
            </div>
            <div className={`flex items-center gap-1 text-sm font-medium ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{getTrendText()}</span>
            </div>
          </div>
          <div className="absolute top-4 right-4 opacity-10">
            <Trophy className="w-24 h-24" style={{ color: subjectColor }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
