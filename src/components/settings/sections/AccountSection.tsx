import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Copy, Check, AlertCircle, User, Camera } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingRow } from "@/components/settings/SettingRow";
import { DangerZone } from "@/components/settings/DangerZone";

type UserProfile = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  student_code: string | null;
  avatar_url: string | null;
};

const AVATAR_BUCKET = "avatars";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

async function resolveAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const { data } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

export const AccountSection = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentCode, setStudentCode] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalFirstName, setOriginalFirstName] = useState("");
  const [originalLastName, setOriginalLastName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { updatePreference } = useUserPreferences();
  const { primaryRole } = useUserRole();

  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setEmail(user.email || "");

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, display_name, student_code, avatar_url")
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
          const url = await resolveAvatarUrl(profile.avatar_url);
          setAvatarUrl(url);

          const needsCompletion =
            !profile.first_name ||
            !profile.last_name ||
            !profile.student_code ||
            profile.student_code.startsWith("XX");
          setProfileIncomplete(needsCompletion);
        }
      }
      setLoading(false);
    };
    loadUserData();
  }, []);

  useEffect(() => {
    setHasChanges(
      firstName.trim() !== originalFirstName || lastName.trim() !== originalLastName,
    );
  }, [firstName, lastName, originalFirstName, originalLastName]);

  const capitalizeFirstLetter = (str: string): string =>
    str.trim().charAt(0).toUpperCase() + str.trim().slice(1).toLowerCase();

  const handleAvatarUpload = async (file: File) => {
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }

    setAvatarUploading(true);
    try {
      const fileExt = (file.name.split(".").pop() || "png").toLowerCase();
      const filePath = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        toast.error("Failed to upload avatar");
        return;
      }

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ avatar_url: filePath })
        .eq("id", userId);

      if (updateError) {
        toast.error("Failed to save avatar");
        return;
      }

      const url = await resolveAvatarUrl(filePath);
      setAvatarUrl(url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : null);
      toast.success("Avatar updated");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

      const needsNewCode = !studentCode || studentCode.startsWith("XX");
      const updateData: Record<string, any> = {
        first_name: formattedFirstName,
        last_name: formattedLastName,
        display_name: displayName,
      };

      if (needsNewCode) {
        const { data: newCode } = await supabase.rpc("generate_student_code", {
          p_first_name: formattedFirstName,
          p_last_name: formattedLastName,
        });
        if (newCode) updateData.student_code = newCode;
      }

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update(updateData)
        .eq("id", user.id);
      if (updateError) throw updateError;

      setFirstName(formattedFirstName);
      setLastName(formattedLastName);
      setOriginalFirstName(formattedFirstName);
      setOriginalLastName(formattedLastName);
      if (updateData.student_code) setStudentCode(updateData.student_code);
      setProfileIncomplete(false);
      setHasChanges(false);

      await updatePreference({ display_name: displayName });
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
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
      toast.success("Password reset email sent");
    } catch {
      toast.error("Failed to send password reset email");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyStudentCode = () => {
    if (studentCode) {
      navigator.clipboard.writeText(studentCode);
      setCopied(true);
      toast.success("Student ID copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
      {profileIncomplete && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-foreground text-xs">
            Complete your profile by entering your first and last name to generate your
            Student ID.
          </AlertDescription>
        </Alert>
      )}

      <SettingsCard title="Profile" description="Your personal details and avatar.">
        <SettingRow
          label="Profile photo"
          description="JPG or PNG, max 2MB."
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : firstName || lastName ? (
                  <span className="text-sm font-semibold text-foreground">
                    {getInitials()}
                  </span>
                ) : (
                  <User className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center cursor-pointer shadow-sm hover:bg-primary/90">
                {avatarUploading ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5 text-primary-foreground" />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={avatarUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                  }}
                />
              </label>
            </div>
          </div>
        </SettingRow>

        <SettingRow label="First name" htmlFor="firstName">
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className={!firstName.trim() && profileIncomplete ? "border-amber-500/50" : ""}
          />
        </SettingRow>

        <SettingRow label="Last name" htmlFor="lastName">
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className={!lastName.trim() && profileIncomplete ? "border-amber-500/50" : ""}
          />
        </SettingRow>

        {hasChanges && (
          <div className="py-4 flex justify-end">
            <Button
              onClick={handleSaveProfile}
              disabled={saving || !firstName.trim() || !lastName.trim()}
              size="sm"
              className="min-h-[44px]"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save changes
            </Button>
          </div>
        )}

        <SettingRow
          label="Email address"
          description="To change your email, export your data from Privacy & Security, delete your account, and create a new one."
          htmlFor="email"
        >
          <Input id="email" type="email" value={email} disabled className="bg-muted" />
        </SettingRow>

        {primaryRole === "student" && (
          <SettingRow
            label={
              <span className="inline-flex items-center gap-2">
                Student ID
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-[200px]">
                        Used by tutors to identify you. Generated from your name initials.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            }
            description="Generated from your name and cannot be changed."
          >
            {studentCode && !studentCode.startsWith("XX") ? (
              <div className="flex gap-2 w-full">
                <Input
                  value={studentCode}
                  disabled
                  className="bg-muted font-mono tracking-wider"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyStudentCode}
                  aria-label="Copy student ID"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {profileIncomplete
                  ? "Enter your first and last name to generate your Student ID."
                  : "Saving profile to generate your Student ID…"}
              </p>
            )}
          </SettingRow>
        )}
      </SettingsCard>

      <SettingsCard title="Password" description="Manage your account password.">
        <SettingRow
          label="Reset password"
          description="We'll email you a link to set a new password."
        >
          <Button
            onClick={handlePasswordReset}
            disabled={saving}
            variant="outline"
            size="sm"
            className="min-h-[44px]"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Send reset email
          </Button>
        </SettingRow>
      </SettingsCard>

      <DangerZone />
    </div>
  );
};
