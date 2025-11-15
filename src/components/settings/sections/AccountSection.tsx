import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Loader2 } from "lucide-react";

export const AccountSection = () => {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { preferences, updatePreference } = useUserPreferences();

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
        setDisplayName(preferences?.display_name || "");
      }
    };
    loadUserData();
  }, [preferences]);

  const handleUpdateDisplayName = async () => {
    setLoading(true);
    try {
      await updatePreference({ display_name: displayName });
    } catch (error) {
      console.error('Error updating display name:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success('Password reset email sent!');
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast.error('Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <div className="flex gap-2">
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
              />
              <Button onClick={handleUpdateDisplayName} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed directly. Contact support if needed.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Manage your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handlePasswordReset} disabled={loading} variant="outline">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Password Reset Email
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Your current plan and billing details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border p-4 bg-muted/50">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold">Free Plan</p>
                <p className="text-sm text-muted-foreground">Currently active</p>
              </div>
              <Button variant="default">Upgrade</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
