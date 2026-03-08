import { useEffect, useState, useRef } from "react";
import { Check, Sparkles } from "lucide-react";

interface GenerationStep {
  id: number;
  label: string;
  detail: string;
  duration: number; // ms
}

const GENERATION_STEPS: GenerationStep[] = [
  { id: 1, label: "Building prompt", detail: "Analysing your topics and profile settings", duration: 2000 },
  { id: 2, label: "Generating content", detail: "AI is writing your questions and diagrams", duration: 12000 },
  { id: 3, label: "Saving", detail: "Storing your exam securely", duration: 2000 },
];

interface GenerationStepperProps {
  /** Set to true once the real API call has resolved */
  apiComplete?: boolean;
  subjectColor?: string;
}

export const GenerationStepper = ({ apiComplete = false, subjectColor = "#3b82f6" }: GenerationStepperProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Step through durations
    let cumulative = 0;
    GENERATION_STEPS.forEach((step) => {
      if (step.id === 1) return; // start on 1
      cumulative += GENERATION_STEPS[step.id - 2].duration;
      const timer = setTimeout(() => {
        setCurrentStep((prev) => {
          // Don't advance past 3 unless API is done
          if (step.id === 3 && !apiComplete) return prev;
          return Math.max(prev, step.id);
        });
      }, cumulative);
      timersRef.current.push(timer);
    });

    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  // When API completes, jump to step 3 then mark done
  useEffect(() => {
    if (apiComplete) {
      setCurrentStep((prev) => Math.max(prev, 3));
      const done = setTimeout(() => setCurrentStep(4), 1500);
      return () => clearTimeout(done);
    }
  }, [apiComplete]);

  return (
    <div className="py-8 px-6 max-w-md mx-auto">
      {GENERATION_STEPS.map((step) => (
        <div
          key={step.id}
          className="flex items-start gap-4 mb-5 transition-opacity duration-400"
          style={{ opacity: currentStep >= step.id ? 1 : 0.3 }}
        >
          {/* Circle */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-400 border-2"
            style={{
              background:
                currentStep > step.id
                  ? "hsl(142 71% 45%)" // green
                  : currentStep === step.id
                  ? subjectColor
                  : "hsl(var(--muted))",
              borderColor:
                currentStep >= step.id ? "transparent" : "hsl(var(--border))",
            }}
          >
            {currentStep > step.id ? (
              <Check className="w-4 h-4 text-white" />
            ) : currentStep === step.id ? (
              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
            ) : (
              <span className="text-xs text-muted-foreground">{step.id}</span>
            )}
          </div>

          {/* Text */}
          <div>
            <div
              className={`text-sm ${
                currentStep === step.id ? "font-semibold text-foreground" : "font-normal"
              } ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"}`}
            >
              {step.label}
              {currentStep === step.id && (
                <span className="inline-block ml-2 animate-pulse">...</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{step.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
