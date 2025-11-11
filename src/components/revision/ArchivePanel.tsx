import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { RotateCcw, Search, Archive } from "lucide-react";
import { useState } from "react";

interface ArchivedTask {
  id: string;
  subject: string;
  subject_color: string;
  focus_topic?: string;
  exam_title?: string;
  duration?: number;
  archived_at?: string;
}

interface ArchivePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: ArchivedTask[];
  onRestore: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export const ArchivePanel = ({ open, onOpenChange, tasks, onRestore, onDelete }: ArchivePanelProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTasks = tasks.filter((task) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      task.subject.toLowerCase().includes(searchLower) ||
      task.focus_topic?.toLowerCase().includes(searchLower) ||
      task.exam_title?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Archive
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search archived tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Unscheduled items were archived to keep your planner clear. Restore anytime.
          </p>

          <ScrollArea className="h-[400px]">
            <div className="space-y-2 pr-4">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Archive className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>{searchQuery ? "No matching archived tasks" : "No archived tasks"}</p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border-l-[3px] hover:bg-accent/50 transition-colors group"
                    style={{
                      borderLeftColor: task.subject_color,
                      backgroundColor: `${task.subject_color}0D`,
                    }}
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
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 gap-1.5"
                          onClick={() => onRestore(task.id)}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-destructive hover:text-destructive"
                          onClick={() => onDelete(task.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};