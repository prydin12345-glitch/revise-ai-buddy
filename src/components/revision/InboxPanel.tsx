import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Inbox, Archive, Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

interface InboxTask {
  id: string;
  subject: string;
  subject_color: string;
  focus_topic?: string;
  exam_title?: string;
  duration?: number;
  idle_since?: string;
}

interface InboxPanelProps {
  tasks: InboxTask[];
  onTaskClick: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  onOpenArchive: () => void;
}

export const InboxPanel = ({ tasks, onTaskClick, onArchive, onOpenArchive }: InboxPanelProps) => {
  const idleTasks = tasks.filter((task) => {
    if (!task.idle_since) return false;
    return differenceInDays(new Date(), new Date(task.idle_since)) >= 3;
  });

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Inbox className="w-5 h-5" />
          Inbox
          <Badge variant="secondary" className="ml-1">
            {tasks.length}
          </Badge>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenArchive}
          className="gap-2"
        >
          <Archive className="w-4 h-4" />
          Archive
        </Button>
      </CardHeader>
      <CardContent>
        {idleTasks.length > 0 && (
          <div className="mb-3 p-2 bg-muted/50 rounded-md text-xs text-muted-foreground">
            {idleTasks.length} item{idleTasks.length > 1 ? 's' : ''} idle — schedule or archive
          </div>
        )}
        <ScrollArea className="h-[calc(100vh-250px)]">
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No unscheduled tasks</p>
              </div>
            ) : (
              tasks.map((task) => {
                const daysIdle = task.idle_since
                  ? differenceInDays(new Date(), new Date(task.idle_since))
                  : 0;

                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border-l-[3px] hover:bg-accent/50 transition-colors cursor-pointer group"
                    style={{
                      borderLeftColor: task.subject_color,
                      backgroundColor: `${task.subject_color}0D`,
                    }}
                    onClick={() => onTaskClick(task.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            className="text-xs font-medium"
                            style={{ backgroundColor: task.subject_color }}
                          >
                            {task.subject}
                          </Badge>
                          {daysIdle >= 3 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Clock className="w-3 h-3" />
                              {daysIdle}d idle
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-semibold truncate">
                          {task.focus_topic || task.exam_title || "General revision"}
                        </p>
                        {task.duration && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {task.duration}m
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchive(task.id);
                        }}
                      >
                        Archive
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};