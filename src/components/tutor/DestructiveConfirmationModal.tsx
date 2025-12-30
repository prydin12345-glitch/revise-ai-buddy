import { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "explain" | "confirm-text" | "final";

interface DestructiveConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  impactItems?: string[];
  confirmText: string;
  confirmPlaceholder?: string;
  onConfirm: () => Promise<void>;
  actionLabel?: string;
}

export const DestructiveConfirmationModal = ({
  open,
  onOpenChange,
  title,
  description,
  impactItems = [],
  confirmText,
  confirmPlaceholder,
  onConfirm,
  actionLabel = "Confirm",
}: DestructiveConfirmationModalProps) => {
  const [step, setStep] = useState<Step>("explain");
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep("explain");
      setInputValue("");
      setIsProcessing(false);
    }
  }, [open]);

  const normalizedInput = inputValue.trim().toLowerCase();
  const normalizedConfirm = confirmText.trim().toLowerCase();
  const isMatch = normalizedInput === normalizedConfirm;

  const handleNext = () => {
    if (step === "explain") {
      setStep("confirm-text");
    } else if (step === "confirm-text" && isMatch) {
      setStep("final");
    }
  };

  const handleBack = () => {
    if (step === "confirm-text") {
      setStep("explain");
      setInputValue("");
    } else if (step === "final") {
      setStep("confirm-text");
    }
  };

  const handleFinalConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      // Error is handled by parent
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[hsl(0_80%_65%)]">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Explain */}
        {step === "explain" && (
          <>
            <div className="space-y-4 py-2">
              <DialogDescription>{description}</DialogDescription>
              
              {impactItems.length > 0 && (
                <div className="p-3 rounded-lg bg-[hsl(0_60%_12%)] border-2 border-[hsl(0_70%_40%)] space-y-2">
                  <p className="text-sm font-medium text-[hsl(0_80%_70%)]">This action will:</p>
                  <ul className="text-sm text-[hsl(0_20%_80%)] space-y-1">
                    {impactItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[hsl(0_80%_65%)] mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-[hsl(0_72%_51%)] hover:bg-[hsl(0_72%_45%)] text-white border-0" 
                onClick={handleNext}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Type to confirm */}
        {step === "confirm-text" && (
          <>
            <div className="space-y-4 py-2">
              <DialogDescription>
                To confirm, please type <span className="font-semibold text-foreground">"{confirmText}"</span> below:
              </DialogDescription>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-input" className="sr-only">
                  Confirmation text
                </Label>
                <Input
                  id="confirm-input"
                  placeholder={confirmPlaceholder || `Type "${confirmText}" to confirm`}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="bg-muted/30"
                  autoFocus
                />
                {inputValue.length > 0 && !isMatch && (
                  <p className="text-xs text-muted-foreground">
                    Text doesn't match. Please type exactly: {confirmText}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={handleBack}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  className="bg-[hsl(0_72%_51%)] hover:bg-[hsl(0_72%_45%)] text-white border-0" 
                  onClick={handleNext} 
                  disabled={!isMatch}
                >
                  Continue
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Final confirmation */}
        {step === "final" && (
          <>
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-[hsl(0_60%_15%)] border-2 border-[hsl(0_70%_45%)] flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-[hsl(0_80%_65%)]" />
              </div>
              <DialogDescription className="text-base">
                Are you absolutely sure? This action cannot be undone.
              </DialogDescription>
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={handleBack} disabled={isProcessing}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                  Cancel
                </Button>
                <Button 
                  className="bg-[hsl(0_72%_51%)] hover:bg-[hsl(0_72%_45%)] text-white border-0" 
                  onClick={handleFinalConfirm} 
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    actionLabel
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};