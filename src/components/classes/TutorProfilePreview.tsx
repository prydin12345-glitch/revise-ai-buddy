import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface TutorProfilePreviewProps {
  tutorName: string;
  bio?: string;
  subjectsTaught?: string[];
  children?: React.ReactNode;
}

export const TutorProfilePreview = ({ tutorName, bio, subjectsTaught, children }: TutorProfilePreviewProps) => {
  const initials = tutorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {children || (
          <span className="text-primary cursor-pointer hover:underline font-medium">
            {tutorName}
          </span>
        )}
      </HoverCardTrigger>
      <HoverCardContent className="w-72" align="start">
        <div className="flex gap-3">
          <Avatar className="w-12 h-12">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials || <User className="w-5 h-5" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <h4 className="font-semibold text-foreground">{tutorName}</h4>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {bio || "No bio available"}
            </p>
          </div>
        </div>
        
        {subjectsTaught && subjectsTaught.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Subjects taught</p>
            <div className="flex flex-wrap gap-1">
              {subjectsTaught.map((subject, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {subject}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};
