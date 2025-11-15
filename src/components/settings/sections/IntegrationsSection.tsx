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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium">Google Calendar</p>
                  <p className="text-sm text-muted-foreground">Not connected</p>
                </div>
              </div>
              <Button variant="outline" disabled>
                Coming Soon
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium">iCal / Apple Calendar</p>
                  <p className="text-sm text-muted-foreground">Not connected</p>
                </div>
              </div>
              <Button variant="outline" disabled>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download className="w-8 h-8 text-primary" />
              <div>
                <p className="font-medium">Export Revision Plan</p>
                <p className="text-sm text-muted-foreground">Download as ICS calendar file</p>
              </div>
            </div>
            <Button onClick={handleExportRevisionPlan} variant="outline">
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium">School Account</p>
                  <p className="text-sm text-muted-foreground">Not connected</p>
                </div>
              </div>
              <Button variant="outline" disabled>
                Coming Soon
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
