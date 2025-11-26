import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Check } from "lucide-react";
import { useTutorOnboarding, TutorProfile } from "@/hooks/useTutorOnboarding";
import { Subject } from "@/hooks/useSubjects";

interface TutorOnboardingProps {
  subjects: Subject[];
  onComplete: () => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TutorOnboarding = ({ subjects, onComplete }: TutorOnboardingProps) => {
  const { completeTutorOnboarding, suggestedGroups, loading } = useTutorOnboarding();
  const [profile, setProfile] = useState<TutorProfile>({
    subjects_taught: [],
    teaching_mode: "groups",
    availability: {},
    bio: ""
  });
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const toggleSubject = (subjectId: string) => {
    setProfile(prev => ({
      ...prev,
      subjects_taught: prev.subjects_taught.includes(subjectId)
        ? prev.subjects_taught.filter(id => id !== subjectId)
        : [...prev.subjects_taught, subjectId]
    }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (profile.subjects_taught.length === 0) {
      return; // Button is already disabled for this case
    }

    if (profile.teaching_mode === "groups" && !profile.student_count_estimate) {
      return; // Validation handled by required fields
    }

    const result = await completeTutorOnboarding(profile);
    if (result.success && result.groups && result.groups.length > 0) {
      setShowGroupsModal(true);
    } else {
      onComplete();
    }
  };

  const copyToClipboard = (text: string, code: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <Label>Subjects You Teach</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
          {subjects.map(subject => (
            <Card
              key={subject.id}
              className={`p-3 cursor-pointer transition-all ${
                profile.subjects_taught.includes(subject.id)
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
              onClick={() => toggleSubject(subject.id)}
            >
              <div className="flex items-center space-x-2">
                <Checkbox checked={profile.subjects_taught.includes(subject.id)} />
                <Label className="cursor-pointer text-sm">{subject.name}</Label>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Label>Teaching Mode</Label>
        <RadioGroup
          value={profile.teaching_mode}
          onValueChange={(value: any) => setProfile({ ...profile, teaching_mode: value })}
          className="mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="groups" id="groups" />
            <Label htmlFor="groups" className="font-normal">Groups</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="one_on_one" id="one_on_one" />
            <Label htmlFor="one_on_one" className="font-normal">1:1 Sessions</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mixed" id="mixed" />
            <Label htmlFor="mixed" className="font-normal">Mixed (Both)</Label>
          </div>
        </RadioGroup>
      </div>

      {profile.teaching_mode === "groups" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Estimated Number of Students</Label>
            <Input
              type="number"
              min="1"
              value={profile.student_count_estimate || ""}
              onChange={(e) => setProfile({ ...profile, student_count_estimate: parseInt(e.target.value) })}
              placeholder="e.g., 30"
            />
          </div>
          <div>
            <Label>Preferred Group Size</Label>
            <Input
              type="number"
              min="1"
              value={profile.preferred_group_size || ""}
              onChange={(e) => setProfile({ ...profile, preferred_group_size: parseInt(e.target.value) })}
              placeholder="e.g., 10"
            />
          </div>
        </div>
      )}

      <div>
        <Label>Short Bio (Optional)</Label>
        <Textarea
          value={profile.bio}
          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
          placeholder="Tell students a bit about yourself and your teaching approach..."
          rows={3}
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={loading || profile.subjects_taught.length === 0}
        className="w-full"
      >
        {loading ? "Setting up..." : "Finish Setup"}
      </Button>

      <Dialog open={showGroupsModal} onOpenChange={setShowGroupsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Your Student Groups</DialogTitle>
            <DialogDescription>
              We've created suggested groups for you. Share these invite codes with your students to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {suggestedGroups.map(group => (
              <Card key={group.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{group.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Capacity: {group.capacity} students
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-3 py-1 bg-muted rounded text-sm font-mono">
                      {group.invite_code}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(group.invite_link, group.invite_code)}
                    >
                      {copiedCode === group.invite_code ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Button onClick={onComplete} className="w-full">
            Continue to Dashboard
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TutorOnboarding;
