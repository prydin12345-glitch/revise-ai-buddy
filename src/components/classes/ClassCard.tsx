import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface ClassCardProps {
  group: {
    id: string;
    name: string;
    description?: string;
    subjects_covered?: { name: string; color?: string }[];
    joined_at?: string;
  };
  tutorName?: string;
  assignmentCount: number;
  announcementCount: number;
  onClick: () => void;
}

const subjectColors: Record<string, string> = {
  mathematics: "hsl(43, 74%, 66%)",
  maths: "hsl(43, 74%, 66%)",
  science: "hsl(174, 30%, 48%)",
  physics: "hsl(174, 30%, 48%)",
  chemistry: "hsl(174, 30%, 48%)",
  biology: "hsl(142, 40%, 45%)",
  languages: "hsl(12, 66%, 64%)",
  english: "hsl(12, 66%, 64%)",
  humanities: "hsl(214, 35%, 25%)",
  history: "hsl(214, 35%, 25%)",
  geography: "hsl(214, 35%, 25%)",
  arts: "hsl(262, 83%, 58%)",
  default: "hsl(217, 91%, 60%)",
};

const getSubjectColor = (subjectName?: string): string => {
  if (!subjectName) return subjectColors.default;
  const key = subjectName.toLowerCase();
  return subjectColors[key] || subjectColors.default;
};

export const ClassCard = ({ group, tutorName, assignmentCount, announcementCount, onClick }: ClassCardProps) => {
  const primarySubject = group.subjects_covered?.[0];
  const subjectColor = getSubjectColor(primarySubject?.name);

  return (
    <Card 
      className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden border-0"
      onClick={onClick}
    >
      <div 
        className="h-2 w-full"
        style={{ backgroundColor: subjectColor }}
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${subjectColor}20` }}
          >
            <BookOpen className="w-6 h-6" style={{ color: subjectColor }} />
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <h3 className="font-semibold text-lg text-foreground mb-1 line-clamp-1">
          {group.name}
        </h3>
        
        {tutorName && (
          <p className="text-sm text-muted-foreground mb-3">
            by {tutorName}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-4">
          {group.subjects_covered?.slice(0, 2).map((subject, idx) => (
            <Badge 
              key={idx} 
              variant="secondary"
              className="text-xs font-medium"
              style={{ 
                backgroundColor: `${getSubjectColor(subject.name)}15`,
                color: getSubjectColor(subject.name)
              }}
            >
              {subject.name}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {assignmentCount} tasks
            </span>
            {announcementCount > 0 && (
              <span className="flex items-center gap-1">
                📢 {announcementCount}
              </span>
            )}
          </div>
          {group.joined_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {format(new Date(group.joined_at), "MMM d")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
