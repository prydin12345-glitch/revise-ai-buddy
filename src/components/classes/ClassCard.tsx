import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, Calendar, ChevronRight, Bell } from "lucide-react";
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
  mathematics: "45 74% 66%",
  maths: "45 74% 66%",
  science: "174 30% 48%",
  physics: "200 60% 50%",
  chemistry: "280 50% 55%",
  biology: "142 40% 45%",
  languages: "12 66% 64%",
  english: "350 60% 55%",
  humanities: "214 35% 35%",
  history: "25 60% 50%",
  geography: "170 50% 45%",
  arts: "262 83% 58%",
  "computer science": "220 70% 55%",
  default: "217 91% 60%",
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
      className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden border-border min-w-[260px] w-[260px] flex-shrink-0"
      onClick={onClick}
    >
      <div 
        className="h-1.5 w-full"
        style={{ backgroundColor: `hsl(${subjectColor})` }}
      />
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `hsl(${subjectColor} / 0.15)` }}
          >
            <BookOpen className="w-5 h-5" style={{ color: `hsl(${subjectColor})` }} />
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <h3 className="font-semibold text-base text-foreground mb-0.5 line-clamp-1 group-hover:text-primary transition-colors">
          {group.name}
        </h3>
        
        {tutorName && (
          <p className="text-sm text-muted-foreground mb-2">
            by {tutorName}
          </p>
        )}

        <div className="flex flex-wrap gap-1 mb-3">
          {group.subjects_covered?.slice(0, 2).map((subject, idx) => (
            <Badge 
              key={idx} 
              variant="secondary"
              className="text-xs font-medium"
              style={{ 
                backgroundColor: `hsl(${getSubjectColor(subject.name)} / 0.12)`,
                color: `hsl(${getSubjectColor(subject.name)})`
              }}
            >
              {subject.name}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {assignmentCount} tasks
            </span>
            {announcementCount > 0 && (
              <span className="flex items-center gap-1 text-primary">
                <Bell className="w-3.5 h-3.5" />
                {announcementCount}
              </span>
            )}
          </div>
          {group.joined_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(group.joined_at), "MMM d")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};