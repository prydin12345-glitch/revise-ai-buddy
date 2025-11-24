import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface VerificationRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  onVerificationRequested: () => void;
}

export const VerificationRequestModal = ({
  open,
  onOpenChange,
  userEmail,
  onVerificationRequested
}: VerificationRequestModalProps) => {
  const [schoolName, setSchoolName] = useState("");
  const [schoolDomain, setSchoolDomain] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!schoolName.trim()) {
      toast.error("Please enter your school name");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create or find school
      let schoolId: string;
      const { data: existingSchool } = await supabase
        .from("schools")
        .select("id")
        .eq("name", schoolName)
        .maybeSingle();

      if (existingSchool) {
        schoolId = existingSchool.id;
      } else {
        const { data: newSchool, error: schoolError } = await supabase
          .from("schools")
          .insert([{ 
            name: schoolName, 
            domain: schoolDomain || null,
            is_active: true 
          }])
          .select()
          .single();

        if (schoolError) throw schoolError;
        schoolId = newSchool.id;
      }

      // Create verification request
      const { error: verificationError } = await supabase
        .from("teacher_verifications")
        .insert([{
          teacher_id: user.id,
          school_id: schoolId,
          email: userEmail,
          status: "pending"
        }]);

      if (verificationError) throw verificationError;

      toast.success("Verification request submitted! You'll be notified once approved.");
      onVerificationRequested();
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting verification:", error);
      toast.error("Failed to submit verification request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Teacher Verification</DialogTitle>
          <DialogDescription>
            To assign exams and manage classes, you need to be verified as a teacher.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="schoolName">School Name *</Label>
            <Input
              id="schoolName"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Enter your school name"
            />
          </div>
          
          <div>
            <Label htmlFor="schoolDomain">School Email Domain (Optional)</Label>
            <Input
              id="schoolDomain"
              value={schoolDomain}
              onChange={(e) => setSchoolDomain(e.target.value)}
              placeholder="e.g., schoolname.edu"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
