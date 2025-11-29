import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";
import { toast } from "sonner";

const StudentPlanner = () => {
  return (
    <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Student Planner</h1>
            <p className="text-muted-foreground">View and manage student schedules and deadlines</p>
          </div>
          <Button onClick={() => toast.info("Create task feature coming soon")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Calendar View
            </CardTitle>
            <CardDescription>
              Schedule exams, practice sessions, and revision tasks for your students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Calendar integration coming soon</p>
              <p className="text-sm">
                View student availability, assign deadlines, and track progress all in one place
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Deadlines</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Missed Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No missed tasks</p>
            </CardContent>
          </Card>
        </div>
      </div>
  );
};

export default StudentPlanner;
