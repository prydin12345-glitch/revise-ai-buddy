import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Inbox, Archive } from "lucide-react";
import { isSameDay } from "date-fns";

interface Task {
  id: string;
  date: string;
  subject: string;
  subject_color: string;
  focus_topic: string | null;
  exam_title: string | null;
  time: string;
}

interface CalendarSidebarProps {
  currentDate: Date;
  onDateChange: (date: Date | undefined) => void;
  inboxTasks: Task[];
  archivedTasks: Task[];
  allTasks: Task[];
}

export const CalendarSidebar = ({ 
  currentDate, 
  onDateChange, 
  inboxTasks, 
  archivedTasks,
  allTasks 
}: CalendarSidebarProps) => {
  const hasTasksOnDate = (date: Date) => {
    return allTasks.some(task => isSameDay(new Date(task.date), date));
  };

  return (
    <div className="space-y-4">
      {/* Mini Calendar */}
      <Card>
        <CardContent className="p-3">
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={onDateChange}
            className="rounded-md"
            modifiers={{
              hasTask: hasTasksOnDate
            }}
            modifiersClassNames={{
              hasTask: "bg-primary/10 font-semibold"
            }}
          />
        </CardContent>
      </Card>
      
      {/* Inbox & Archive Tabs */}
      <Card>
        <Tabs defaultValue="inbox">
          <TabsList className="w-full">
            <TabsTrigger value="inbox" className="flex-1">
              <Inbox className="w-4 h-4 mr-2" />
              Inbox
              {inboxTasks.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {inboxTasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="archive" className="flex-1">
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="inbox" className="mt-0">
            <ScrollArea className="h-[300px]">
              {inboxTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No unscheduled tasks</p>
                </div>
              ) : (
                <div className="space-y-2 p-3">
                  {inboxTasks.map(task => (
                    <div
                      key={task.id}
                      className="p-2 rounded-lg border-l-4 cursor-pointer hover:bg-accent transition-colors"
                      style={{ borderLeftColor: task.subject_color }}
                    >
                      <Badge 
                        className="text-xs mb-1"
                        style={{ backgroundColor: task.subject_color }}
                      >
                        {task.subject}
                      </Badge>
                      <p className="text-sm font-medium truncate">
                        {task.focus_topic || task.exam_title}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="archive" className="mt-0">
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 p-3">
                {archivedTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Archive className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No archived tasks</p>
                  </div>
                ) : (
                  archivedTasks.map(task => (
                    <div
                      key={task.id}
                      className="p-2 rounded-lg border-l-4 opacity-60"
                      style={{ borderLeftColor: task.subject_color }}
                    >
                      <Badge 
                        className="text-xs mb-1"
                        style={{ backgroundColor: task.subject_color }}
                      >
                        {task.subject}
                      </Badge>
                      <p className="text-sm font-medium truncate">
                        {task.focus_topic || task.exam_title}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};
