import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Copy, Check, AlertCircle, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type UserProfile = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  student_code: string | null;
};

export const AccountSection = () => {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentCode, setStudentCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalFirstName, setOriginalFirstName] = useState("");
  const [originalLastName, setOriginalLastName] = useState("");
  const { preferences, updatePreference } = useUserPreferences();
  const { primaryRole } = useUserRole();

  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");

        // Fetch profile data from user_profiles
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, display_name, student_code")
          .eq("id", user.id)
          .single() as { data: UserProfile | null; error: any };

        if (profile) {
          const fName = profile.first_name || "";
          const lName = profile.last_name || "";
          setFirstName(fName);
          setLastName(lName);
          setOriginalFirstName(fName);
          setOriginalLastName(lName);
          setStudentCode(profile.student_code);
          
          // Check if profile needs completion (missing name or student code)
          const needsCompletion = !profile.first_name || !profile.last_name || 
            !profile.student_code || profile.student_code.startsWith('XX');
          setProfileIncomplete(needsCompletion);
        }
      }
      setLoading(false);
    };
    loadUserData();
  }, []);

  // Track changes
  useEffect(() => {
    setHasChanges(
      firstName.trim() !== originalFirstName || 
      lastName.trim() !== originalLastName
    );
  }, [firstName, lastName, originalFirstName, originalLastName]);

  const capitalizeFirstLetter = (str: string): string => {
    return str.trim().charAt(0).toUpperCase() + str.trim().slice(1).toLowerCase();
  };

  const handleSaveProfile = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      toast.error("First name and last name are required");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const formattedFirstName = capitalizeFirstLetter(trimmedFirstName);
      const formattedLastName = capitalizeFirstLetter(trimmedLastName);
      const displayName = `${formattedFirstName} ${formattedLastName}`;

      // Check if we need to generate a new student code
      const needsNewCode = !studentCode || studentCode.startsWith('XX');
      
      let updateData: Record<string, any> = {
        first_name: formattedFirstName,
        last_name: formattedLastName,
        display_name: displayName,
      };

      // If student code needs to be generated, call the database function
      if (needsNewCode) {
        const { data: newCode, error: codeError } = await supabase
          .rpc('generate_student_code', {
            p_first_name: formattedFirstName,
            p_last_name: formattedLastName
          });

        if (codeError) {
          console.error('Error generating student code:', codeError);
        } else if (newCode) {
          updateData.student_code = newCode;
        }
      }

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update(updateData)
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Update local state
      setFirstName(formattedFirstName);
      setLastName(formattedLastName);
      setOriginalFirstName(formattedFirstName);
      setOriginalLastName(formattedLastName);
      if (updateData.student_code) {
        setStudentCode(updateData.student_code);
      }
      setProfileIncomplete(false);
      setHasChanges(false);

      // Also update display_name in preferences
      await updatePreference({ display_name: displayName });

      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    setSaving(true);
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
      setSaving(false);
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

  // Get initials for avatar
  const getInitials = () => {
    const fInitial = firstName.trim().charAt(0).toUpperCase();
    const lInitial = lastName.trim().charAt(0).toUpperCase();
    return fInitial + lInitial || "?";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Completion Banner */}
      {profileIncomplete && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-200">
            Complete your profile by entering your first and last name to generate your Student ID.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {/* Avatar with initials */}
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
              {firstName || lastName ? getInitials() : <User className="h-5 w-5" />}
            </div>
            Profile Information
          </CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* First Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                className={!firstName.trim() && profileIncomplete ? "border-amber-500/50" : ""}
              />
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="lastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
                className={!lastName.trim() && profileIncomplete ? "border-amber-500/50" : ""}
              />
            </div>
          </div>

          {/* Save button for name changes */}
          {hasChanges && (
            <Button 
              onClick={handleSaveProfile} 
              disabled={saving || !firstName.trim() || !lastName.trim()}
              className="w-full sm:w-auto"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          )}

          {/* Email */}
          <div className="space-y-2 pt-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email changes are not currently supported. To change your email
              address, delete your account from the <span className="font-medium text-foreground">Privacy &amp; Security</span> tab
              and create a new account with your new email. Use{" "}
              <span className="font-medium text-foreground">Export data</span> first to
              preserve your history.
            </p>
          </div>

          {/* Student ID - only show for students */}
          {primaryRole === "student" && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="studentCode">Student ID</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-[200px]">
                        This ID is used by tutors to identify you. It's generated from your name initials.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              {studentCode && !studentCode.startsWith('XX') ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      id="studentCode"
                      value={studentCode}
                      disabled
                      className="bg-muted font-mono tracking-wider"
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
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
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy to clipboard</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your student ID is generated from your name and cannot be changed.
                  </p>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground text-center">
                    {profileIncomplete 
                      ? "Enter your first and last name above to generate your Student ID"
                      : "Saving your profile to generate your Student ID..."}
                  </p>
                </div>
              )}
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
          <Button onClick={handlePasswordReset} disabled={saving} variant="outline" className="w-full sm:w-auto">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
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
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <p className="font-semibold">Free Plan</p>
                <p className="text-sm text-muted-foreground">Currently active</p>
              </div>
              <Button variant="default" className="w-full sm:w-auto">Upgrade</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
