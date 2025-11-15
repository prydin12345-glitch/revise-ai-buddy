import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const PrivacySection = () => {
  const { preferences, loading, updatePreference } = useUserPreferences();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Privacy Controls</CardTitle>
          <CardDescription>Manage your data and privacy preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="save-history">Save Revision History</Label>
              <p className="text-sm text-muted-foreground">Keep track of your past revision sessions</p>
            </div>
            <Switch
              id="save-history"
              checked={preferences?.save_revision_history}
              onCheckedChange={(checked) => updatePreference({ save_revision_history: checked })}
            />
          </div>

          <div className="pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Clear Activity Logs
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your activity logs. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Logs
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="pt-4">
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <a href="/privacy" target="_blank">
                Privacy Policy
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Enhance your account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
            </div>
            <Button variant="outline" size="sm" disabled>
              Coming Soon
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>Manage your active login sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border p-4 bg-muted/50">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Current Device</p>
                <p className="text-sm text-muted-foreground">Last active: Now</p>
              </div>
              <Button variant="ghost" size="sm" disabled>
                This Device
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm">
              Log Out All Other Sessions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
