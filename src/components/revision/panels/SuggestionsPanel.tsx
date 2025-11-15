import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingDown, AlertCircle, Clock, Plus } from "lucide-react";
import { format } from "date-fns";

interface WeakTopic {
  id: string;
  name: string;
  avgScore: number;
  attemptsCount: number;
}

interface UnrevisedSubject {
  id: string;
  name: string;
  color: string;
  daysSince: number;
}

interface SuggestedSlot {
  id: string;
  date: Date;
  time: string;
  duration: number;
}

interface SuggestionsPanelProps {
  weakTopics: WeakTopic[];
  unrevisedSubjects: UnrevisedSubject[];
  suggestedSlots: SuggestedSlot[];
  onScheduleRevision?: (topic: WeakTopic) => void;
  onScheduleSubject?: (subject: UnrevisedSubject) => void;
  onScheduleInSlot?: (slot: SuggestedSlot) => void;
}

export const SuggestionsPanel = ({ 
  weakTopics, 
  unrevisedSubjects, 
  suggestedSlots,
  onScheduleRevision,
  onScheduleSubject,
  onScheduleInSlot
}: SuggestionsPanelProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Smart Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weak Topics */}
        {weakTopics.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-orange-500" />
              Needs Attention
            </h4>
            <div className="space-y-2">
              {weakTopics.map(topic => (
                <Button
                  key={topic.id}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left h-auto py-2"
                  onClick={() => onScheduleRevision?.(topic)}
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{topic.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Avg: {topic.avgScore}% • {topic.attemptsCount} attempts
                    </p>
                  </div>
                  <Plus className="w-4 h-4 ml-2" />
                </Button>
              ))}
            </div>
          </div>
        )}
        
        {/* Unrevised Subjects */}
        {unrevisedSubjects.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              Not Revised Recently
            </h4>
            <div className="flex flex-wrap gap-2">
              {unrevisedSubjects.map(subject => (
                <Badge
                  key={subject.id}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  style={{ borderColor: subject.color }}
                  onClick={() => onScheduleSubject?.(subject)}
                >
                  {subject.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({subject.daysSince}d)
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Suggested Time Slots */}
        {suggestedSlots.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Available Slots
            </h4>
            <div className="space-y-1">
              {suggestedSlots.map(slot => (
                <div
                  key={slot.id}
                  className="text-xs p-2 rounded bg-accent/50 cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => onScheduleInSlot?.(slot)}
                >
                  {format(slot.date, 'EEE, MMM d')} • {slot.time}
                  <span className="ml-2 text-muted-foreground">({slot.duration}m free)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {weakTopics.length === 0 && unrevisedSubjects.length === 0 && suggestedSlots.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No suggestions right now</p>
            <p className="text-xs">Keep completing tasks!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
