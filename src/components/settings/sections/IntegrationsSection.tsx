import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, Users } from "lucide-react";
import { toast } from "sonner";

export const IntegrationsSection = () => {
  const handleExportRevisionPlan = () => {
    toast.info('Export feature coming soon!');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendar Sync</CardTitle>
          <CardDescription>Connect your calendar to sync revision tasks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border p-4 bg-muted/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Calendar className="w-8 h-8 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">Google Calendar</p>
                  <p className="text-sm text-muted-foreground">Not connected</p>
                </div>
              </div>
              <Button variant="outline" disabled className="w-full sm:w-auto">
                Coming Soon
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 bg-muted/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Calendar className="w-8 h-8 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">iCal / Apple Calendar</p>
                  <p className="text-sm text-muted-foreground">Not connected</p>
                </div>
              </div>
              <Button variant="outline" disabled className="w-full sm:w-auto">
                Coming Soon
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
          <CardDescription>Download your revision plan and study data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Download className="w-8 h-8 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate">Export Revision Plan</p>
                <p className="text-sm text-muted-foreground">Download as ICS calendar file</p>
              </div>
            </div>
            <Button onClick={handleExportRevisionPlan} variant="outline" className="w-full sm:w-auto">
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>School & Teacher Accounts</CardTitle>
          <CardDescription>Connect with educational institutions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border p-4 bg-muted/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Users className="w-8 h-8 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">School Account</p>
                  <p className="text-sm text-muted-foreground">Not connected</p>
                </div>
              </div>
              <Button variant="outline" disabled className="w-full sm:w-auto">
                Coming Soon
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
