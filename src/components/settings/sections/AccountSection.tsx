import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Copy, Check } from "lucide-react";

type UserProfile = {
  student_code: string | null;
};

export const AccountSection = () => {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [studentCode, setStudentCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { preferences, updatePreference } = useUserPreferences();
  const { primaryRole } = useUserRole();

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
        setDisplayName(preferences?.display_name || "");

        // Fetch student code from user_profiles
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("student_code")
          .eq("id", user.id)
          .single() as { data: UserProfile | null; error: any };

        if (profile) {
          setStudentCode(profile.student_code);
        }
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

  const handleCopyStudentCode = () => {
    if (studentCode) {
      navigator.clipboard.writeText(studentCode);
      setCopied(true);
      toast.success('Student ID copied!');
      setTimeout(() => setCopied(false), 2000);
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

          {/* Student ID - only show for students */}
          {primaryRole === "student" && studentCode && (
            <div className="space-y-2">
              <Label htmlFor="studentCode">Student ID</Label>
              <div className="flex gap-2">
                <Input
                  id="studentCode"
                  value={studentCode}
                  disabled
                  className="bg-muted font-mono"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleCopyStudentCode}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your unique student identifier. Share this with your tutor if needed.
              </p>
            </div>
          )}
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
